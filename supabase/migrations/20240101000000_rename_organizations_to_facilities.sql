-- Rename organizations table to facilities
ALTER TABLE IF EXISTS organizations RENAME TO facilities;

-- Update foreign key references in other tables
-- Update users table
ALTER TABLE users RENAME COLUMN organization_id TO facility_id;

-- Update user_roles table
ALTER TABLE user_roles RENAME COLUMN organization_id TO facility_id;

-- Update issues table if it has organization_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issues' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE issues RENAME COLUMN organization_id TO facility_id;
    END IF;
END $$;

-- Update patients table if it has organization_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE patients RENAME COLUMN organization_id TO facility_id;
    END IF;
END $$;

-- Add unique constraint to user_roles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_roles_user_facility_unique'
    ) THEN
        ALTER TABLE user_roles
        ADD CONSTRAINT user_roles_user_facility_unique
        UNIQUE (user_id, facility_id);
    END IF;
END $$;

-- Create function to auto-create user record when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users to auto-create public.users record
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Add comment to facilities table
COMMENT ON TABLE facilities IS 'Healthcare facilities (formerly organizations)';
