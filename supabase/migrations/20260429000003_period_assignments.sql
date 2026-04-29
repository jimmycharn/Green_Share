-- ============================================================================
-- Normalize schema: แยก assignments JSON ออกจาก notify_message
--                   + เพิ่ม current_period_bidding_closed แทน period_extra hack
-- ============================================================================

-- 1) ตารางใหม่สำหรับ "มือที่กำหนดให้คนนี้งวดที่ N"
CREATE TABLE IF NOT EXISTS public.circle_period_assignments (
  circle_id  TEXT    NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  period     INTEGER NOT NULL,
  member_id  TEXT    NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (circle_id, period)
);

ALTER TABLE public.circle_period_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_period_assignments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_period_assignments FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_cpa_member ON public.circle_period_assignments(member_id);

-- 2) คอลัมน์ใหม่แทน period_extra = 'CLOSED_X'
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS current_period_bidding_closed BOOLEAN DEFAULT false;

-- 3) Migrate ข้อมูลเดิมจาก notify_message JSON → circle_period_assignments
DO $$
DECLARE
  r RECORD;
  k TEXT;
  v TEXT;
  meta JSONB;
BEGIN
  FOR r IN SELECT id, notify_message FROM public.circles
           WHERE notify_message IS NOT NULL AND notify_message LIKE '{%' LOOP
    BEGIN
      meta := r.notify_message::JSONB;
      IF meta ? 'assignments' THEN
        FOR k, v IN SELECT * FROM jsonb_each_text(meta->'assignments') LOOP
          IF v IS NOT NULL AND v <> 'NONE' AND v <> '' THEN
            INSERT INTO public.circle_period_assignments (circle_id, period, member_id)
            VALUES (r.id, k::INTEGER, v)
            ON CONFLICT (circle_id, period) DO NOTHING;
          END IF;
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- JSON malformed → skip
      NULL;
    END;
  END LOOP;
END $$;

-- 4) Migrate period_extra = 'CLOSED_{current_period}' → current_period_bidding_closed = true
UPDATE public.circles
   SET current_period_bidding_closed = true
 WHERE period_extra = 'CLOSED_' || current_period::text;

-- NOTE: ไม่ได้ลบคอลัมน์ notify_message / period_extra ในรอบนี้
-- เพื่อให้รองรับการ rollback และยังเก็บค่าสำหรับ audit
-- เมื่อมั่นใจว่า deploy แล้วเรียบร้อย ค่อยลบใน migration ถัดไป
