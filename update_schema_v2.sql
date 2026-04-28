-- อัปเดตฐานข้อมูล GreenShare: เพิ่มคอลัมน์ชื่อบ้านแชร์
-- รันคำสั่งนี้ใน SQL Editor ของ Supabase

ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS house_name TEXT;

-- (เพิ่มเติม) อัปเดตข้อมูลเบื้องต้น: ตั้งชื่อบ้านเริ่มต้นให้กับ Admin/Superadmin ทุกคน (ถ้าต้องการ)
-- UPDATE public.members SET house_name = name WHERE (role = 'ADMIN' OR role = 'SUPERADMIN') AND house_name IS NULL;
