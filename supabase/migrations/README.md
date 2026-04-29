# Supabase Migrations

## โครงสร้าง

Migrations ถูกตั้งชื่อด้วย timestamp `YYYYMMDDHHMMSS` เพื่อให้ Supabase CLI
รันตามลำดับเวลา

| ไฟล์ | ทำอะไร |
|------|--------|
| `20260429000001_enable_rls.sql` | เปิด RLS + revoke privileges (Phase 1.5) |
| `20260429000002_id_sequences.sql` | แทน ID generation แบบ query-then-insert ด้วย SEQUENCE (Phase 2.7) |
| `20260429000003_period_assignments.sql` | ตาราง `circle_period_assignments` + คอลัมน์ `current_period_bidding_closed` (Phase 2.9) |
| `20260429000004_indexes.sql` | เพิ่ม indexes ตาม query pattern (Phase 2.10) |

## วิธีรัน

### ตัวเลือก A — Supabase CLI (แนะนำ)

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### ตัวเลือก B — SQL Editor ของ Dashboard

Copy เนื้อหาแต่ละไฟล์ paste ลงใน SQL Editor ตามลำดับเลข

## ลำดับสำหรับโปรเจคใหม่

1. รัน `archive/supabase_schema.sql` ก่อน (baseline schema)
2. รัน `archive/update_schema_v2.sql` (เพิ่ม `house_name`)
3. รัน `archive/upgrade_db.sql` (เพิ่ม `interest_method`)
4. รัน migrations ในโฟลเดอร์นี้ตามลำดับ timestamp

> **TODO:** ในอนาคตจะรวม baseline + update + upgrade เป็น migration เดียว
> เมื่อพร้อมจะ reset environment
