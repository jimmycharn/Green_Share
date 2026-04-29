# Repo Cleanup Checklist (Phase 4 #16)

ไฟล์/โฟลเดอร์ต่อไปนี้ดูเหมือน **legacy / scratch** ที่ไม่ถูก import แล้ว
ก่อนลบจริง แนะนำ:

1. ตรวจสอบให้แน่ใจว่าไม่มีอะไรอยากเก็บ
2. ถ้าจะเก็บ → ย้ายไป external storage หรือ git branch แยก
3. แล้วค่อย `git rm -r` + commit

> **ไม่ลบให้อัตโนมัติ** เพราะอาจมีของสำคัญอยู่ในนั้น — ตัดสินใจเอง

## Folders ที่น่าจะลบได้

| Path            | สาเหตุ                                    |
| --------------- | ----------------------------------------- |
| `Backup/`       | สำรองโค้ดเก่า — ใช้ git history แทน       |
| `Last Version/` | เวอร์ชันก่อนหน้า — ใช้ git tag/branch แทน |
| `anti_version/` | ชื่อบ่งบอกว่าเป็น scratch                 |
| `scratch/`      | งานทดลอง                                  |
| `กำลังทำ/`      | งานค้าง — ถ้ายังใช้อยู่ ย้ายไป branch     |
| `Pic/`          | รูป asset เก่า — ถ้าใช้ ย้ายไป `public/`  |

## Files ที่น่าจะลบได้

| Path                | สาเหตุ                                   |
| ------------------- | ---------------------------------------- |
| `code.gs`           | Google Apps Script เก่า (ไม่ใช่ Next.js) |
| `index.html` (root) | ไฟล์ standalone HTML เก่า                |
| `Setting.txt`       | ดูเหมือน scratch notes                   |
| `CLAUDE.md`         | ขนาด 12 bytes — ว่างเปล่า?               |

## Files ที่ควรเก็บไว้

- `AGENTS.md` — rule สำหรับ AI agents
- `IMPROVEMENT_PLAN.md` — แผนพัฒนา (active)
- `README.md`, `CONTRIBUTING.md` — public docs
- `cloudflare/`, `netlify/` — deploy configs (ตรวจว่าใช้อันไหน)

## คำสั่งลบ (รันเมื่อแน่ใจ)

```bash
# Backup เป็น zip ก่อนลบ (option)
git archive -o legacy-snapshot.zip HEAD Backup "Last Version" anti_version scratch กำลังทำ

# จากนั้น
git rm -rf Backup "Last Version" anti_version scratch กำลังทำ Pic
git rm -f code.gs index.html Setting.txt CLAUDE.md
git commit -m "chore: remove legacy scratch folders and files"
```

## ตรวจ deploy config ก่อน

ดูว่าใช้ `cloudflare/` หรือ `netlify/` — ลบอันที่ไม่ใช้:

```bash
# ถ้าใช้ Vercel เท่านั้น (แนะนำ) ลบทั้งสอง
git rm -rf cloudflare netlify
```
