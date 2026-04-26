-- ----------------------------------------------------
-- สคริปต์อัปเกรดฐานข้อมูลสำหรับระบบ Multi-House (บ้านแชร์)
-- กรุณานำโค้ดทั้งหมดนี้ไปรันในเมนู SQL Editor ของ Supabase
-- ----------------------------------------------------

-- 1. สร้างตาราง banks (สำหรับให้ท้าวแชร์/แอดมิน เพิ่มบัญชีธนาคารตัวเอง)
CREATE TABLE IF NOT EXISTS public.banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_no TEXT NOT NULL,
    account_name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. สร้างตาราง member_houses (ทะเบียนราษฎร์: ลูกวงแต่ละคน อยู่บ้านใครบ้าง)
CREATE TABLE IF NOT EXISTS public.member_houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    admin_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING', -- 'PENDING' (รออนุมัติ), 'ACTIVE' (ใช้งานได้), 'BLOCKED' (โดนบล็อค)
    assigned_bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(member_id, admin_id) -- ป้องกันลูกวงคนเดิมกดเข้าร่วมบ้านท้าวแชร์คนเดิมซ้ำซ้อน
);

-- 3. ตรวจสอบและย้ายข้อมูลสมาชิกเก่าทั้งหมดเข้า "ส่วนกลาง" (Superadmin คนแรก) 
-- เพื่อไม่ให้คนที่เคยสมัครแอปไปก่อนหน้านี้เกิดบั๊กสูญหาย
DO $$
DECLARE
  superadmin_id TEXT;
BEGIN
  -- หา ID ของผู้ที่เป็น SUPERADMIN คนแรกสุด
  SELECT id INTO superadmin_id FROM public.members WHERE role = 'SUPERADMIN' LIMIT 1;
  
  IF superadmin_id IS NOT NULL THEN
    -- แทรกลูกวงเก่าทุกคนเข้าไปเป็นลูกบ้านของ SUPERADMIN อัตโนมัติ (ข้ามคนที่เป็น superadmin_id เอง)
    INSERT INTO public.member_houses (member_id, admin_id, status)
    SELECT id, superadmin_id, status FROM public.members 
    WHERE id != superadmin_id
    ON CONFLICT (member_id, admin_id) DO NOTHING;
  END IF;
END $$;
