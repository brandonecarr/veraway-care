-- Fix issues that may be missing hospice_id
-- This can happen if issues were created before the trigger was set up,
-- or if the trigger failed to populate the hospice_id

-- Update issues where hospice_id is NULL by looking up the reporter's hospice
UPDATE public.issues i
SET hospice_id = u.hospice_id
FROM public.users u
WHERE i.reported_by = u.id
AND i.hospice_id IS NULL
AND u.hospice_id IS NOT NULL;

-- If reported_by is null, try to get from patient's hospice
UPDATE public.issues i
SET hospice_id = p.hospice_id
FROM public.patients p
WHERE i.patient_id = p.id
AND i.hospice_id IS NULL
AND p.hospice_id IS NOT NULL;

-- If assigned_to exists, try that
UPDATE public.issues i
SET hospice_id = u.hospice_id
FROM public.users u
WHERE i.assigned_to = u.id
AND i.hospice_id IS NULL
AND u.hospice_id IS NOT NULL;

-- Also check patients table for same issue
UPDATE public.patients p
SET hospice_id = u.hospice_id
FROM public.users u
WHERE p.hospice_id IS NULL
AND u.hospice_id IS NOT NULL
AND EXISTS (
    SELECT 1 FROM public.issues i
    WHERE i.patient_id = p.id
    AND i.reported_by = u.id
);

-- Log how many records are still missing hospice_id (for debugging)
DO $$
DECLARE
    issues_null_count INTEGER;
    patients_null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO issues_null_count FROM public.issues WHERE hospice_id IS NULL;
    SELECT COUNT(*) INTO patients_null_count FROM public.patients WHERE hospice_id IS NULL;

    IF issues_null_count > 0 THEN
        RAISE NOTICE 'WARNING: % issues still have NULL hospice_id', issues_null_count;
    END IF;

    IF patients_null_count > 0 THEN
        RAISE NOTICE 'WARNING: % patients still have NULL hospice_id', patients_null_count;
    END IF;
END $$;
