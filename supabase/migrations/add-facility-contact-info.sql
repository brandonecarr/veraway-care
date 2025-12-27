-- Add facility address and contact information columns
-- This adds contact details for facilities to improve facility management

ALTER TABLE public.facilities
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text;

-- Add comments for documentation
COMMENT ON COLUMN public.facilities.address_line1 IS 'Primary street address of the facility';
COMMENT ON COLUMN public.facilities.address_line2 IS 'Secondary address line (suite, unit, etc.)';
COMMENT ON COLUMN public.facilities.city IS 'City where the facility is located';
COMMENT ON COLUMN public.facilities.state IS 'State/province where the facility is located';
COMMENT ON COLUMN public.facilities.zip_code IS 'Postal/ZIP code for the facility';
COMMENT ON COLUMN public.facilities.phone IS 'Main contact phone number for the facility';
COMMENT ON COLUMN public.facilities.email IS 'Main contact email for the facility';
