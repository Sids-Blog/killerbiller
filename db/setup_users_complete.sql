-- Complete User Setup Script - Fixed for Supabase Constraints
-- This script sets up the three users with their roles
-- Run this AFTER running migrate_safe.sql

-- Step 1: Ensure roles exist
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with access to most features'),
  ('staff', 'Staff with limited access')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Create a function to automatically create users when they first sign in
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- Insert into public.users table
  INSERT INTO public.users (id, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email)
  );
  
  -- Get the default 'staff' role ID (most restrictive default)
  SELECT id INTO default_role_id FROM roles WHERE name = 'staff';
  
  -- Assign default role to new user
  IF default_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id) VALUES (new.id, default_role_id);
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Create a function to assign specific roles to users
CREATE OR REPLACE FUNCTION assign_user_role(p_email TEXT, p_role_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users', p_email;
  END IF;
  
  -- Get the role ID
  SELECT id INTO v_role_id FROM roles WHERE name = p_role_name;
  
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role % not found', p_role_name;
  END IF;
  
  -- Ensure user exists in public.users (create if missing)
  INSERT INTO public.users (id, username)
  VALUES (v_user_id, p_email)
  ON CONFLICT (id) DO NOTHING;
  
  -- Remove any existing roles for this user
  DELETE FROM user_roles WHERE user_id = v_user_id;
  
  -- Assign the new role
  INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_role_id);
  
  RAISE NOTICE 'Assigned role % to user %', p_role_name, p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Instructions for manual user creation
-- The following steps need to be done manually in Supabase:

/*
1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User" for each user:

   User 1:
   - Email: sid@killerbiller.com
   - Password: Sid@123
   - Email Confirm: true
   
   User 2:
   - Email: aravind@gmail.com
   - Password: Aravind@123
   - Email Confirm: true
   
   User 3:
   - Email: staff@gmail.com
   - Password: Staff@123
   - Email Confirm: true

3. After creating each user, run these functions to assign their roles:
   SELECT assign_user_role('sid@killerbiller.com', 'admin');
   SELECT assign_user_role('aravind@gmail.com', 'manager');
   SELECT assign_user_role('staff@gmail.com', 'staff');
*/

-- Step 6: Verify the setup (run this after creating users and assigning roles)
-- SELECT 
--   u.username,
--   r.name as role_name,
--   r.description as role_description
-- FROM public.users u
-- JOIN user_roles ur ON u.id = ur.user_id
-- JOIN roles r ON ur.role_id = r.id
-- ORDER BY r.name, u.username;
