-- Add acknowledgement tracking to issues table
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS acknowledged_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id);

-- Create index for quick lookup of unacknowledged issues
CREATE INDEX IF NOT EXISTS idx_issues_acknowledged_at ON public.issues(acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_issues_acknowledged_by ON public.issues(acknowledged_by);

-- Comment for documentation
COMMENT ON COLUMN public.issues.acknowledged_at IS 'Timestamp when the assigned clinician first acknowledged seeing this issue';
COMMENT ON COLUMN public.issues.acknowledged_by IS 'User ID of the clinician who acknowledged the issue';
