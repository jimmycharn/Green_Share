# GreenShare — แผนปรับปรุงโปรเจค

> เอกสารนี้ใช้ติดตามสถานะการปรับปรุงโปรเจค GreenShare ให้เป็นมืออาชีพ
> อัปเดตสถานะโดยเปลี่ยน `[ ]` → `[x]` เมื่อทำเสร็จ และเพิ่มวันที่ + หมายเหตุ

**สร้างเมื่อ:** 2026-04-29
**อัปเดตล่าสุด:** 2026-04-29 (Phase 1-2 เสร็จ, Phase 4 เกือบเสร็จ)

---

## สรุปลำดับ Phase

| Phase | หัวข้อ               | เหตุผล                                 | สถานะ               |
| ----- | -------------------- | -------------------------------------- | ------------------- |
| 1     | Security Hardening   | ช่องโหว่ปัจจุบันรุนแรง (ปลอม role ได้) | ✅ เสร็จ            |
| 2     | Data Integrity       | แก้ bug ที่จะเกิดเมื่อมี user จริง     | ✅ เสร็จ            |
| 3     | API Architecture     | วางรากฐานก่อนโตต่อ                     | ⬜ ยังไม่เริ่ม      |
| 4     | Developer Experience | ทำให้ทีม/ตัวเองทำงานต่อได้เร็ว         | 🟡 เกือบเสร็จ (5/6) |
| 5     | UI/UX Polish         | ยกระดับ product ให้ดูมืออาชีพ          | ⬜ ยังไม่เริ่ม      |
| 6     | Observability & Ops  | เห็น production issue ได้ทันที         | ⬜ ยังไม่เริ่ม      |

สัญลักษณ์สถานะ: ⬜ ยังไม่เริ่ม | 🟡 กำลังทำ | ✅ เสร็จแล้ว | ⏭️ ข้าม

---

## Phase 1 — Security Hardening (วิกฤติ)

- [x] **1. LIFF ID Token Verification ฝั่งเซิร์ฟเวอร์** ✅ 2026-04-29
  - สร้าง `lib/auth.js` — verify ผ่าน `https://api.line.me/oauth2/v2.1/verify` + lookup DB
  - สร้าง `lib/authHeaders.js` — client helper แนบ `Authorization: Bearer <idToken>`
  - แก้ `app/api/action/route.js` — auth required ทุก action ยกเว้น `register`/`check_user`, override `caller_id`/`caller_role`/`member_id` จาก verified session
  - แก้ 9 ไฟล์ frontend (page.js, profile, members, admin, circles/view, circles/create, circles/[id], contexts/UserContext, onboarding) ให้ใช้ `authHeaders()`
  - **หมายเหตุ:** controllers ยังไม่ถูก refactor ให้รับ `auth` object ตรง (Phase ต่อไป) — ตอนนี้ route.js override field ใน `data` แทน

- [x] **2. Input Validation ด้วย Zod** ✅ 2026-04-29
  - เพิ่ม `zod` ใน `package.json` (ต้องรัน `npm install`)
  - สร้าง `lib/schemas.js` มี schema 30+ action พร้อม `validateAction()` helper
  - route.js validate ทุก request ก่อนเข้า controller → คืน 400 พร้อม field error

- [x] **3. ซ่อน Internal Error Messages** ✅ 2026-04-29
  - route.js log error เต็มฝั่ง server, ส่ง generic message ให้ client ใน production
  - Dev mode ยังคงเห็นรายละเอียดเพื่อ debug

- [x] **4. Rate Limiting** ✅ 2026-04-29 (in-memory; upgrade ภายหลัง)
  - สร้าง `lib/ratelimit.js` — sliding window 60 req/min per (user+action)
  - Key fallback: auth user id → lineId → x-forwarded-for
  - **TODO:** ย้ายไปใช้ Upstash Redis เมื่อ deploy บน multi-instance

- [x] **5. เปิด Supabase RLS** ✅ 2026-04-29 (เขียน migration; ต้อง apply เอง)
  - สร้าง `supabase/migrations/20260429000001_enable_rls.sql`
  - เปิด + FORCE RLS ทุกตาราง + revoke anon/authenticated privileges
  - **Action item:** รัน migration นี้บน Supabase (`supabase db push` หรือ paste ใน SQL editor)
  - **TODO:** พิจารณาเลิก export `supabase` (anon key) จาก `lib/supabase.js` ถ้า client ไม่ใช้

- [x] **6. Security Headers** ✅ 2026-04-29
  - แก้ `next.config.mjs`: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
  - `poweredByHeader: false`, `reactStrictMode: true`
  - CSP frame-ancestors อนุญาต `liff.line.me` / `*.line.me` เพื่อรองรับ LIFF iframe

---

## Phase 2 — Data Integrity

- [x] **7. แก้ Race Condition: ID Generation** ✅ 2026-04-29
  - Migration `20260429000002_id_sequences.sql` — SEQUENCE + `next_member_id()` / `next_circle_id()` เป็น DEFAULT ของ PK
  - ลบ `generateNextId` ใน `lib/controllers/circle.js` + `lib/controllers/member.js`
  - Controllers ใช้ `.select('id').single()` ดึง id ที่ DB สร้างกลับมา
  - Sequence setval ให้ตรงกับ max id ปัจจุบัน

- [x] **8. แก้ Race Condition: Join Circle** ✅ 2026-04-29
  - ลบ pre-check ใน `joinCircle`, insert ตรง → จับ `error.code === '23505'` แล้วคืนข้อความภาษาไทย

- [x] **9. Normalize Schema — ย้าย JSON ออกจาก `notify_message`** ✅ 2026-04-29
  - Migration `20260429000003_period_assignments.sql`:
    - ตารางใหม่ `circle_period_assignments (circle_id, period PK, member_id)` + RLS + index
    - คอลัมน์ใหม่ `circles.current_period_bidding_closed BOOLEAN`
    - Data migration — แปลง `notify_message` JSON + `period_extra='CLOSED_X'` เก่าไปยังเครื่องใหม่
  - Server: `createCircle`, `closeBidding`, `closePeriod`, `updateCircleSettings`, `getCircleDetail` อ่าน/เขียนตารางใหม่
  - Client: `app/circles/[id]/page.js` ใช้ helpers `getAssignedTo(period)` + `isBiddingClosed(period)` — ลบ `JSON.parse(notify_message)` ทั้ง 6 จุด + `period_extra` 3 จุด
  - **หมายเหตุ:** คอลัมน์เก่า `notify_message` / `period_extra` ยังไม่ถูกลบ — คงไว้เผื่อ rollback จะลบภายหลัง

- [x] **10. เพิ่ม Database Indexes** ✅ 2026-04-29
  - Migration `20260429000004_indexes.sql` — index ครบทั้งที่เสนอ + เพิ่ม `circles.status`, `banks.member_id`, `members.line_id`

- [x] **11. รวม SQL Migrations** ✅ 2026-04-29 (ย้ายไฟล์เดิมเข้า archive; ยังไม่ยุบรวมเป็น baseline เดียว)
  - ย้าย `supabase_schema.sql`, `update_schema_v2.sql`, `upgrade_db.sql` → `supabase/migrations/archive/`
  - เพิ่ม `supabase/migrations/README.md` อธิบายลำดับ + วิธีรัน
  - **TODO:** เมื่อพร้อม reset environment ค่อยรวม baseline เป็น migration เดียว

---

## Phase 3 — API Architecture

- [ ] **12. Migrate เป็น TypeScript**
  - เพิ่ม `tsconfig.json`
  - Gen types: `supabase gen types typescript > types/database.ts`
  - แปลงทีละโฟลเดอร์: `lib/` → `app/api/` → `contexts/` → `components/` → `app/*/page`

- [ ] **13. แตก Mega API `/api/action` เป็น RESTful Routes**
  - `GET/POST /api/circles`, `GET/PATCH/DELETE /api/circles/[id]`
  - `POST /api/circles/[id]/bids`, `/join`, `/close-bidding`, `/close-period`, `/payout`
  - `GET/POST /api/members`, `PATCH /api/members/[id]`
  - `GET /api/admin/dashboard`, `POST /api/admin/houses/[id]/approve`
  - `POST /api/banks`, `PATCH /api/banks/[id]`

- [ ] **14. LINE Notifications เป็น Background**
  - เปลี่ยน sync loop ที่ `lib/controllers/circle.js:90-101` → `Promise.allSettled` หรือ queue
  - พิจารณา Upstash QStash / Supabase Edge Functions

- [ ] **15. Structured Logging**
  - ใช้ `pino` หรือ platform log
  - แทน `console.log/error` ทุกจุด

---

## Phase 4 — Developer Experience

- [~] **16. ล้าง Repository** 🟡 2026-04-29 (เขียน checklist; ยังไม่ลบจริง)
  - สร้าง `CLEANUP.md` ระบุไฟล์/โฟลเดอร์ที่ควรลบ + คำสั่งพร้อมรัน
  - **Action item:** ตรวจ + ตัดสินใจลบเองตาม `CLEANUP.md`

- [x] **17. เขียน README + `.env.example` ใหม่** ✅ 2026-04-29
  - README ใหม่: tech stack, setup, scripts, architecture, auth flow, security, deploy
  - `.env.example` มีครบทุก var (ทำไปตั้งแต่ Phase 1)
  - เพิ่ม `CONTRIBUTING.md` — workflow, code style, conventional commits

- [x] **18. Code Quality Tools** ✅ 2026-04-29 (ยกเว้น commitlint — ไว้ภายหลัง)
  - Prettier (`.prettierrc.json` + `.prettierignore`) + `.editorconfig`
  - ESLint (`eslint.config.mjs`) — เพิ่ม rules: `eqeqeq`, `prefer-const`, `no-var`, `no-console`, etc + `eslint-config-prettier`
  - Husky (`.husky/pre-commit`) + lint-staged (`.lintstagedrc.json`)
  - **Commitlint:** ยังไม่ได้ติดตั้ง — ใช้ Conventional Commits ผ่าน CONTRIBUTING.md (manual) ไปก่อน

- [~] **19. Unit & Integration Tests** 🟡 2026-04-29 (เริ่มแล้ว — ยังไม่ 50%)
  - Setup Vitest (`vitest.config.mjs`) + coverage v8
  - Tests: `tests/schemas.test.js`, `tests/ratelimit.test.js`
  - เพิ่ม `_resetRateLimitStore()` helper ใน `lib/ratelimit.js` สำหรับ test isolation
  - **TODO:** controller tests — ต้องรอ Phase 3 refactor (เพื่อ injection ของ Supabase) ถึงจะ mock ง่าย
  - **TODO:** React Testing Library + component tests

- [ ] **20. E2E Tests (Playwright)** — ยังไม่เริ่ม (LIFF env ต้อง mock LINE token — ทำตอน Phase 3 จบแล้ว)
  - Flow หลัก: onboarding → create circle → join → bid → close period

- [x] **21. CI/CD (GitHub Actions)** ✅ 2026-04-29 (workflow พร้อม; deploy preview ไว้หลัง)
  - `.github/workflows/ci.yml` — format-check + lint + type-check + test + build ทุก PR/push
  - **TODO:** เชื่อม Vercel preview deployment (ตั้งใน Vercel project settings ไม่ต้อง YAML)

---

## Phase 5 — UI/UX Polish

- [ ] **22. Tailwind CSS + shadcn/ui + lucide-react**
  - แทน inline styles ใน `app/page.js`, `components/ClientLayout.js`
  - แทน emoji icons (🏠📊👥🔔⚙️🗑️) ด้วย `lucide-react`

- [ ] **23. Internal Component Library**
  - `components/ui/` — Button, Card, Badge, Modal, Toast, Input, Select
  - `components/circle/` — CircleCard, BidForm, PlayerList, PeriodTimeline

- [ ] **24. แทน `alert()` / `confirm()` ด้วย Modal/Toast**
  - `sonner` (toast) + shadcn Dialog
  - จุดใช้: `app/page.js:38,49,51` และหน้า circles อื่นๆ

- [ ] **25. `next/image` + LIFF npm package**
  - แทน `<img>` ที่ `components/ClientLayout.js:48`
  - แทน `<Script>` LIFF CDN ที่ `contexts/UserContext.js:67-71` ด้วย `@line/liff`

- [ ] **26. ใช้ `useRouter` แทน `window.location`**
  - แก้ `contexts/UserContext.js:43`

- [ ] **27. Loading / Error / Empty States สม่ำเสมอ**
  - `<LoadingSpinner>`, `<ErrorBoundary>`, `<EmptyState>` ใช้ร่วม
  - ใช้ Next.js `loading.js` + `error.js` ประจำ route segment

- [ ] **28. Data Fetching ด้วย SWR / TanStack Query**
  - แทน `fetch` + `useEffect` กระจาย (ตัวอย่าง `app/page.js:12-33`)
  - ได้ caching, revalidation, optimistic update

---

## Phase 6 — Observability & Operations

- [ ] **29. Error Tracking (Sentry)**
  - `@sentry/nextjs` ส่ง error จาก client + server + edge

- [ ] **30. Health Check & Monitoring**
  - `/api/health` (ping DB + LINE API)
  - Uptime monitoring (UptimeRobot / BetterStack)

- [ ] **31. Analytics (optional)**
  - Vercel Analytics หรือ PostHog

- [ ] **32. LINE Webhook Signature Verification**
  - ใช้ `@line/bot-sdk` `validateSignature` ทุก webhook handler (ถ้ามี)

---

## Changelog / Progress Notes

ใช้ส่วนนี้จดความคืบหน้าและการตัดสินใจสำคัญ

| วันที่     | รายการ                   | หมายเหตุ                                                                                                                                                                                        |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-29 | สร้างแผน                 | วิเคราะห์โปรเจคเบื้องต้นเสร็จ                                                                                                                                                                   |
| 2026-04-29 | Phase 1 (1-6) เสร็จ      | Security hardening ครบทั้ง 6 ข้อ — auth, validation, rate limit, RLS migration, security headers                                                                                                |
| 2026-04-29 | Phase 2 (7-11) เสร็จ     | Data integrity — DB sequences แทน query-then-insert, unique-violation แทน check-then-insert, แยก assignments เป็นตาราง, เลิก `period_extra` hack, เพิ่ม indexes, ย้าย SQL เก่าเข้า archive      |
| 2026-04-29 | Phase 4 (17,18,21) เสร็จ | DX — TypeScript baseline (allowJs), Prettier+EditorConfig, ESLint stricter, Husky+lint-staged, Vitest infra + 2 test suites, GitHub Actions CI, README+CONTRIBUTING+CLEANUP ใหม่                |
|            | **ต้องทำหลัง Phase 4**   | รัน `npm install` (devDeps ใหม่: typescript, prettier, husky, lint-staged, vitest, @vitest/coverage-v8, eslint-config-prettier) → `npx husky init` หรือ `npm run prepare` เพื่อ enable git hook |
|            | Phase 4 partial          | #16 (cleanup) — เขียนไว้ใน CLEANUP.md รอ user ตัดสินใจลบ; #19 — มี infra+2 tests ยังไม่ถึง controllers; #20 — ยังไม่เริ่ม (รอ Phase 3)                                                          |
|            | **ต้องทำหลัง Phase 2**   | Apply migrations ใหม่ 3 ตัว (`20260429000002`, `20260429000003`, `20260429000004`) ตามลำดับบน Supabase                                                                                          |
|            | **ต้องทำหลัง merge**     | (1) `npm install` เพื่อดึง `zod` (2) apply migration `20260429000001_enable_rls.sql` บน Supabase (3) เพิ่ม `LINE_LOGIN_CHANNEL_ID` ใน `.env` (หรือปล่อยให้ derive จาก LIFF_ID)                  |
|            | Pre-existing bug         | `app/onboarding/page.js:303` มี duplicate `style` attribute (ไม่เกี่ยว Phase 1, แนะนำแก้ตอน Phase 5)                                                                                            |
|            |                          |                                                                                                                                                                                                 |
