# Demo Login Credentials

## Setting Up Demo Users

### Step 1: Create Users in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Users**
3. Click **"Add User"** for each role
4. Create the following users:

#### Clinician Account
- **Email**: `clinician@demo.com`
- **Password**: `demo123456`
- **Role**: Clinician (default)

#### Coordinator Account
- **Email**: `coordinator@demo.com`
- **Password**: `demo123456`
- **Role**: Coordinator (can assign issues)

#### After-Hours Account
- **Email**: `afterhours@demo.com`
- **Password**: `demo123456`
- **Role**: After-Hours Staff

### Step 2: Assign Roles

After creating the users in Supabase Auth, you need to assign their roles:

1. In Supabase Dashboard, go to **SQL Editor**
2. Run this query to get the user IDs:
```sql
SELECT id, email FROM auth.users 
WHERE email IN ('clinician@demo.com', 'coordinator@demo.com', 'afterhours@demo.com');
```

3. Copy the IDs and run this query (replace the UUIDs):
```sql
INSERT INTO public.user_roles (user_id, role) VALUES
  ('CLINICIAN_USER_ID_HERE', 'clinician'),
  ('COORDINATOR_USER_ID_HERE', 'coordinator'),
  ('AFTERHOURS_USER_ID_HERE', 'after_hours')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
```

### Step 3: Create Sample Issues

To populate the dashboard with sample data, run this SQL (replace USER_ID with coordinator's ID):

```sql
INSERT INTO public.issues (patient_id, reported_by, assigned_to, issue_type, description, status, priority, tags, created_at)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'USER_ID', 'USER_ID', 'Medication', 'Patient needs pain medication refill', 'open', 'high', ARRAY['urgent', 'pain-management'], NOW() - INTERVAL '2 hours'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'USER_ID', NULL, 'Family Communication', 'Family requesting care meeting', 'open', 'normal', ARRAY['family'], NOW() - INTERVAL '1 day'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'USER_ID', 'USER_ID', 'Equipment', 'Hospital bed delivery scheduled for tomorrow', 'in_progress', 'normal', ARRAY['equipment', 'delivery'], NOW() - INTERVAL '3 hours'),
  ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'USER_ID', 'USER_ID', 'Pain Management', 'Breakthrough pain reported by family', 'open', 'urgent', ARRAY['urgent', 'pain'], NOW() - INTERVAL '30 hours'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'USER_ID', 'USER_ID', 'Care Plan', 'Care plan review needed', 'open', 'normal', ARRAY['documentation'], NOW() - INTERVAL '5 hours');
```

## Testing Different Roles

### As Clinician
- View all issues
- Report new issues via FAB (+ button)
- Add messages to issues
- Mark assigned issues as resolved
- Cannot assign issues to others

### As Coordinator
- All clinician capabilities
- **Plus**: Assign/reassign issues to team members
- View assignment options in issue detail panel
- Full team management capabilities

### As After-Hours
- View handoff information (when created by coordinators)
- Access issues tagged for after-hours
- All standard viewing and messaging capabilities

## Quick Start

1. Sign in with `coordinator@demo.com` to test full functionality
2. Use the FAB (+ button) to create a new issue
3. Search for patients (MRN001-MRN008 available)
4. Click any issue to see the detail panel
5. Try assigning issues to different team members

---

**Note**: All demo accounts use the password `demo123456`
