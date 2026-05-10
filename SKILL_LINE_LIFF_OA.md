# Skill Guide: Building a Next.js App with LINE LIFF + LINE OA

> เอกสารนี้สรุปแนวทาง pattern และ gotcha ที่ได้จากการสร้างแอป GreenShare
> ใช้เป็นไกด์เริ่มต้นสำหรับโปรเจกต์ใหม่ที่ใช้ LINE LIFF และ LINE OA

---

## 1. Stack พื้นฐาน

| Layer           | เทคโนโลยี                              |
| --------------- | -------------------------------------- |
| Frontend        | Next.js (App Router)                   |
| Backend         | Next.js API Route + Controller pattern |
| Database        | Supabase (PostgreSQL)                  |
| Auth / Identity | LINE LIFF                              |
| Notifications   | LINE Messaging API (OA Push)           |
| UI              | TailwindCSS + custom CSS               |

---

## 2. LINE LIFF Integration

### 2.1 ติดตั้ง SDK

```bash
# ไม่ต้อง npm install liff — ใช้ CDN script แทน
# เพราะ liff package มี side-effect ตอน SSR
```

### 2.2 โหลด LIFF SDK — ใช้ `strategy="afterInteractive"` เสมอ

```tsx
// contexts/UserContext.js
import Script from 'next/script';

<Script
  src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js"
  strategy="afterInteractive" // ❌ อย่าใช้ beforeInteractive — จะทำให้ page โหลดช้ามาก
  onLoad={handleScriptLoad}
/>;
```

### 2.3 Init LIFF และดึง Profile

```js
// ฟัง event script onLoad แล้วค่อย init
const handleScriptLoad = async () => {
  await window.liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    return;
  }
  const profile = await window.liff.getProfile();
  // profile.userId   → LINE UID (ใช้ push message)
  // profile.displayName
  // profile.pictureUrl
};
```

### 2.4 Environment Variables ที่ต้องมี

```env
NEXT_PUBLIC_LIFF_ID=1234567890-xxxxxxxx   # LIFF ID จาก LINE Developers Console
LINE_CHANNEL_ACCESS_TOKEN=xxx             # Long-lived token (Messaging API channel)
ADMIN_LINE_UID=Uxxxxxxxxxx               # LINE UID ของ admin หลัก (รับแจ้งเตือน)
```

### 2.5 Deep Link กลับมาที่ app (ส่งผ่าน LINE OA)

```js
// รูปแบบ LIFF URL พร้อม path
const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circleId}`;
// เมื่อ user กดลิงก์ใน LINE → เปิด LIFF app ตรงหน้า /circles/:id
```

---

## 3. Database — เชื่อม LINE User กับ App User

### 3.1 ตาราง members (ตัวอย่าง)

```sql
create table members (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  line_id     text unique,   -- LINE UID จาก liff.getProfile().userId
  picture_url text,
  role        text default 'MEMBER',  -- 'SUPERADMIN' | 'ADMIN' | 'MEMBER'
  created_at  timestamptz default now()
);
```

### 3.2 Flow การสมัคร / Login

```
1. LIFF init → ได้ profile.userId (line_id)
2. เรียก API ด้วย line_id → ค้นหา member ในฐานข้อมูล
3. ถ้าไม่เจอ → สร้าง member ใหม่ (หรือให้กรอกข้อมูลเพิ่ม)
4. เก็บ member object ใน Context ทั้ง app
```

---

## 4. LINE OA — ส่ง Push Notification

### 4.1 ฟังก์ชัน pushMessage พื้นฐาน

```js
// lib/line.js
const LINE_API = 'https://api.line.me/v2/bot/message/push';

export async function pushMessage(to, messages) {
  if (!to || !messages?.length) return;
  const res = await fetch(LINE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error('LINE push error:', err);
  }
}
```

### 4.2 Flex Message — โครงสร้างพื้นฐาน

```js
const flexMessage = {
  type: 'flex',
  altText: 'ข้อความแสดงในหน้าต่างการแจ้งเตือน (รองรับ emoji)',
  contents: {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#10b981',
      contents: [{ type: 'text', text: '🔔 หัวข้อ', weight: 'bold', color: '#ffffff', size: 'md' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'ชื่อหัวข้อ', weight: 'bold', size: 'lg', wrap: true },
        {
          type: 'box',
          layout: 'baseline',
          spacing: 'sm',
          contents: [
            { type: 'text', text: 'Label', color: '#aaaaaa', size: 'sm', flex: 2 },
            { type: 'text', text: 'Value', color: '#1e293b', size: 'sm', flex: 5, weight: 'bold' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#10b981',
          action: {
            type: 'uri',
            label: 'เปิดแอป',
            uri: liffUrl, // deep link กลับมาที่ LIFF app
          },
        },
      ],
    },
  },
};

await pushMessage(lineUserId, [flexMessage]);
```

### 4.3 ส่งหาสมาชิกหลายคน — Deduplicate ก่อนเสมอ

```js
const sentIds = new Set();
for (const member of members) {
  const lineId = member.line_id;
  if (!lineId || sentIds.has(lineId)) continue; // ข้าม duplicate
  sentIds.add(lineId);
  await pushMessage(lineId, [message]);
}
```

> ⚠️ LINE Messaging API ไม่มี "multicast to list" ฟรีในทุก plan  
> ถ้าต้องการส่งพร้อมกันหลายคน ใช้ `/message/multicast` แทน (ส่ง array ของ `to`)

---

## 5. Architecture Pattern — API Route + Controller

### 5.1 Single Action Endpoint

```
POST /api/action
Body: { action: "action_name", ...data }
```

```js
// app/api/action/route.js
import { getCircleDetail, joinCircle, notifyBidStart } from '@/lib/controllers/circle';

const HANDLERS = {
  get_circle_detail: getCircleDetail,
  join_circle: joinCircle,
  notify_bid_start: notifyBidStart,
  // ...
};

export async function POST(req) {
  const { action, ...data } = await req.json();
  const handler = HANDLERS[action];
  if (!handler)
    return Response.json({ status: 'error', message: 'Unknown action' }, { status: 400 });
  try {
    const result = await handler(data);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
```

### 5.2 Controller Pattern (lib/controllers/circle.js)

```js
export async function notifyBidStart(data) {
  // 1. Guard — ตรวจสิทธิ์ก่อนเสมอ
  if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role))
    return { status: 'error', message: 'ไม่มีสิทธิ์' };

  // 2. ดึงข้อมูลที่ต้องการ
  const { data: circle } = await supabaseAdmin.from('circles').select(...);

  // 3. Logic หลัก
  for (const member of members) { ... }

  // 4. Return ผลลัพธ์ในรูปแบบ { status, message, ...data }
  return { status: 'success', message: 'เสร็จแล้ว' };
}
```

### 5.3 Frontend callAction helper

```js
// lib/callAction.js
export async function callAction(action, data) {
  const res = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}
```

---

## 6. Supabase Patterns

### 6.1 ใช้ supabaseAdmin (service role) บน server เท่านั้น

```js
// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// Client-side: ใช้ anon key (จำกัดด้วย RLS)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Server-side only: bypass RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

### 6.2 Pattern: Parallel fetch

```js
const [circleRes, membersRes, bidsRes] = await Promise.all([
  supabaseAdmin.from('circles').select('*').eq('id', circleId).single(),
  supabaseAdmin.from('circle_players').select('*, members(line_id)').eq('circle_id', circleId),
  supabaseAdmin.from('bids').select('*').eq('circle_id', circleId),
]);
```

---

## 7. UI State ที่ต้อง Persist ข้าม Navigation

ถ้า state บางตัวต้องคงอยู่แม้ user navigate ออกไปแล้วกลับมา ให้ใช้ `localStorage`:

```tsx
// บันทึก
localStorage.setItem(`bid_notified_${circleId}_${period}`, '1');
setState((prev) => new Set([...prev, period]));

// โหลดกลับตอน mount
useEffect(() => {
  if (!circleId) return;
  const restored = new Set<number>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`bid_notified_${circleId}_`)) {
      const p = parseInt(key.replace(`bid_notified_${circleId}_`, ''), 10);
      if (p > 0) restored.add(p);
    }
  }
  if (restored.size > 0) setState(restored);
}, [circleId]);
```

---

## 8. Gotchas และ Lessons Learned

### ❌ LIFF SDK — อย่าใช้ `beforeInteractive`

```tsx
// ❌ ทำให้ page หยุดรอ CDN script ก่อน render ทุกอย่าง → โหลดช้ามาก
strategy = 'beforeInteractive';

// ✅ โหลดหลัง hydration → page แสดงผลทันที
strategy = 'afterInteractive';
```

### ❌ Status field ต้องสอดคล้องกัน

```js
// ถ้า insert ด้วย status: 'LIVE'
// ต้อง query ด้วย .eq('status', 'LIVE') ไม่ใช่ 'ACTIVE'
// ตรวจสอบ insert code เสมอก่อนเขียน query filter
```

### ❌ ส่ง Push Message ต้องมี `line_id` ในฐานข้อมูล

```
ถ้าสมาชิกไม่เคย login ผ่าน LIFF → ไม่มี line_id → ส่งไม่ได้
แก้: บังคับ login ผ่าน LIFF ก่อนใช้ฟีเจอร์ใดๆ
```

### ✅ Flex Message — ต้องมี `altText` เสมอ

```js
// altText คือข้อความที่แสดงใน notification banner และ chat list preview
// ถ้าไม่ใส่ → LINE จะแสดง "[Flex Message]" แทน → ดูไม่เป็นมืออาชีพ
altText: '🔔 เปิดประมูลแล้ว! ชื่อวง งวดที่ 2';
```

### ✅ Deep Link ใน Flex Message ต้องเป็น LIFF URL

```js
// ❌ https://yourdomain.com/circles/123 → เปิด browser ปกติ ไม่ใช่ LIFF
// ✅ https://liff.line.me/LIFF_ID/circles/123 → เปิด LIFF app ใน LINE
const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/path`;
```

### ✅ Role Guard ใน Controller — ทำทั้ง frontend และ backend

```js
// Frontend: ซ่อน/disable ปุ่มตาม role
// Backend: ตรวจสิทธิ์ทุก controller ก่อนทำงาน (อย่าเชื่อ client)
if (!['SUPERADMIN', 'ADMIN'].includes(data.caller_role))
  return { status: 'error', message: 'ไม่มีสิทธิ์' };
```

### ✅ Random Selection — จัดการทุก case

```
- ไม่มี bid เลย        → สุ่มจาก eligible members (มือยังไม่ตาย)
- มี bid เดียว         → winner ชัดเจน ไม่ต้องสุ่ม
- เสมอ (amount+time)  → สุ่มเฉพาะในกลุ่มที่เสมอกัน
```

---

## 9. Checklist ก่อน Launch

- [ ] `NEXT_PUBLIC_LIFF_ID` ตั้งค่าถูกต้องใน `.env`
- [ ] `LINE_CHANNEL_ACCESS_TOKEN` เป็น token ของ Messaging API channel (ไม่ใช่ Login channel)
- [ ] LIFF app URL ตั้งไว้ที่ domain จริงใน LINE Developers Console
- [ ] `strategy="afterInteractive"` สำหรับ LIFF SDK script
- [ ] สมาชิกทุกคน login ผ่าน LIFF อย่างน้อยครั้งเดียว (เพื่อเก็บ `line_id`)
- [ ] ทดสอบ push message กับบัญชีจริงก่อน deploy
- [ ] ตรวจ status field ใน DB ว่าตรงกับ query filter ทุกจุด
- [ ] LIFF deep link ทดสอบว่าเปิดหน้าที่ถูกต้อง
