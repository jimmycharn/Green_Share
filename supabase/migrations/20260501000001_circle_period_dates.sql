-- ============================================================================
-- ตาราง circle_period_dates: เก็บวันที่ของแต่ละงวดในวงแชร์
-- รองรับ auto-generate จาก frequency settings + manual override
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.circle_period_dates (
  circle_id    TEXT    NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  period       INTEGER NOT NULL,
  period_date  DATE    NOT NULL,
  amount       NUMERIC,
  is_manual    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (circle_id, period)
);

-- RLS
ALTER TABLE public.circle_period_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_period_dates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_period_dates FROM anon, authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cpd_circle
  ON public.circle_period_dates(circle_id);

CREATE INDEX IF NOT EXISTS idx_cpd_date
  ON public.circle_period_dates(period_date);
