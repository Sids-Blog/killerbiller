-- This script finds a user in the main `auth.users` table,
-- copies them to the `public.users` table if they don't exist,
-- and then assigns the 'admin' role to them.
-- This is useful for manually setting up the first admin user.

-- IMPORTANT: Replace 'your_admin_username' with the actual username/email you created in the dashboard.

DO $$
DECLARE
  user_id_to_set UUID;
  user_email_to_set TEXT := 'sid@killerbiller.com'; -- <<< CHANGE THIS VALUE
  admin_role_id UUID;
BEGIN
  -- 1. Find the user in the main auth table by their email/username.
  SELECT id INTO user_id_to_set FROM auth.users WHERE email = user_email_to_set;

  -- Check if the user was found in the authentication system
  IF user_id_to_set IS NOT NULL THEN
    -- 2. Manually insert the user into public.users.
    --    This mimics the action of the handle_new_user trigger.
    --    If the user already exists, this does nothing.
    INSERT INTO public.users (id, username)
    VALUES (user_id_to_set, user_email_to_set)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'User % successfully copied or verified in public.users table.', user_email_to_set;

    -- 3. Get the Role ID for the 'admin' role.
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';

    -- 4. If the admin role exists, assign it to the user.
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (user_id_to_set, admin_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING; -- Avoid errors if already assigned.
      
      RAISE NOTICE 'Successfully assigned admin role to user %.', user_email_to_set;
    ELSE
      RAISE WARNING 'Could not find the "admin" role. Please ensure it exists in the roles table.';
    END IF;
  ELSE
    RAISE WARNING 'Could not find user with email/username %. Please check the username in the auth.users table.', user_email_to_set;
  END IF;
END $$;
