-- =============================================
-- QUERY 1: Find all users with admin role
-- =============================================
SELECT
    u.email,
    ur.role,
    ur.created_at as role_created,
    ur.updated_at as role_updated
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';

-- =============================================
-- QUERY 2: Show ALL users and their roles
-- =============================================
SELECT
    u.id,
    u.email,
    u.created_at as user_created,
    COALESCE(ur.role, 'NO ROLE') as role,
    pu.facility_id
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.users pu ON u.id = pu.id
ORDER BY u.created_at DESC;

-- =============================================
-- QUERY 3: Assign admin role to FIRST user (usually the original admin)
-- This assigns admin to the oldest user account
-- UNCOMMENT AND RUN THIS BLOCK:
-- =============================================

/*
DO $$
DECLARE
    first_user_id UUID;
    first_user_email TEXT;
    target_facility_id UUID;
BEGIN
    -- Get the first (oldest) user
    SELECT id, email INTO first_user_id, first_user_email
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;

    IF first_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found in the database';
    END IF;

    -- Get the user's facility_id, or use the first facility if none
    SELECT COALESCE(
        (SELECT facility_id FROM public.users WHERE id = first_user_id),
        (SELECT id FROM public.facilities ORDER BY created_at ASC LIMIT 1)
    ) INTO target_facility_id;

    IF target_facility_id IS NULL THEN
        RAISE EXCEPTION 'No facility found. Create a facility first.';
    END IF;

    -- Delete any existing role for this user first
    DELETE FROM public.user_roles WHERE user_id = first_user_id;

    -- Insert admin role with facility_id
    INSERT INTO public.user_roles (user_id, role, facility_id, created_at, updated_at)
    VALUES (first_user_id, 'admin', target_facility_id, NOW(), NOW());

    RAISE NOTICE 'Admin role assigned to % (%)', first_user_email, first_user_id;
END $$;
*/

-- =============================================
-- QUERY 4: Assign admin role by USER ID (copy ID from Query 2 above)
-- UNCOMMENT AND RUN THIS BLOCK:
-- =============================================

/*
DO $$
DECLARE
    target_user_id UUID := 'PASTE_USER_ID_HERE'; -- <-- PASTE USER ID FROM QUERY 2
    target_facility_id UUID;
BEGIN
    -- Get the user's facility_id, or use the first facility if none
    SELECT COALESCE(
        (SELECT facility_id FROM public.users WHERE id = target_user_id),
        (SELECT id FROM public.facilities ORDER BY created_at ASC LIMIT 1)
    ) INTO target_facility_id;

    IF target_facility_id IS NULL THEN
        RAISE EXCEPTION 'No facility found. Create a facility first.';
    END IF;

    -- Delete any existing role for this user first
    DELETE FROM public.user_roles WHERE user_id = target_user_id;

    -- Insert admin role with facility_id
    INSERT INTO public.user_roles (user_id, role, facility_id, created_at, updated_at)
    VALUES (target_user_id, 'admin', target_facility_id, NOW(), NOW());

    RAISE NOTICE 'Admin role assigned to user %', target_user_id;
END $$;
*/
