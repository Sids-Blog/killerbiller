# User Setup Guide

## Overview
This guide will help you create the three users with their specified roles after the database migration.

## Users to Create

| Email | Password | Role | Access Level |
|-------|----------|------|--------------|
| sid@killerbiller.com | Sid@123 | Admin | Full access to all features |
| aravind@gmail.com | Aravind@123 | Manager | Access to most features (no admin) |
| staff@gmail.com | Staff@123 | Staff | Limited access (Orders only) |

## Step-by-Step Process

### Step 1: Run the Safe Migration
First, run the safe migration script to restore the database structure:
```sql
-- Run this in your database
\i migrate_safe.sql
```

### Step 2: Run the User Setup Script
Run the user setup script to create the role structure and functions:
```sql
-- Run this in your database
\i setup_users_complete.sql
```

### Step 3: Create Users in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Go to **Authentication** → **Users**

2. **Create User 1 (Sid - Admin)**
   - Click **"Add User"**
   - Email: `sid@killerbiller.com`
   - Password: `Sid@123`
   - Check **"Email Confirm"**
   - Click **"Create User"**

3. **Create User 2 (Aravind - Manager)**
   - Click **"Add User"**
   - Email: `aravind@gmail.com`
   - Password: `Aravind@123`
   - Check **"Email Confirm"**
   - Click **"Create User"**

4. **Create User 3 (Staff - Staff)**
   - Click **"Add User"**
   - Email: `staff@gmail.com`
   - Password: `Staff@123`
   - Check **"Email Confirm"**
   - Click **"Create User"**

### Step 4: Assign Roles to Users

After creating the users in Supabase, run these commands to assign their roles:

```sql
-- Assign Admin role to Sid
SELECT assign_user_role('sid@killerbiller.com', 'admin');

-- Assign Manager role to Aravind
SELECT assign_user_role('aravind@gmail.com', 'manager');

-- Assign Staff role to Staff
SELECT assign_user_role('staff@gmail.com', 'staff');
```

### Step 5: Verify Setup

Run this query to verify all users are properly set up:

```sql
SELECT 
  u.username,
  r.name as role_name,
  r.description as role_description
FROM public.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
ORDER BY r.name, u.username;
```

## Expected Result

You should see:
- `sid@killerbiller.com` with `admin` role
- `aravind@gmail.com` with `manager` role  
- `staff@gmail.com` with `staff` role

## Testing the Setup

1. **Test Admin User (Sid)**
   - Login with `sid@killerbiller.com` / `Sid@123`
   - Should see all menu options: Dashboard, Billing, Orders, Inventory, Payments, Customers, Damaged Stock, Admin

2. **Test Manager User (Aravind)**
   - Login with `aravind@gmail.com` / `Aravind@123`
   - Should see: Dashboard, Billing, Orders, Inventory, Payments, Customers, Damaged Stock
   - Should NOT see: Admin

3. **Test Staff User (Staff)**
   - Login with `staff@gmail.com` / `Staff@123`
   - Should see: Orders only
   - Should NOT see: Dashboard, Billing, Inventory, Payments, Customers, Damaged Stock, Admin

## Troubleshooting

### If users can't see menu items:
1. Check the browser console for debug logs
2. Verify the user_roles table has the correct assignments
3. Ensure the roles table has the correct role names

### If authentication fails:
1. Verify users were created in Supabase Authentication
2. Check that email confirmation is set to true
3. Try logging out and back in

### If roles aren't working:
1. Run the verification query to check user-role assignments
2. Check that the link_existing_auth_user function ran successfully
3. Verify the useAuth hook is properly fetching roles

## Security Notes

- These are test passwords - change them in production
- Consider enabling 2FA for admin users
- Regularly review user roles and permissions
- Monitor authentication logs for suspicious activity
