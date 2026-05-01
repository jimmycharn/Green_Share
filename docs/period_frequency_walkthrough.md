# Walkthrough: ระบบกำหนดความถี่ของงวดแชร์

## สรุปการเปลี่ยนแปลง

เพิ่มระบบให้แอดมินกำหนดความถี่ของงวดแชร์ได้ 3 แบบ พร้อม auto-generate วันที่ทุกงวดอัตโนมัติ และสามารถแก้ไขวันที่ทีละงวดได้

---

## ไฟล์ที่เปลี่ยนแปลง

### 1. Database Migration
#### [NEW] [20260501000001_circle_period_dates.sql](file:///f:/Web%20App/GreenShare/supabase/migrations/20260501000001_circle_period_dates.sql)
- สร้างตาราง `circle_period_dates` (PK: `circle_id` + `period`)
- คอลัมน์: `period_date` (DATE), `is_manual` (BOOLEAN) — แยกว่าเป็น auto-gen หรือแอดมินกำหนดเอง
- มี RLS + indexes

> [!IMPORTANT]
> ต้อง run migration นี้ใน Supabase ก่อน deploy

---

### 2. Backend Utility
#### [NEW] [periodDates.js](file:///f:/Web%20App/GreenShare/lib/periodDates.js)
Pure function `generatePeriodDates()` ที่คำนวณวันงวดจาก:

| Period Type | ตัวอย่าง | Logic |
|---|---|---|
| `MONTHLY` | ทุก 1/2/3 เดือน | start + N*interval เดือน, clamp วันที่ถ้าเกินวันสิ้นเดือน |
| `BIMONTHLY` | วันที่ 1+15 หรือ ต้น+สิ้นเดือน | สลับ 2 วันในแต่ละเดือน |
| `DAILY` | ทุก 1/5/7/10 วัน | start + N*interval วัน |

---

### 3. Backend Controllers
#### [MODIFY] [circle.js](file:///f:/Web%20App/GreenShare/lib/controllers/circle.js)

render_diffs(file:///f:/Web%20App/GreenShare/lib/controllers/circle.js)

**เพิ่ม 4 สิ่ง:**
- Import `generatePeriodDates`
- ใน `createCircle()`: auto-generate dates หลัง insert circle (non-fatal ถ้าล้มเหลว)
- `updatePeriodDate()`: แก้ไขวันที่ของงวดเดียว (set `is_manual = true`)
- `regeneratePeriodDates()`: generate ใหม่ทั้งหมด แต่ข้ามงวดที่ `is_manual = true`
- `getPeriodDates()`: ดึงวันที่ทุกงวด

---

### 4. API + Validation
#### [MODIFY] [route.js](file:///f:/Web%20App/GreenShare/app/api/action/route.js)
เพิ่ม 3 actions: `update_period_date`, `regenerate_period_dates`, `get_period_dates`

#### [MODIFY] [schemas.js](file:///f:/Web%20App/GreenShare/lib/schemas.js)
เพิ่ม Zod schemas สำหรับ 3 actions ใหม่

---

### 5. Frontend — ฟอร์มสร้างวงแชร์
#### [MODIFY] [page.tsx](file:///f:/Web%20App/GreenShare/app/circles/create/page.tsx)

render_diffs(file:///f:/Web%20App/GreenShare/app/circles/create/page.tsx)

**เพิ่ม:**
- Zod schema fields: `period_type`, `period_interval`, `period_value`, `bimonthly_day1`, `bimonthly_day2`, `bimonthly_mode`
- **Segmented Control** สำหรับเลือก 3 ประเภทความถี่ (🗓️ รายเดือน | 📆 ครึ่งเดือน | 📋 รายวัน)
- **Conditional sub-options**: ตาม type ที่เลือก (dropdown เลือกจำนวนเดือน/วัน, radio เลือก custom vs ต้น+สิ้นเดือน)
- **Period Date Preview**: คำนวณ real-time แสดง 5 งวดแรก + จำนวนงวดที่เหลือ
- ส่ง `period_type`, `period_interval`, `period_value` ไป backend

---

## Verification

- ✅ `next build` ผ่าน — ไม่มี TypeScript errors
- ⏳ ต้อง deploy (LINE LIFF ต้องใช้ HTTPS) เพื่อทดสอบ UI จริง
- ⏳ ต้อง run migration ใน Supabase
