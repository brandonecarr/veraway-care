-- Advanced Analytics Functions for Phase 11

-- 1. Response Time Trends (daily average response time)
CREATE OR REPLACE FUNCTION get_response_time_trends(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  avg_response_time NUMERIC,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(i.updated_at, NOW()) - i.created_at)) / 3600)::numeric, 2) as avg_response_time,
    COUNT(*)::BIGINT as count
  FROM issues i
  WHERE i.created_at >= start_date 
    AND i.created_at <= end_date
  GROUP BY DATE(i.created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- 2. Resolution Velocity (daily resolved count and avg time)
CREATE OR REPLACE FUNCTION get_resolution_velocity(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  resolved BIGINT,
  avg_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.resolved_at) as date,
    COUNT(*)::BIGINT as resolved,
    ROUND(AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600)::numeric, 2) as avg_hours
  FROM issues i
  WHERE i.status = 'resolved'
    AND i.resolved_at IS NOT NULL
    AND i.resolved_at >= start_date 
    AND i.resolved_at <= end_date
  GROUP BY DATE(i.resolved_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- 3. Clinician Workload Heatmap
CREATE OR REPLACE FUNCTION get_clinician_workload()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email TEXT,
  assigned_count BIGINT,
  resolved_count BIGINT,
  overdue_count BIGINT,
  avg_completion_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    COALESCE(u.name, u.email) as name,
    u.email,
    COUNT(DISTINCT CASE WHEN i.status IN ('open', 'in_progress') THEN i.id END)::BIGINT as assigned_count,
    COUNT(DISTINCT CASE WHEN i.status = 'resolved' THEN i.id END)::BIGINT as resolved_count,
    COUNT(DISTINCT CASE WHEN i.status = 'overdue' THEN i.id END)::BIGINT as overdue_count,
    COALESCE(
      ROUND(AVG(
        CASE
          WHEN i.status = 'resolved' AND i.resolved_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600
        END
      )::numeric, 2),
      0
    ) as avg_completion_time
  FROM users u
  INNER JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN issues i ON i.assigned_to = u.id
  WHERE ur.role IN ('clinician', 'coordinator')
  GROUP BY u.id, u.name, u.email
  HAVING COUNT(i.id) > 0
  ORDER BY assigned_count DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Issue Type Distribution Over Time
CREATE OR REPLACE FUNCTION get_issue_type_distribution(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    jsonb_agg(
      jsonb_build_object(
        'type', i.issue_type,
        'count', type_count
      )
      ORDER BY type_count DESC
    ) as distribution
  FROM (
    SELECT 
      DATE(created_at) as created_date,
      issue_type,
      COUNT(*)::INTEGER as type_count
    FROM issues
    WHERE created_at >= start_date 
      AND created_at <= end_date
    GROUP BY DATE(created_at), issue_type
  ) i
  GROUP BY DATE(i.created_date)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;
