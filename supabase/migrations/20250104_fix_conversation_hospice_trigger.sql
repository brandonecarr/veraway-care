-- Fix conversation trigger to use hospice_id instead of facility_id
-- The set_conversation_facility_id trigger was not dropped in the hospice rename migration

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS set_conversation_facility_id_trigger ON public.conversations;
DROP FUNCTION IF EXISTS public.set_conversation_facility_id() CASCADE;

-- Create the new function using hospice_id
CREATE OR REPLACE FUNCTION public.set_conversation_hospice_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hospice_id IS NULL THEN
        NEW.hospice_id := public.get_user_hospice_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new trigger
DROP TRIGGER IF EXISTS set_conversation_hospice_id_trigger ON public.conversations;
CREATE TRIGGER set_conversation_hospice_id_trigger
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_conversation_hospice_id();

-- Fix the create_patient_conversation function that is triggered when a patient is created
-- This function uses facility_id and needs to use hospice_id instead
CREATE OR REPLACE FUNCTION public.create_patient_conversation()
RETURNS TRIGGER AS $$
DECLARE
    new_conversation_id uuid;
    staff_user RECORD;
    current_user_id uuid;
BEGIN
    -- Get current user id
    current_user_id := auth.uid();

    -- Create conversation for the patient
    INSERT INTO public.conversations (
        hospice_id,
        type,
        name,
        patient_id,
        created_by
    ) VALUES (
        NEW.hospice_id,
        'patient',
        NEW.first_name || ' ' || NEW.last_name || ' - Care Team',
        NEW.id,
        current_user_id
    ) RETURNING id INTO new_conversation_id;

    -- Add all staff members from the same hospice as participants
    FOR staff_user IN
        SELECT DISTINCT u.id
        FROM public.users u
        INNER JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE u.hospice_id = NEW.hospice_id
        AND ur.role IN ('clinician', 'coordinator', 'after_hours', 'admin')
    LOOP
        INSERT INTO public.conversation_participants (
            conversation_id,
            user_id,
            role
        ) VALUES (
            new_conversation_id,
            staff_user.id,
            'member'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Create a system message announcing the conversation
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content,
        message_type
    ) VALUES (
        new_conversation_id,
        NULL,
        'Care team conversation created for ' || NEW.first_name || ' ' || NEW.last_name,
        'system'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the get_or_create_patient_conversation function
CREATE OR REPLACE FUNCTION public.get_or_create_patient_conversation(p_patient_id uuid)
RETURNS uuid AS $$
DECLARE
    v_conversation_id uuid;
    v_patient record;
    current_user_hospice_id uuid;
BEGIN
    current_user_hospice_id := public.get_user_hospice_id();

    -- Check for existing patient conversation
    SELECT id INTO v_conversation_id
    FROM public.conversations
    WHERE patient_id = p_patient_id AND type = 'patient'
    AND hospice_id = current_user_hospice_id
    LIMIT 1;

    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- Get patient info
    SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id;

    IF v_patient IS NULL THEN
        RAISE EXCEPTION 'Patient not found';
    END IF;

    -- Create new patient conversation
    INSERT INTO public.conversations (
        type,
        patient_id,
        hospice_id,
        name,
        created_by
    ) VALUES (
        'patient',
        p_patient_id,
        current_user_hospice_id,
        v_patient.first_name || ' ' || v_patient.last_name || ' - Care Team',
        auth.uid()
    )
    RETURNING id INTO v_conversation_id;

    -- Add all hospice users as participants
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT v_conversation_id, u.id
    FROM public.users u
    WHERE u.hospice_id = current_user_hospice_id
    ON CONFLICT DO NOTHING;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
