DO $$
DECLARE
    coordinator_id uuid;
    clinician_id uuid;
    test_issue_id uuid;
    test_patient_id uuid;
BEGIN
    SELECT id INTO coordinator_id FROM auth.users WHERE email = 'coordinator@example.com' LIMIT 1;
    SELECT id INTO clinician_id FROM auth.users WHERE email = 'clinician@example.com' LIMIT 1;
    
    SELECT id INTO test_issue_id FROM public.issues LIMIT 1;
    SELECT id INTO test_patient_id FROM public.patients LIMIT 1;

    IF coordinator_id IS NOT NULL AND test_issue_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_issue_id, related_patient_id, is_read, created_at)
        VALUES
            (coordinator_id, 'assignment', 'New Issue Assigned', 'Issue #1001 has been assigned to you', test_issue_id, test_patient_id, false, NOW() - INTERVAL '5 minutes'),
            (coordinator_id, 'message', 'New Message on Issue #1001', 'Clinician added a message regarding medication...', test_issue_id, test_patient_id, false, NOW() - INTERVAL '15 minutes'),
            (coordinator_id, 'status_change', 'Issue Status Updated', 'Issue #1001 status changed to in_progress', test_issue_id, test_patient_id, true, NOW() - INTERVAL '1 hour'),
            (coordinator_id, 'overdue', 'Issue Overdue', 'Issue #1002 is now overdue and requires attention', test_issue_id, test_patient_id, false, NOW() - INTERVAL '2 hours');
    END IF;

    IF clinician_id IS NOT NULL AND test_issue_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_issue_id, related_patient_id, is_read, created_at)
        VALUES
            (clinician_id, 'assignment', 'New Issue Assigned', 'Issue #1003 has been assigned to you', test_issue_id, test_patient_id, false, NOW() - INTERVAL '10 minutes'),
            (clinician_id, 'handoff', 'New Handoff Created', 'After-hours handoff created with 3 pending issues', NULL, NULL, true, NOW() - INTERVAL '3 hours');
    END IF;

END $$;
