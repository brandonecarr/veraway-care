-- Add job_role column to user_roles table
-- This migration adds a job_role field to track clinician job types

-- =====================================================
-- STEP 1: Update user_roles primary key to include facility_id
-- =====================================================

-- Drop existing primary key constraint
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_pkey;

-- Add composite primary key with user_id and facility_id
-- This allows users to have roles in multiple facilities
ALTER TABLE public.user_roles
ADD PRIMARY KEY (user_id, facility_id);

-- =====================================================
-- STEP 2: Add job_role column
-- =====================================================

-- Add job_role column for clinicians
-- Valid values: RN, LVN/LPN, HHA, MSW, Chaplain, MD, NP
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS job_role text;

-- =====================================================
-- STEP 3: Add comment
-- =====================================================

COMMENT ON COLUMN public.user_roles.job_role IS 'Job role for clinicians (RN, LVN/LPN, HHA, MSW, Chaplain, MD, NP). Only applicable when role is clinician.';
