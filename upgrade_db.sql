-- Add interest_method column to circles table
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS interest_method TEXT DEFAULT 'หักดอก';
