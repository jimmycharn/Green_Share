-- ============================================================================
-- เพิ่ม indexes ตาม query pattern จริงของแอป
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_circles_creator
  ON public.circles(creator_id);

CREATE INDEX IF NOT EXISTS idx_circles_status
  ON public.circles(status);

CREATE INDEX IF NOT EXISTS idx_circle_players_member
  ON public.circle_players(member_id);

CREATE INDEX IF NOT EXISTS idx_bids_circle_period
  ON public.bids(circle_id, period);

CREATE INDEX IF NOT EXISTS idx_slips_circle_period_status
  ON public.slips(circle_id, period, status);

CREATE INDEX IF NOT EXISTS idx_admin_payments_circle_period
  ON public.admin_payments(circle_id, period);

CREATE INDEX IF NOT EXISTS idx_member_houses_admin_status
  ON public.member_houses(admin_id, status);

CREATE INDEX IF NOT EXISTS idx_member_houses_member
  ON public.member_houses(member_id);

CREATE INDEX IF NOT EXISTS idx_banks_member
  ON public.banks(member_id);

CREATE INDEX IF NOT EXISTS idx_members_line_id
  ON public.members(line_id);
