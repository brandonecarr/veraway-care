-- Create function to queue push notifications when a notification is created
-- This will be called by triggers on the notifications table

CREATE OR REPLACE FUNCTION queue_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  pref_record RECORD;
  priority_level TEXT;
BEGIN
  -- Get user's notification preferences
  SELECT push_enabled INTO pref_record
  FROM notification_preferences
  WHERE user_id = NEW.user_id;

  -- Only proceed if user has push notifications enabled
  IF pref_record.push_enabled THEN
    -- Determine priority based on notification type
    priority_level := CASE 
      WHEN NEW.type = 'assignment' AND NEW.metadata->>'priority' = 'urgent' THEN 'urgent'
      WHEN NEW.type = 'status_change' AND NEW.metadata->>'new_status' = 'overdue' THEN 'critical'
      WHEN NEW.type = 'assignment' THEN 'normal'
      WHEN NEW.type = 'message' THEN 'normal'
      ELSE 'normal'
    END;

    -- Insert into a queue table that will be processed by the API
    -- We can't directly send HTTP requests from PostgreSQL functions
    -- So we'll use a trigger on the notifications table to send via API
    -- For now, we'll just ensure the notification has the metadata needed
    
    -- Update the notification with push metadata
    UPDATE notifications
    SET metadata = COALESCE(metadata, '{}'::jsonb) || 
                   jsonb_build_object(
                     'push_priority', priority_level,
                     'push_queued', true,
                     'push_queued_at', NOW()
                   )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to queue push notifications
DROP TRIGGER IF EXISTS trigger_queue_push_notification ON notifications;
CREATE TRIGGER trigger_queue_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION queue_push_notification();
