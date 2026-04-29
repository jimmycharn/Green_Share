-- ============================================================================
-- Enable Row Level Security on all application tables.
--
-- ยุทธศาสตร์: แอปเข้าถึงฐานข้อมูลผ่าน service_role key จากฝั่ง server เท่านั้น
-- (service_role bypass RLS โดย default) ดังนั้นเปิด RLS โดยไม่มี policy
-- จะ "ปิดทุกอย่าง" สำหรับ anon key / authenticated โดยไม่กระทบ backend
--
-- หมายเหตุ: ถ้าอนาคตต้องการให้ client ต่อ Supabase ตรง ต้องเพิ่ม policy
-- สำหรับ role `authenticated` โดยเฉพาะ
-- ============================================================================

ALTER TABLE public.members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_players   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slips            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_houses    ENABLE ROW LEVEL SECURITY;

-- Force RLS แม้แต่สำหรับ table owner (ยกเว้น service_role)
ALTER TABLE public.members          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.circles          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.circle_players   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bids             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.slips            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_payments   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.banks            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.member_houses    FORCE ROW LEVEL SECURITY;

-- Revoke privileges ทั่วไปของ anon/authenticated role
-- (service_role ยังมี BYPASSRLS ปกติ)
REVOKE ALL ON public.members        FROM anon, authenticated;
REVOKE ALL ON public.circles        FROM anon, authenticated;
REVOKE ALL ON public.circle_players FROM anon, authenticated;
REVOKE ALL ON public.bids           FROM anon, authenticated;
REVOKE ALL ON public.slips          FROM anon, authenticated;
REVOKE ALL ON public.admin_payments FROM anon, authenticated;
REVOKE ALL ON public.banks          FROM anon, authenticated;
REVOKE ALL ON public.member_houses  FROM anon, authenticated;
