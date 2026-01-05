-- Migration: Add meeting metadata columns to idg_reviews table
-- These columns track when the meeting was started and which issues were selected

-- Add meeting_started_at column to track when the IDG meeting was initiated
ALTER TABLE public.idg_reviews
ADD COLUMN IF NOT EXISTS meeting_started_at timestamp with time zone;

-- Add selected_issue_ids column to store the UUIDs of issues selected for the meeting
ALTER TABLE public.idg_reviews
ADD COLUMN IF NOT EXISTS selected_issue_ids uuid[] DEFAULT '{}';

-- Create index for faster lookups by meeting start time
CREATE INDEX IF NOT EXISTS idx_idg_reviews_meeting_started_at ON public.idg_reviews(meeting_started_at);
