# Phase 5 — UI/UX Polish Roadmap

## 📊 สถานะปัจจุบัน

### ปัญหาที่พบ
- **Inline styles 543 จุด** กระจายทั่วทุกหน้า → maintain ยาก, theme เปลี่ยนทีต้องไล่แก้
- **Glassmorphism CSS** ใน `app/globals.css` (486 บรรทัด) ปะปนกับ class utility, button, badge, onboarding-specific styles
- **ไม่มี component library** — ปุ่ม, modal, input ถูกเขียนซ้ำในหลายหน้า
- **Modal ใช้ `confirm()` / `alert()`** native ของ browser — ดูเก่าและไม่ตรง brand
- **Loading state เป็นข้อความ "กำลังโหลด..."** — ไม่มี skeleton
- **Empty state เป็น text เปล่า** ในกล่อง glass-panel
- **Data fetching เป็น `useEffect + fetch`** — ไม่มี cache, refetch on focus, optimistic update
- **Error handling เป็น `alert()`** — ไม่ใช่ toast
- **Form ใช้ controlled state เอง** — ไม่มี validation feedback

### จุดแข็งที่ควรรักษา
- มี design tokens (สี/spacing) ใน `:root` แล้ว
- Color palette สีเขียวพรีเมียมชัดเจน
- มี animation utility (fadeInUp, shake, float) สวยอยู่แล้ว
- Mobile-first layout (max-width 600px) เหมาะกับ LIFF

---

## 🎯 เป้าหมาย Phase 5

ทำให้ UI:
1. **สม่ำเสมอ** — ทุก button/modal/input หน้าตาเดียวกัน
2. **maintainable** — เปลี่ยน theme ที่เดียว ทุกที่ตาม
3. **มีชีวิต** — skeleton, optimistic updates, smooth transitions
4. **เข้าถึงได้** — keyboard navigation, focus rings, ARIA labels (WCAG AA)
5. **เร็ว** — SWR cache + dedupe, ลด re-render

---

## 🛠 Tech Stack ที่จะเพิ่ม

| Tool | เหตุผล |
|---|---|
| **Tailwind CSS v4** | utility-first, JIT, มี design token แบบ class-based |
| **shadcn/ui** | components ที่ copy code มาเป็นของเรา (ไม่ใช่ npm dep), ปรับได้เต็มที่ |
| **Radix UI Primitives** | (ผ่าน shadcn) — accessible modal, dialog, dropdown, toast |
| **lucide-react** | icon set สม่ำเสมอ (แทน emoji) |
| **SWR** | data fetching with cache + revalidation |
| **react-hook-form + zod** | form validation reused เดียวกับ API schemas |
| **sonner** | toast notification (ผ่าน shadcn) |

> ทำไมไม่ใช่ Mantine / MUI / Chakra — เพราะ shadcn ให้เราเป็นเจ้าของโค้ด customize เต็มที่ และ bundle เล็กกว่า

---

## 📅 Roadmap (8 ขั้นตอน)

### Step 1 — Setup Tailwind v4 + design tokens (~30 นาที)
- ติดตั้ง `tailwindcss@4`, `@tailwindcss/postcss`
- สร้าง `app/globals.css` ใหม่ใช้ `@theme` directive
- ย้าย CSS variables (--primary, --glass-bg, ...) เป็น Tailwind tokens
- เก็บ `globals.css` เก่าไว้ใน `.legacy.css` ระหว่าง migrate
- **Deliverable:** `npm run dev` ยังเปิดได้, UI ยังหน้าตาเดิม, แต่ Tailwind utility class ใช้ได้

### Step 2 — Setup shadcn/ui + base components (~45 นาที)
- รัน `npx shadcn init` (theme: green, baseColor: emerald)
- เพิ่ม components: `button`, `input`, `label`, `card`, `dialog`, `toast`, `skeleton`, `badge`, `avatar`, `separator`
- ติดตั้ง `lucide-react`, `sonner`
- เพิ่ม `<Toaster />` ใน `app/layout.js`
- **Deliverable:** มี component library พร้อมใช้

### Step 3 — Migrate ClientLayout + Header + BottomNav (~1 ชม.)
- เขียน `components/layout/AppHeader.tsx` ใหม่ด้วย shadcn `Avatar`, `Button`
- เขียน `components/layout/BottomNav.tsx` ด้วย Tailwind + lucide icons (แทน emoji)
- **Deliverable:** layout หลักใหม่ทุกหน้าเห็น

### Step 4 — Migrate หน้า Home (`app/page.js`) (~1 ชม.)
- ใช้ `Card`, `Button` แทน `glass-panel` + inline style
- เพิ่ม `Skeleton` ตอนโหลด circles
- เพิ่ม empty state component สวยๆ
- ใช้ SWR fetch circles + auto refetch
- **Deliverable:** หน้า Home ใหม่หมด ลด inline style เหลือ 0

### Step 5 — Migrate Onboarding + Auth flow (~45 นาที)
- ใช้ `react-hook-form` + zod schemas (reuse จาก `lib/schemas.js`)
- Role selection ใช้ `RadioGroup` ของ shadcn
- Submit feedback ใช้ `toast`
- **Deliverable:** form validate inline ดีขึ้น

### Step 6 — Migrate Circles (list + detail + create) (~2 ชม.)
- หน้ายากที่สุด — `app/circles/[id]/page.js` 970+ บรรทัด
- แตกเป็น sub-components: `CircleHeader`, `CircleStats`, `BiddingTable`, `SlipUploader`, `MemberList`, etc.
- Modal ทุกตัวใช้ shadcn `Dialog`
- Confirm action ใช้ `AlertDialog` แทน `confirm()`
- **Deliverable:** หน้า circle อ่านง่าย แตก components ได้

### Step 7 — Migrate Admin + Members + Profile (~1.5 ชม.)
- Admin dashboard ใช้ `Tabs`, `Table` ของ shadcn
- Profile form เหมือน onboarding (RHF + zod)
- Members list ใช้ `Card` + filter
- **Deliverable:** หน้าหลังบ้านสะอาด

### Step 8 — Polish + Animations + a11y audit (~45 นาที)
- เพิ่ม page transitions (framer-motion ถ้าต้องการ)
- ตรวจ keyboard nav, focus ring สี primary
- ทดสอบ dark mode (Tailwind class strategy)
- Lighthouse audit > 90 ทั้ง 4 categories
- **Deliverable:** ผ่าน WCAG AA, fast load

---

## 🧪 หลักการทำงาน

### Branch strategy
- ทำใน branch `feat/phase-5-ui` แยกจาก main
- Merge หลังจบทุก step (หรือหลังแต่ละ step ก็ได้ถ้าอยาก deploy ทดสอบ)

### Migration discipline
- **ไม่ลบ legacy CSS ทันที** — Tailwind class ใหม่ + class เก่าอยู่ด้วยกันก่อน
- migrate ทีละหน้า ไม่ทำพร้อมกันทุกหน้า → ลดความเสี่ยง
- ทุก step ต้อง `npm run build` ผ่าน + LIFF เปิดได้จริง
- เก็บ `globals.legacy.css` ไว้จนจบ Step 8 ค่อยลบ

### Testing
- Unit test สำหรับ form validators (RHF + zod)
- E2E test optional (Playwright) — ถ้าเหลือเวลา

---

## 📦 ผลที่คาดว่าจะได้

| Metric | ก่อน | หลัง |
|---|---|---|
| Inline styles | 543 จุด | < 20 จุด (เฉพาะ dynamic) |
| `app/globals.css` | 486 บรรทัด | < 50 บรรทัด |
| Lines of UI code (`app/`) | ~5000 | ~3500 (ลด 30%) |
| Components reusable | 1 (`ClientLayout`) | 15+ |
| Lighthouse Accessibility | ? | 95+ |
| First Contentful Paint | ? | < 1.5s |

---

## ⏱ ประมาณเวลา

- **เร็วสุด:** ~8 ชม. (ทำต่อกันรวด)
- **เหมาะสม:** 2-3 sessions × 3 ชม.
- **เริ่มเห็นผลทันที:** หลัง Step 3 (~2 ชม. แรก)

---

## 🚦 จุด checkpoint สำหรับ commit

แต่ละ step = 1 commit + push → Vercel deploy → ทดสอบจริง LIFF → ถ้าโอเคไป step ถัดไป

