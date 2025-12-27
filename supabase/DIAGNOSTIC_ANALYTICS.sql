-- Diagnostic SQL to check if analytics functions exist
-- Run this in Supabase SQL Editor to verify the analytics setup

-- Check if the RPC functions exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_response_time_trends',
    'get_resolution_velocity',
    'get_clinician_workload',
    'get_issue_type_distribution'
  )
ORDER BY routine_name;

-- Expected output: 4 rows showing all the functions
-- If you see fewer than 4 rows, the migration hasn't been applied yet

-- If all functions exist, test them with sample data
-- Test 1: Response Time Trends (should return data or empty array)
SELECT * FROM get_response_time_trends(
  NOW() - INTERVAL '30 days',
  NOW()
) LIMIT 5;

-- Test 2: Resolution Velocity (should return data or empty array)
SELECT * FROM get_resolution_velocity(
  NOW() - INTERVAL '30 days',
  NOW()
) LIMIT 5;

-- Test 3: Clinician Workload (should return data or empty array)
SELECT * FROM get_clinician_workload() LIMIT 5;

-- Test 4: Issue Type Distribution (should return data or empty array)
SELECT * FROM get_issue_type_distribution(
  NOW() - INTERVAL '30 days',
  NOW()
) LIMIT 5;
