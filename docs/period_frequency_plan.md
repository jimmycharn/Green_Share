# ระบบกำหนดความถี่ของงวดแชร์ (Period Frequency System)

## Background

ปัจจุบัน DB มีคอลัมน์ `period_type`, `period_value`, `period_extra`, `period_interval` ในตาราง `circles` แต่ยังไม่ได้ใช้งานจริงในฟอร์ม UI และยังไม่มีตารางเก็บวันที่ของแต่ละงวด ระบบนี้จะทำให้แอดมินสามารถ:

1. เลือกประเภทความถี่ (รายเดือน / ราย 2 สัปดาห์ / รายวัน)
2. กำหนดรายละเอียดความถี่ (ทุกกี่วัน, กี่เดือน, วันที่เท่าไหร่)
3. ระบบสร้างวันที่ทุกงวดให้อัตโนมัติจาก start_date + ความถี่
4. แอดมินสามารถแก้ไขวันที่ของแต่ละงวดได้เอง

## ออกแบบ Data Model

### Frequency Types & Options

```
┌─────────────────────────────────────────────────────────────────────┐
│  period_type     │  ความหมาย        │  ค่าที่เกี่ยวข้อง             │
├──────────────────┼──────────────────┼──────────────────────────────┤
│  MONTHLY         │  รายเดือน        │  period_interval = 1,2,3     │
│                  │                  │  (ทุกกี่เดือน)                │
│                  │                  │  period_value = "15"         │
│                  │                  │  (วันที่ในเดือน, default      │
│                  │                  │   = วันที่เดียวกับ start_date)│
├──────────────────┼──────────────────┼──────────────────────────────┤
│  BIMONTHLY       │  ราย 2 ครั้ง/เดือน│  period_value = "1,15"      │
│                  │                  │  (2 วันที่ในเดือน)            │
│                  │                  │  หรือ period_value =          │
│                  │                  │  "FIRST_LAST" (ต้น-สิ้นเดือน)│
├──────────────────┼──────────────────┼──────────────────────────────┤
│  DAILY           │  รายวัน          │  period_interval = 1,5,7,    │
│                  │                  │  10,14,... (ทุกกี่วัน)        │
└─────────────────────────────────────────────────────────────────────┘
```

### ตารางใหม่: `circle_period_dates`

เก็บวันที่ที่คำนวณ/กำหนดเองของแต่ละงวด:

```sql
CREATE TABLE IF NOT EXISTS public.circle_period_dates (
  circle_id    TEXT    NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  period       INTEGER NOT NULL,
  period_date  DATE    NOT NULL,        -- วันที่ของงวดนั้นๆ
  is_manual    BOOLEAN DEFAULT false,   -- ถ้า true = แอดมินกำหนดเอง
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (circle_id, period)
);
```

> [!NOTE]
> ใช้คอลัมน์ `is_manual` เพื่อแยกว่าวันที่ไหนเป็นการคำนวณอัตโนมัติ vs แอดมินแก้เอง — ถ้า regenerate วันใหม่จะข้ามงวดที่ `is_manual = true` ได้

### ใช้ซ้ำคอลัมน์เดิมในตาราง `circles`

ไม่ต้องเพิ่มคอลัมน์ใหม่ ใช้ของเดิมที่มีอยู่แล้ว:

| คอลัมน์ | ใช้ทำอะไร |
|---------|----------|
| `period_type` | `'MONTHLY'` / `'BIMONTHLY'` / `'DAILY'` |
| `period_value` | รายเดือน: วันที่ (เช่น `"15"`), ราย2ครั้ง: `"1,15"` หรือ `"FIRST_LAST"`, รายวัน: ไม่ใช้ |
| `period_interval` | รายเดือน: ทุกกี่เดือน (1,2,3), รายวัน: ทุกกี่วัน (1,5,7,10,...) |
| `start_date` | วันเริ่มต้น (ใช้คำนวณวันงวดอัตโนมัติ) |

---

## Proposed Changes

### 1. Database — Migration

#### [NEW] `supabase/migrations/20260501000001_circle_period_dates.sql`

สร้างตาราง `circle_period_dates` + indexes + RLS

---

### 2. Backend — Auto-generate Period Dates

#### [MODIFY] [circle.js](file:///f:/Web%20App/GreenShare/lib/controllers/circle.js)

- เพิ่ม utility function `generatePeriodDates(startDate, totalHands, periodType, periodInterval, periodValue)` ที่คำนวณวันที่ทุกงวดอัตโนมัติ
- ใน `createCircle()` → หลัง insert circle แล้ว ให้ generate dates แล้ว bulk insert ลง `circle_period_dates`
- เพิ่ม function `updatePeriodDate(data)` สำหรับ admin แก้ไขวันที่ของงวดใดงวดหนึ่ง
- เพิ่ม function `regeneratePeriodDates(data)` สำหรับ regenerate ใหม่ทั้งหมด (ข้ามงวดที่ `is_manual = true`)

**Logic การคำนวณวันงวด:**

```
MONTHLY (ทุก N เดือน):
  งวด 1 = start_date
  งวด 2 = start_date + N เดือน (วันที่เดิม)
  งวด 3 = start_date + 2N เดือน
  ...

BIMONTHLY (2 ครั้ง/เดือน):
  ถ้า period_value = "1,15":
    เรียงวันที่ 1 และ 15 ของทุกเดือนถัดจาก start_date
  ถ้า period_value = "FIRST_LAST":
    เรียงวันที่ 1 และวันสุดท้ายของทุกเดือน

DAILY (ทุก N วัน):
  งวด 1 = start_date
  งวด 2 = start_date + N วัน
  งวด 3 = start_date + 2N วัน
  ...
```

---

### 3. Frontend — ฟอร์มสร้างวงแชร์

#### [MODIFY] [page.tsx](file:///f:/Web%20App/GreenShare/app/circles/create/page.tsx)

เพิ่ม section ใหม่ใต้ "วันที่เริ่มต้น" สำหรับเลือกความถี่:

```
┌─────────────────────────────────────────────────────────────┐
│  📅 ความถี่ของงวด                                          │
│                                                             │
│  [  🗓️ รายเดือน  |  📆 ราย 2 ครั้ง/เดือน  |  📋 รายวัน  ] │ ← Tab/SegmentedControl
│                                                             │
│  ── ถ้าเลือก "รายเดือน" ──────────────────────────────────  │
│  ทุก [ 1 ▼ ] เดือน    วันที่ [ 15 ▼ ] ของเดือน             │
│                                                             │
│  ── ถ้าเลือก "ราย 2 ครั้ง/เดือน" ──────────────────────────  │
│  ○ กำหนดวันที่เอง: วันที่ [1] กับ [15]                      │
│  ○ ต้นเดือน + สิ้นเดือน                                     │
│                                                             │
│  ── ถ้าเลือก "รายวัน" ─────────────────────────────────────  │
│  ทุก [ 7 ▼ ] วัน                                            │
│                                                             │
│  ────────────────────────────────────────────────────────── │
│  📋 ตัวอย่างวันที่งวด (Preview):                             │
│  งวด 1: 01/05/2026  (เริ่มต้น)                              │
│  งวด 2: 01/06/2026                                          │
│  งวด 3: 01/07/2026                                          │
│  ... (แสดง 5 งวดแรก + "อีก X งวด")                          │
└─────────────────────────────────────────────────────────────┘
```

**ฟอร์มจะ:**
- เพิ่ม fields: `period_type`, `period_interval`, `period_value` ลง Zod schema
- แสดง/ซ่อน options ตาม period_type ที่เลือก (conditional rendering)
- Preview คำนวณวันงวดแบบ real-time ให้เห็นก่อนสร้าง
- ส่ง period_type, period_interval, period_value ไป backend

---

### 4. Frontend — จัดการวันที่ในหน้า Circle Detail

#### [MODIFY] Circle detail page (หน้ารายละเอียดวงแชร์)

- แสดงวันที่ของทุกงวดใน Timeline
- แอดมินสามารถกดแก้ไขวันที่ของงวดใดงวดหนึ่งได้ (date picker)
- ปุ่ม "รีเซ็ตวันงวด" สำหรับ regenerate ใหม่

---

### 5. API Route

#### [MODIFY] [route.js](file:///f:/Web%20App/GreenShare/app/api/action/route.js)

เพิ่ม action:
- `update_period_date` → เรียก `updatePeriodDate()`
- `regenerate_period_dates` → เรียก `regeneratePeriodDates()`

---

## User Review Required

> [!IMPORTANT]
> **เลือกรูปแบบ UI สำหรับ Frequency Picker:**
> ผมออกแบบให้ใช้ Segmented Control (Tab) สำหรับเลือกประเภทความถี่ 3 แบบ แล้ว conditional แสดง options ตามที่เลือก ดีไหมครับ? หรืออยากเป็น Dropdown ธรรมดา?

> [!IMPORTANT]
> **"ราย 2 ครั้ง/เดือน" (BIMONTHLY) — ยืนยัน behavior:**
> 1. กำหนด 2 วันที่เอง เช่น วันที่ 1 กับ 15 → งวดจะสลับไป 1/5, 15/5, 1/6, 15/6, ...
> 2. เลือก "ต้นเดือน + สิ้นเดือน" → ใช้วันที่ 1 กับวันสุดท้ายของเดือน (28/29/30/31)
> 
> ถูกต้องตามที่ต้องการไหมครับ?

## Open Questions

> [!NOTE]
> 1. **วันหยุด/วันนักขัตฤกษ์**: ต้องการให้ระบบข้ามวันหยุดอัตโนมัติไหม? เช่น ถ้างวดตรงวันเสาร์ เลื่อนไปจันทร์?
> 2. **สิ้นเดือน 31**: ถ้าเลือก "ทุกวันที่ 31" แต่เดือนไหนมีแค่ 28-30 วัน → ให้ใช้วันสุดท้ายของเดือนนั้นแทน ตกลงไหม?
> 3. **แก้ไขความถี่หลังสร้าง**: เมื่อวงแชร์เริ่มไปแล้ว (ACTIVE) ยังสามารถเปลี่ยนความถี่ได้ไหม? หรือแค่แก้วันที่ทีละงวด?

## Verification Plan

### Automated Tests
- Unit test สำหรับ `generatePeriodDates()` ครอบคลุมทั้ง 3 frequency types
- Test edge cases: เดือน 28/29/30/31 วัน, leap year, BIMONTHLY FIRST_LAST

### Manual Verification
- สร้างวงแชร์ใหม่กับแต่ละ frequency type → ตรวจสอบวันงวดที่ generate ออกมา
- แก้ไขวันที่ของบางงวด → regenerate → ตรวจว่างวดที่แก้เองไม่ถูกเขียนทับ
- ทดสอบ UI Preview ว่าคำนวณและแสดงวันถูกต้อง
