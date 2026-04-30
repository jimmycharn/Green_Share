# Phase 6 — SUPERADMIN ดูวงแชร์ของท้าวแชร์อื่น

> **สถานะ:** ✅ Phase 1 (MVP) เสร็จ — commit `5096faa`
> **เริ่ม:** 2026-04-30
> **เกี่ยวข้อง:** `app/members/page.tsx` (แท็บ "บ้านแชร์อื่น")

## 🎯 เป้าหมาย

ให้ SUPERADMIN ดูได้ว่าท้าวแชร์/admin บ้านอื่น **มีวงแชร์อะไรบ้าง / ประเภทไหน
(ประมูล/ขั้นบันได) / ในแต่ละวงมีสมาชิกใคร** โดยไม่ต้อง login แทน

---

## 1. UX Flow

ขยายจาก expand block เดิมในแท็บ "บ้านแชร์อื่น" (ไม่เปิดหน้าใหม่):

```
[Avatar] เจ๊แมว              ท้าวแชร์ ⚙
│
├─ ลูกบ้าน (1)
│   └─ [Avatar] น้องข้าวหอม  📞 299292626  ⚙
│
└─ วงแชร์ของบ้านนี้ (3)                    ← section ใหม่
    ├─ 🎯 วง พ.ค. 67     [ACTIVE]   20 มือ · 5,000 ฿/มือ   ›
    │      ▾ เปิดดูสมาชิก
    │         1. pprim (น้องข้าวหอม)
    │         2. ...
    ├─ 📊 วงขั้นบันได 1   [PENDING]  10 มือ · 2,000 ฿/มือ  ›
    └─ 🎯 วง เม.ย.        [CLOSED]   ...                    ›
```

**Interaction**
- คลิก row วงแชร์ → toggle expand → แสดง player list (มือที่ / ชื่อ / รูป)
- คลิก `›` (ChevronRight) → ไปหน้า `/circles/{id}` (มีอยู่แล้ว)

**Type badges**
- 🎯 `ประมูล (เปียแข่งดอก)` → badge สีส้ม
- 📊 `ขั้นบันได (ดอกคงที่)` → badge สีน้ำเงิน

---

## 2. Data Contract

### Action ใหม่: `get_admin_circles`
**Permission:** `SUPERADMIN` เท่านั้น

**Input**
```json
{ "admin_id": "M0002" }
```

**Output**
```json
{
  "status": "success",
  "circles": [
    {
      "id": "C0007",
      "circle_name": "วง พ.ค. 67",
      "type": "ประมูล (เปียแข่งดอก)",
      "status": "ACTIVE",
      "total_hands": 20,
      "amount_per_hand": 5000,
      "current_period": 3,
      "created_at": "2026-04-15T...",
      "players": [
        {
          "hand_no": 1,
          "member_id": "M0010",
          "name": "pprim",
          "nickname": null,
          "custom_nickname": "น้องข้าวหอม",
          "picture_url": "...",
          "status": "ACTIVE"
        }
      ]
    }
  ]
}
```

**สำคัญ:** server merge `member_nicknames` ของ caller (SUPERADMIN) เข้า players เพื่อให้
ชื่อเล่นที่ตั้งไว้ใน Phase 5 แสดงต่อเนื่อง

---

## 3. Server Changes

| ไฟล์ | งาน |
|---|---|
| `lib/controllers/admin.js` | เพิ่ม `getAdminCircles({ caller_role, caller_id, admin_id })` — guard role, query `circles where creator_id = admin_id`, join `circle_players → members`, merge nickname overrides |
| `lib/schemas.js` | `get_admin_circles: z.object({ admin_id: id }).passthrough()` |
| `app/api/action/route.js` | wire handler |

**ไม่ต้องแก้ DB / ไม่เพิ่ม column** — ใช้ schema เดิมทั้งหมด

---

## 4. Client Changes

ไฟล์: `app/members/page.tsx`

| ตำแหน่ง | งาน |
|---|---|
| OtherHousesContent expand block | เพิ่ม `<AdminCirclesSection adminId={admin.id} />` ใต้ส่วนลูกบ้าน |
| `AdminCirclesSection` (component ใหม่) | SWR fetch `get_admin_circles` แบบ lazy (component mount ก็ต่อเมื่อ admin ถูก expand) |
| `CircleRow` | toggle expand เปิด-ปิด list สมาชิก + ปุ่ม `›` ลิงก์ไป `/circles/{id}` |
| `CirclePlayerItem` | ใช้ `displayNameOf()` เดิม เพื่อ nickname ทำงานต่อเนื่อง |

ไม่ต้องเก็บ state ใน parent — ใช้ `useState` ภายใน CircleRow (auto unmount เมื่อ collapse)

---

## 5. Phasing

| Phase | งาน | สถานะ |
|---|---|---|
| **1 (MVP)** | action + UI list วง + expand player + ลิงก์ `/circles/{id}` | ✅ เสร็จ |
| **2** | Filter status/type · Search ตามชื่อวง · ตัวนับ active/pending/closed | ⚪ รอ |
| **3** | สรุปยอดเงินหมุนในบ้าน · timeline งวดล่าสุด · กราฟ insight | ⚪ รอ |

---

## 6. ความเสี่ยง / TODO ในอนาคต

- **Performance:** บ้านที่มีวง > 50 อาจต้อง lazy-load players แยก (โหลดตอน expand แต่ละวง)
- **Cross-house transfer:** สมาชิกที่ย้ายบ้านจะยังอยู่ใน circle เดิม → UI ต้องสื่อชัดว่า player list = "ตอนสร้างวง"
- **Privacy:** SUPERADMIN เห็นเบอร์ + รูปลูกบ้านอื่น — confirm แล้วว่าเป็นพฤติกรรมที่ต้องการ

---

## 7. Acceptance Criteria

- [ ] SUPERADMIN expand admin row ใน "บ้านแชร์อื่น" → เห็น section "วงแชร์ของบ้านนี้"
- [ ] แต่ละวงแสดง type badge ที่ถูกต้อง (ประมูล / ขั้นบันได)
- [ ] Expand วง → เห็น list สมาชิก พร้อมรูป + ชื่อเล่น (ถ้าตั้งไว้)
- [ ] คลิก `›` → ไปหน้า `/circles/{id}` ได้
- [ ] ADMIN/MEMBER เรียก `get_admin_circles` → ได้ error "ไม่มีสิทธิ์"
- [ ] ไม่มี SQL migration ใหม่ที่ต้องรัน

---

## Changelog

- **2026-04-30:** เขียนแผน + เริ่ม Phase 1
- **2026-04-30:** ✅ Phase 1 เสร็จ (`5096faa`) — `getAdminCircles` controller, schema, handler และ `AdminCirclesSection`/`CircleRow`/`CirclePlayerItem` ใน `app/members/page.tsx`
