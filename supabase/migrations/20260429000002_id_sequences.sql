-- ============================================================================
-- Fix race condition ของการสร้าง ID แบบ "query last + 1"
-- เปลี่ยนมาใช้ SEQUENCE ของ PostgreSQL เพื่อ atomic guarantee
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.members_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.circles_id_seq;

CREATE OR REPLACE FUNCTION public.next_member_id() RETURNS TEXT
LANGUAGE SQL VOLATILE AS $$
  SELECT 'M' || lpad(nextval('public.members_id_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_circle_id() RETURNS TEXT
LANGUAGE SQL VOLATILE AS $$
  SELECT 'C' || lpad(nextval('public.circles_id_seq')::text, 4, '0');
$$;

-- ตั้งค่าเริ่มต้นของ sequence ให้ตรงกับ max ID ปัจจุบัน
DO $$
DECLARE max_m INT; max_c INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0)
    INTO max_m FROM public.members WHERE id ~ '^M[0-9]+$';
  IF max_m > 0 THEN PERFORM setval('public.members_id_seq', max_m); END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0)
    INTO max_c FROM public.circles WHERE id ~ '^C[0-9]+$';
  IF max_c > 0 THEN PERFORM setval('public.circles_id_seq', max_c); END IF;
END $$;

-- ใช้ฟังก์ชันเป็น default ของคอลัมน์ id
ALTER TABLE public.members ALTER COLUMN id SET DEFAULT public.next_member_id();
ALTER TABLE public.circles ALTER COLUMN id SET DEFAULT public.next_circle_id();
