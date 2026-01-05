-- Add new patient care management fields

-- Level of Care field
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS level_of_care text;

-- RN Case Manager (references a user)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS rn_case_manager_id uuid REFERENCES auth.users(id);

-- Residence type (Home or Facility)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS residence_type text;

-- Add index for case manager lookups
CREATE INDEX IF NOT EXISTS patients_rn_case_manager_id_idx ON public.patients(rn_case_manager_id);

-- Add comments for documentation
COMMENT ON COLUMN public.patients.level_of_care IS 'Level of care: Routine Care, General Inpatient Care, Continuous Care, Respite Care';
COMMENT ON COLUMN public.patients.rn_case_manager_id IS 'The RN Case Manager assigned to this patient';
COMMENT ON COLUMN public.patients.residence_type IS 'Where the patient resides: Home or Facility';
