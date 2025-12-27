-- Check if there's any data for analytics to display
-- Run this in Supabase SQL Editor

-- 1. Check total issues count
SELECT
  'Total Issues' as metric,
  COUNT(*) as count
FROM issues;

-- 2. Check issues by status
SELECT
  'Issues by Status' as metric,
  status,
  COUNT(*) as count
FROM issues
GROUP BY status
ORDER BY count DESC;

-- 3. Check if there are any users with roles
SELECT
  'Users with Roles' as metric,
  COUNT(DISTINCT u.id) as count
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id;

-- 4. Check issues in the last 30 days
SELECT
  'Issues (Last 30 Days)' as metric,
  COUNT(*) as count
FROM issues
WHERE created_at >= NOW() - INTERVAL '30 days';

-- 5. Test the analytics functions directly
SELECT 'Response Time Trends' as test, COUNT(*) as result_count
FROM get_response_time_trends(NOW() - INTERVAL '30 days', NOW());

SELECT 'Resolution Velocity' as test, COUNT(*) as result_count
FROM get_resolution_velocity(NOW() - INTERVAL '30 days', NOW());

SELECT 'Clinician Workload' as test, COUNT(*) as result_count
FROM get_clinician_workload();

SELECT 'Issue Type Distribution' as test, COUNT(*) as result_count
FROM get_issue_type_distribution(NOW() - INTERVAL '30 days', NOW());
