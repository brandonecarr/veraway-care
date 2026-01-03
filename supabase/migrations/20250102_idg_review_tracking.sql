-- IDG Review Tracking Tables
-- Tracks completed IDG reviews and individual issue dispositions
-- Per plan: "We prepare and prove IDG review — we don't replace EMR documentation"

-- Table to track completed IDG review sessions
CREATE TABLE IF NOT EXISTS public.idg_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    week_end date NOT NULL,
    completed_at timestamp with time zone DEFAULT NOW(),
    completed_by uuid REFERENCES public.users(id),
    completed_by_role text, -- coordinator, admin, etc.

    -- Disciplines present at IDG (checkboxes)
    disciplines_present text[] DEFAULT '{}',

    -- Counts at time of completion
    total_issues_reviewed integer DEFAULT 0,
    admissions_count integer DEFAULT 0,
    deaths_count integer DEFAULT 0,

    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

-- Table to track individual issue status within IDG context
-- This is for preparation and disposition, NOT clinical documentation
CREATE TABLE IF NOT EXISTS public.idg_issue_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
    facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,

    -- MD Review flag (Step 4)
    flagged_for_md_review boolean DEFAULT false,
    flagged_for_md_review_at timestamp with time zone,
    flagged_for_md_review_by uuid REFERENCES public.users(id),

    -- IDG Disposition (Step 4) - curation, not documentation
    idg_disposition text CHECK (idg_disposition IN (
        'monitoring_only',
        'plan_in_place',
        'escalated',
        'pending_md_input',
        'resolved'
    )),
    disposition_set_at timestamp with time zone,
    disposition_set_by uuid REFERENCES public.users(id),

    -- Reviewed in IDG (Step 6 optional)
    reviewed_in_idg boolean DEFAULT false,
    reviewed_in_idg_at timestamp with time zone,
    idg_review_id uuid REFERENCES public.idg_reviews(id),

    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),

    UNIQUE(issue_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_idg_reviews_facility_week ON public.idg_reviews(facility_id, week_start);
CREATE INDEX IF NOT EXISTS idx_idg_issue_status_issue ON public.idg_issue_status(issue_id);
CREATE INDEX IF NOT EXISTS idx_idg_issue_status_facility ON public.idg_issue_status(facility_id);

-- Function to get or create IDG issue status
CREATE OR REPLACE FUNCTION public.get_or_create_idg_issue_status(
    p_issue_id uuid,
    p_facility_id uuid
)
RETURNS uuid AS $$
DECLARE
    v_status_id uuid;
BEGIN
    -- Try to get existing
    SELECT id INTO v_status_id
    FROM public.idg_issue_status
    WHERE issue_id = p_issue_id;

    -- Create if not exists
    IF v_status_id IS NULL THEN
        INSERT INTO public.idg_issue_status (issue_id, facility_id)
        VALUES (p_issue_id, p_facility_id)
        RETURNING id INTO v_status_id;
    END IF;

    RETURN v_status_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update IDG issue disposition
CREATE OR REPLACE FUNCTION public.update_idg_issue_disposition(
    p_issue_id uuid,
    p_facility_id uuid,
    p_user_id uuid,
    p_disposition text DEFAULT NULL,
    p_flagged_for_md boolean DEFAULT NULL
)
RETURNS public.idg_issue_status AS $$
DECLARE
    v_result public.idg_issue_status;
BEGIN
    -- Ensure status record exists
    PERFORM public.get_or_create_idg_issue_status(p_issue_id, p_facility_id);

    -- Update the record
    UPDATE public.idg_issue_status
    SET
        idg_disposition = COALESCE(p_disposition, idg_disposition),
        disposition_set_at = CASE WHEN p_disposition IS NOT NULL THEN NOW() ELSE disposition_set_at END,
        disposition_set_by = CASE WHEN p_disposition IS NOT NULL THEN p_user_id ELSE disposition_set_by END,
        flagged_for_md_review = COALESCE(p_flagged_for_md, flagged_for_md_review),
        flagged_for_md_review_at = CASE WHEN p_flagged_for_md IS NOT NULL THEN NOW() ELSE flagged_for_md_review_at END,
        flagged_for_md_review_by = CASE WHEN p_flagged_for_md IS NOT NULL THEN p_user_id ELSE flagged_for_md_review_by END,
        updated_at = NOW()
    WHERE issue_id = p_issue_id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete an IDG review
CREATE OR REPLACE FUNCTION public.complete_idg_review(
    p_facility_id uuid,
    p_user_id uuid,
    p_user_role text,
    p_week_start date,
    p_week_end date,
    p_disciplines_present text[],
    p_issue_ids uuid[],
    p_admissions_count integer DEFAULT 0,
    p_deaths_count integer DEFAULT 0
)
RETURNS public.idg_reviews AS $$
DECLARE
    v_review public.idg_reviews;
BEGIN
    -- Create the IDG review record
    INSERT INTO public.idg_reviews (
        facility_id,
        week_start,
        week_end,
        completed_by,
        completed_by_role,
        disciplines_present,
        total_issues_reviewed,
        admissions_count,
        deaths_count
    )
    VALUES (
        p_facility_id,
        p_week_start,
        p_week_end,
        p_user_id,
        p_user_role,
        p_disciplines_present,
        array_length(p_issue_ids, 1),
        p_admissions_count,
        p_deaths_count
    )
    RETURNING * INTO v_review;

    -- Mark all issues as reviewed in this IDG
    UPDATE public.idg_issue_status
    SET
        reviewed_in_idg = true,
        reviewed_in_idg_at = NOW(),
        idg_review_id = v_review.id,
        updated_at = NOW()
    WHERE issue_id = ANY(p_issue_ids);

    -- For issues without status records, create them
    INSERT INTO public.idg_issue_status (issue_id, facility_id, reviewed_in_idg, reviewed_in_idg_at, idg_review_id)
    SELECT i.id, i.facility_id, true, NOW(), v_review.id
    FROM public.issues i
    WHERE i.id = ANY(p_issue_ids)
    AND NOT EXISTS (SELECT 1 FROM public.idg_issue_status s WHERE s.issue_id = i.id)
    ON CONFLICT (issue_id) DO UPDATE SET
        reviewed_in_idg = true,
        reviewed_in_idg_at = NOW(),
        idg_review_id = v_review.id,
        updated_at = NOW();

    RETURN v_review;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get IDG issue statuses for a list of issues
CREATE OR REPLACE FUNCTION public.get_idg_issue_statuses(p_issue_ids uuid[])
RETURNS TABLE (
    issue_id uuid,
    flagged_for_md_review boolean,
    idg_disposition text,
    reviewed_in_idg boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.issue_id,
        COALESCE(s.flagged_for_md_review, false),
        s.idg_disposition,
        COALESCE(s.reviewed_in_idg, false)
    FROM public.idg_issue_status s
    WHERE s.issue_id = ANY(p_issue_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_idg_issues to include death count and admission tracking
-- Add columns to track these in the summary
CREATE OR REPLACE FUNCTION public.get_idg_summary_counts(
    p_facility_id uuid,
    p_week_start timestamp with time zone,
    p_week_end timestamp with time zone
)
RETURNS TABLE (
    deaths_count bigint,
    admissions_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE i.issue_type = 'Death') as deaths_count,
        -- Admissions would come from patient table - count patients admitted this week
        (SELECT COUNT(*) FROM public.patients p
         WHERE p.facility_id = p_facility_id
         AND p.created_at >= p_week_start
         AND p.created_at <= p_week_end
         AND p.status = 'active') as admissions_count
    FROM public.issues i
    WHERE i.facility_id = p_facility_id
    AND i.created_at >= p_week_start
    AND i.created_at <= p_week_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.idg_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idg_issue_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for idg_reviews
CREATE POLICY "Users can view IDG reviews for their facility" ON public.idg_reviews
    FOR SELECT USING (
        facility_id IN (
            SELECT facility_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Coordinators can create IDG reviews" ON public.idg_reviews
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.facility_id = facility_id
            AND ur.role = 'coordinator'
        )
    );

-- RLS Policies for idg_issue_status
CREATE POLICY "Users can view IDG issue status for their facility" ON public.idg_issue_status
    FOR SELECT USING (
        facility_id IN (
            SELECT facility_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Coordinators can update IDG issue status" ON public.idg_issue_status
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.facility_id = facility_id
            AND ur.role = 'coordinator'
        )
    );

-- Comments
COMMENT ON TABLE public.idg_reviews IS 'Tracks completed IDG review sessions - proves IDG happened without replacing EMR documentation';
COMMENT ON TABLE public.idg_issue_status IS 'Tracks issue curation for IDG (MD review flags, dispositions) - NOT clinical documentation';
COMMENT ON FUNCTION public.complete_idg_review IS 'Records IDG review completion with timestamp, disciplines present, and issues reviewed count';
