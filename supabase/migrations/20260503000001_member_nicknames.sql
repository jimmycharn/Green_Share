-- viewer-specific custom nicknames
-- A "viewer" (ADMIN or SUPERADMIN) can assign a private display name for any member.
-- The nickname is only visible to that viewer; everyone else sees the original name.

CREATE TABLE IF NOT EXISTS public.member_nicknames (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id  TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  target_id  TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  nickname   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viewer_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_member_nicknames_viewer ON public.member_nicknames (viewer_id);
