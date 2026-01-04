-- Migration: Add event date columns and benefit period to patients table
-- These columns track when patients were admitted, discharged, or passed away
-- Populated when corresponding issue types are created

-- Add the date columns to patients table
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS admitted_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS discharge_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS death_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS benefit_period integer DEFAULT 1;

-- Create indexes for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_patients_admitted_date ON public.patients(admitted_date);
CREATE INDEX IF NOT EXISTS idx_patients_discharge_date ON public.patients(discharge_date);
CREATE INDEX IF NOT EXISTS idx_patients_death_date ON public.patients(death_date);
CREATE INDEX IF NOT EXISTS idx_patients_benefit_period ON public.patients(benefit_period);

-- Function to calculate benefit period end date
-- BP1, BP2: 90 days from admission
-- BP3+: 60 days from admission
CREATE OR REPLACE FUNCTION public.get_benefit_period_end_date(
    p_admitted_date timestamp with time zone,
    p_benefit_period integer
) RETURNS timestamp with time zone AS $$
DECLARE
    days_in_period integer;
BEGIN
    IF p_admitted_date IS NULL THEN
        RETURN NULL;
    END IF;

    -- BP1 and BP2 are 90 days, BP3+ are 60 days
    IF p_benefit_period <= 2 THEN
        days_in_period := 90;
    ELSE
        days_in_period := 60;
    END IF;

    RETURN p_admitted_date + (days_in_period || ' days')::interval;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate days remaining in benefit period
CREATE OR REPLACE FUNCTION public.get_benefit_period_days_remaining(
    p_admitted_date timestamp with time zone,
    p_benefit_period integer
) RETURNS integer AS $$
DECLARE
    end_date timestamp with time zone;
BEGIN
    end_date := public.get_benefit_period_end_date(p_admitted_date, p_benefit_period);

    IF end_date IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN GREATEST(0, EXTRACT(DAY FROM (end_date - NOW()))::integer);
END;
$$ LANGUAGE plpgsql STABLE;
