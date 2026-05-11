-- ============================================================================
-- Migration: Add fee_per_hand (ค่าดูแลวงแชร์) support
-- ============================================================================

-- 1. Default fee per hand on circles (set at creation)
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS fee_per_hand NUMERIC DEFAULT 0;

-- 2. Per-period fee override (nullable = use circle default)
ALTER TABLE public.circle_period_dates ADD COLUMN IF NOT EXISTS fee_per_hand NUMERIC;

-- 3. Track fee deducted from each payout
ALTER TABLE public.admin_payments ADD COLUMN IF NOT EXISTS fee_amount NUMERIC DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_payments_fee ON public.admin_payments(circle_id, period, member_id);
