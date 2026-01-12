-- Migration: Add discharge reason, cause of death, and bereavement status columns to patients table
-- These columns are displayed in the IDG PDF export for discharged patients

-- Add the columns to patients table
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS discharge_reason text,
ADD COLUMN IF NOT EXISTS cause_of_death text,
ADD COLUMN IF NOT EXISTS bereavement_status text;

-- Add comments to document the columns
COMMENT ON COLUMN public.patients.discharge_reason IS 'Reason for patient discharge (e.g., Revoked, Transferred, No longer eligible, Deceased)';
COMMENT ON COLUMN public.patients.cause_of_death IS 'Cause of death for deceased patients';
COMMENT ON COLUMN public.patients.bereavement_status IS 'Bereavement follow-up status for families of deceased patients';

-- Create index on discharge_reason for filtering
CREATE INDEX IF NOT EXISTS idx_patients_discharge_reason ON public.patients(discharge_reason);
