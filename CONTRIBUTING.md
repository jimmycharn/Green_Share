# Contributing to GreenShare

ขอบคุณที่จะช่วยพัฒนา ! เอกสารนี้สรุปแนวทางการทำงานในโปรเจคนี้

## Workflow

1. สร้าง branch ใหม่จาก `main`
   ```bash
   git checkout -b feat/xxx     # ฟีเจอร์ใหม่
   git checkout -b fix/xxx      # แก้บั๊ก
   git checkout -b refactor/xxx # ปรับโครงสร้าง
   git checkout -b docs/xxx     # เอกสาร
   ```
2. แก้โค้ด — `pre-commit` hook จะรัน `lint-staged` (ESLint + Prettier) อัตโนมัติ
3. รันเทสในเครื่อง:
   ```bash
   npm run lint
   npm run type-check
   npm run test:ci
   npm run build
   ```
4. Push + เปิด PR
5. CI (`.github/workflows/ci.yml`) รัน lint + test + build อัตโนมัติ

## Code Style

- **Formatter:** Prettier (`.prettierrc.json`) — รันอัตโนมัติบน save (ถ้าตั้งใน editor)
- **Linter:** ESLint (`eslint.config.mjs`) — รันก่อน commit
- **Indent:** 2 spaces (LF, UTF-8 — ดู `.editorconfig`)
- **Imports:** absolute path ผ่าน alias `@/` (เช่น `@/lib/auth`)
- **TypeScript:** เปิด `allowJs: true` แล้ว — เพิ่มไฟล์ใหม่เป็น `.ts`/`.tsx` ได้เลย; migrate ของเก่าทีละไฟล์

## Commits

ใช้ [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): สั้น ๆ
fix(scope): สั้น ๆ
refactor(scope): สั้น ๆ
docs: ...
chore: ...
test: ...
```

ตัวอย่าง:

```
feat(circles): เพิ่ม endpoint POST /api/circles/:id/close-period
fix(auth): handle expired LIFF token gracefully
refactor(controllers): pass auth as first arg
```

## Testing

### Unit tests (Vitest)

ไฟล์ test อยู่ที่ `tests/*.test.js` หรือ co-located `lib/**/*.test.js`

```bash
npm run test              # watch mode
npm run test:ci           # single run (ใน CI)
npm run test:coverage     # generate coverage HTML
```

### Manual API testing

ใช้ตัวอย่าง curl ใน `IMPROVEMENT_PLAN.md` (ทดสอบ Phase 1-2)

## Database Changes

1. สร้าง migration ใหม่ใน `supabase/migrations/`
2. ตั้งชื่อ `YYYYMMDDhhmmss_description.sql` (ตามลำดับ timestamp)
3. ทดสอบบน local/staging Supabase ก่อน push
4. อัปเดต `supabase/migrations/README.md` ถ้ามี migration ที่ต้องอธิบายเพิ่ม

⚠️ **ห้ามแก้ migration ที่ apply ไปแล้ว** — สร้าง migration ใหม่เพื่อแก้

## Security

- **อย่า commit `.env`** (อยู่ใน `.gitignore`)
- **อย่า log secrets** — ใช้ environment variables เท่านั้น
- **Service role key** ใช้เฉพาะฝั่ง server (`lib/supabase.js` `supabaseAdmin`)
- ถ้าเจอช่องโหว่ — เปิด issue เป็น `private` หรือแจ้ง maintainer ตรง ๆ ก่อน

## ขอบเขตที่ยังไม่ปิด

ดู `IMPROVEMENT_PLAN.md` — รายการ TODO ทั้ง 6 phases
ก่อนเริ่มงานใหญ่ แนะนำ comment ใน issue/PR เพื่อ align scope กับ maintainer
