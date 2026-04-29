# GreenShare

ระบบจัดการ "วงแชร์" (rotating savings group) บน LINE LIFF
สร้างวงแชร์, จองมือ, ประมูล (เปียแข่งดอก / ขั้นบันได), ปิดงวด, อัปโหลดสลิป, แอดมินยืนยันการชำระเงิน

## Tech Stack

| Layer         | Technology                                                         |
| ------------- | ------------------------------------------------------------------ |
| Frontend      | Next.js 16 (App Router, JavaScript ค่อย ๆ migrate เป็น TypeScript) |
| Runtime       | Node.js 20+, React 19                                              |
| Auth          | LINE LIFF + ID token verification (server-side)                    |
| Database      | Supabase (PostgreSQL + RLS + Storage)                              |
| Validation    | Zod                                                                |
| Notifications | LINE Messaging API (Flex Messages)                                 |
| Testing       | Vitest                                                             |
| Code quality  | ESLint + Prettier + Husky + lint-staged                            |

## Getting Started

### Prerequisites

- Node.js **20+**
- บัญชี [Supabase](https://supabase.com) (Project + Service Role Key)
- LINE Developers — LIFF App + Messaging channel

### 1. Clone & Install

```bash
git clone <repo-url>
cd greenshare
npm install
```

### 2. Environment Variables

```bash
# คัดลอก template
cp .env.example .env

# กรอกค่าจริงใน .env
```

ดูรายการ ENV ทั้งหมดและคำอธิบายใน `.env.example`

### 3. Database Setup

รัน migrations ตามลำดับ (Supabase Dashboard SQL Editor หรือ CLI):

```bash
# CLI
npx supabase link --project-ref <your-ref>
npx supabase db push

# หรือ paste ทีละไฟล์ใน Dashboard ตามลำดับ:
#   supabase/migrations/00000000000000_baseline... (ใน archive/)
#   supabase/migrations/20260429000001_enable_rls.sql
#   supabase/migrations/20260429000002_id_sequences.sql
#   supabase/migrations/20260429000003_period_assignments.sql
#   supabase/migrations/20260429000004_indexes.sql
```

ดูรายละเอียดใน `supabase/migrations/README.md`

### 4. Run Dev Server

```bash
npm run dev
```

เปิด <http://localhost:3000> — แต่ส่วนใหญ่ของแอปต้องเปิดใน LINE LIFF
ถ้าจะเทสเฉพาะ API ใช้ `curl` ตามตัวอย่างใน `IMPROVEMENT_PLAN.md` หรือ `tests/`

## Scripts

```bash
npm run dev            # Next.js dev server
npm run build          # Production build
npm run start          # Run production server
npm run lint           # ESLint
npm run lint:fix       # ESLint + auto-fix
npm run format         # Prettier write
npm run format:check   # Prettier verify
npm run type-check     # tsc --noEmit
npm run test           # Vitest watch mode
npm run test:ci        # Vitest single run
npm run test:coverage  # Coverage report
```

## Architecture

```
.
├── app/                    Next.js App Router
│   ├── api/action/        Single dispatcher endpoint (จะแตกใน Phase 3)
│   ├── circles/           CRUD วงแชร์
│   ├── members/           จัดการสมาชิก
│   ├── admin/             หน้าแอดมิน
│   ├── profile/, onboarding/
│   └── layout.js, page.js
├── lib/
│   ├── auth.js            LINE ID token verification
│   ├── authHeaders.js     Client helper สำหรับ Bearer header
│   ├── schemas.js         Zod schemas + validateAction()
│   ├── ratelimit.js       In-memory sliding window
│   ├── supabase.js        Supabase client (service role + anon)
│   ├── line.js            LINE Messaging API helpers
│   └── controllers/       Domain logic (member, circle, slip, …)
├── components/            UI components
├── contexts/              React contexts (UserContext)
├── tests/                 Vitest unit tests
├── supabase/migrations/   SQL migrations (timestamped)
└── public/                Static assets
```

### Auth Flow

1. Client โหลด LIFF SDK → `liff.getIDToken()`
2. ทุก API request แนบ `Authorization: Bearer <token>` (ดู `lib/authHeaders.js`)
3. Server verify token กับ `https://api.line.me/oauth2/v2.1/verify`
4. Lookup `members.line_id` → ดึง `role` / `status` จาก DB จริง
5. Controller ใช้ `auth.role` (ไม่ใช่ `data.caller_role`) — ปลอมใน body ไม่ได้

### Security

- ✅ LIFF ID token verification ฝั่ง server
- ✅ Zod input validation ทุก action
- ✅ Rate limit 60 req/min/user/action
- ✅ Generic error messages ใน production (log เต็มฝั่ง server)
- ✅ Supabase RLS เปิดทุกตาราง (FORCE) + revoke privileges
- ✅ CSP, HSTS, X-Content-Type-Options, Referrer-Policy

ดู `IMPROVEMENT_PLAN.md` Phase 1-2 สำหรับรายละเอียด

## Deployment

ใช้ Vercel (แนะนำ — Next.js native)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set ENV vars ทั้งหมดจาก .env ใน Vercel project settings
```

หรือใช้ Netlify / Cloudflare Pages (ต้อง config edge runtime ดู `cloudflare/`, `netlify/`)

## Contributing

ดู `CONTRIBUTING.md`

## Roadmap

ดู `IMPROVEMENT_PLAN.md` — มี 6 Phases:

- ✅ Phase 1 — Security Hardening
- ✅ Phase 2 — Data Integrity
- 🟡 Phase 3 — API Architecture (TypeScript + REST split)
- 🟡 Phase 4 — Developer Experience (กำลังทำ)
- ⬜ Phase 5 — UI/UX Polish
- ⬜ Phase 6 — Observability & Operations

## License

Private project — internal use only
