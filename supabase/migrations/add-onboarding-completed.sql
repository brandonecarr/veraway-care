-- Add onboarding_completed_at column to track when users complete onboarding
-- This prevents users from being prompted to complete onboarding repeatedly

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Add an index for faster lookups in middleware
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed
ON public.users (id, onboarding_completed_at);

-- Comment for documentation
COMMENT ON COLUMN public.users.onboarding_completed_at IS 'Timestamp when user completed the onboarding flow. NULL means onboarding not completed.';
