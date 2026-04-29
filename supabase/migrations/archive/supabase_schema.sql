-- Database Schema for Green Share App (Next.js + Supabase Migration)

-- 1. Members
CREATE TABLE public.members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    line_id TEXT UNIQUE,
    phone TEXT,
    bank_account TEXT,
    role TEXT DEFAULT 'MEMBER', -- 'MEMBER', 'ADMIN', 'MANAGER', 'SUPERADMIN'
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'ACTIVE', 'INACTIVE'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Circles (วงแชร์)
CREATE TABLE public.circles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    creator_id TEXT REFERENCES public.members(id), -- ท้าวแชร์ (ใครเป็นคนสร้างวง)
    line_group_url TEXT, -- ลิงก์กลุ่ม LINE สำหรับให้ลูกวงกดเข้าตาม
    total_amount NUMERIC NOT NULL,
    amount_per_hand NUMERIC NOT NULL,
    total_hands INTEGER NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'OPEN', -- 'OPEN', 'ACTIVE', 'CLOSED'
    current_period INTEGER DEFAULT 1,
    
    -- Period settings
    period_type TEXT DEFAULT 'WEEKLY',
    period_value TEXT DEFAULT 'MON',
    period_extra TEXT,
    period_interval INTEGER DEFAULT 7,
    
    bid_start_time TIME DEFAULT '12:00:00',
    bid_end_time TIME DEFAULT '18:00:00',
    notify_hours INTEGER DEFAULT 24,
    notify_message TEXT,
    
    min_bid NUMERIC DEFAULT 0,
    max_bid NUMERIC DEFAULT 500,
    close_mode TEXT DEFAULT 'MANUAL',
    auto_action TEXT DEFAULT 'NOTIFY',
    next_period_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Circle Players (คนเล่นในแต่ละวง)
CREATE TABLE public.circle_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id TEXT REFERENCES public.circles(id) ON DELETE CASCADE,
    hand_no INTEGER NOT NULL,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    member_name TEXT,
    status TEXT DEFAULT 'LIVE', -- 'LIVE', 'DEAD'
    interest_earned NUMERIC DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(circle_id, hand_no)
);

-- 4. Bids (การประมูลดอก)
CREATE TABLE public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id TEXT REFERENCES public.circles(id) ON DELETE CASCADE,
    period INTEGER NOT NULL,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    bid_amount NUMERIC NOT NULL,
    bid_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(circle_id, period, member_id)
);

-- 5. Slips (หลักฐานการโอนเงิน)
CREATE TABLE public.slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id TEXT REFERENCES public.circles(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    period INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    note TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'PENDING',
    target_hand TEXT DEFAULT 'ALL',
    is_cash BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Admin Payments (แอดมินจ่ายเงินให้ผู้ชนะ)
CREATE TABLE public.admin_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id TEXT REFERENCES public.circles(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    period INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'PENDING',
    is_cash BOOLEAN DEFAULT FALSE,
    payment_time TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Security: Set RLS (Row Level Security) if needed or keep it open if using Service Role Key on backend
-- For simplicity, since the backend API routes will use supabaseAdmin (Service Role), RLS is bypassed there.

-- 7. Admin Bank Accounts
CREATE TABLE public.banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_no TEXT NOT NULL,
    account_name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Member Houses (Many-to-Many Registry)
CREATE TABLE public.member_houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    admin_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING',
    assigned_bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(member_id, admin_id)
);
