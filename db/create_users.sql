-- Simple User Setup Script - Fixed for Supabase Constraints
-- Run this after running migrate_safe.sql to restore the user structure

-- First, ensure the roles exist
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator with full access'),
  ('manager', 'Manager with access to most features'),
  ('staff', 'Staff with limited access')
ON CONFLICT (name) DO NOTHING;

-- Create a function to assign specific roles to users
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

-- Instructions for manual user creation:
/*
1. Go to Supabase Dashboard > Authentication > Users
2. Create the users manually:

   User 1: sid@killerbiller.com / Sid@123
   User 2: aravind@gmail.com / Aravind@123  
   User 3: staff@gmail.com / Staff@123

3. After creating each user, run these commands to assign roles:
   SELECT assign_user_role('sid@killerbiller.com', 'admin');
   SELECT assign_user_role('aravind@gmail.com', 'manager');
   SELECT assign_user_role('staff@gmail.com', 'staff');
*/

-- Verify roles exist
SELECT name, description FROM roles ORDER BY name;
