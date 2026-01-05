-- Migration: Add SECURITY DEFINER RPC functions for middleware
-- These functions bypass RLS to allow middleware to check user onboarding status

-- =====================================================
-- RPC Function: Get user data for middleware
-- Returns hospice_id and onboarding_completed_at for a user
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_for_middleware(p_user_id uuid)
RETURNS TABLE (hospice_id uuid, onboarding_completed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hospice_id, onboarding_completed_at FROM users WHERE id = p_user_id
$$;

COMMENT ON FUNCTION public.get_user_for_middleware(uuid) IS
  'Returns user hospice_id and onboarding_completed_at for middleware auth checks. Uses SECURITY DEFINER to bypass RLS.';

-- =====================================================
-- RPC Function: Get hospice slug
-- Returns the slug for a hospice by ID
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_hospice_slug(p_hospice_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug FROM hospices WHERE id = p_hospice_id
$$;

COMMENT ON FUNCTION public.get_hospice_slug(uuid) IS
  'Returns hospice slug by ID for middleware routing. Uses SECURITY DEFINER to bypass RLS.';

-- =====================================================
-- GRANT EXECUTE permissions to authenticated users
-- This is CRITICAL - without this, the RPC calls will fail
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_user_for_middleware(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hospice_slug(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_hospice_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_hospice(uuid) TO authenticated;

-- Also grant to anon for middleware context (uses anon key with auth cookies)
GRANT EXECUTE ON FUNCTION public.get_user_for_middleware(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_hospice_slug(uuid) TO anon;
