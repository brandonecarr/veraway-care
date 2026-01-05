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

-- Also update the auto_create_patient_conversation function if it exists
-- and is still using facility_id
CREATE OR REPLACE FUNCTION public.auto_create_patient_conversation()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if a conversation already exists for this patient
    IF NOT EXISTS (
        SELECT 1 FROM public.conversations
        WHERE patient_id = NEW.id AND type = 'patient'
    ) THEN
        -- Create patient conversation
        INSERT INTO public.conversations (
            type,
            patient_id,
            hospice_id,
            name,
            created_by
        ) VALUES (
            'patient',
            NEW.id,
            NEW.hospice_id,
            NEW.first_name || ' ' || NEW.last_name || ' - Care Team',
            auth.uid()
        );

        -- Add all hospice users as participants
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        SELECT
            (SELECT id FROM public.conversations WHERE patient_id = NEW.id AND type = 'patient' ORDER BY created_at DESC LIMIT 1),
            u.id
        FROM public.users u
        WHERE u.hospice_id = NEW.hospice_id
        AND u.id != auth.uid()
        ON CONFLICT DO NOTHING;

        -- Add the creator as a participant
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        SELECT
            (SELECT id FROM public.conversations WHERE patient_id = NEW.id AND type = 'patient' ORDER BY created_at DESC LIMIT 1),
            auth.uid()
        ON CONFLICT DO NOTHING;
    END IF;

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
