-- Add is_super_admin column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Update existing admin users to have super admin privileges
-- This ensures backward compatibility
UPDATE users
SET is_super_admin = TRUE
WHERE role = 'admin' AND email IN ('admin@example.com', 'admin1@example.com', 'dontworry2much@gmail.com');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS users_is_super_admin_idx ON users(is_super_admin);

-- Create super admin user for Joseph999
DO $$
DECLARE
  admin_id uuid;
  admin_email text := 'joseph999@example.com';
  admin_password text := 'Joseph999!';
BEGIN
  -- Check if super admin user already exists in auth.users
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = admin_email;

  -- If super admin doesn't exist, create it
  IF admin_id IS NULL THEN
    -- Create super admin user in auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      now(),
      now()
    )
    RETURNING id INTO admin_id;

    -- Create super admin user in public.users
    INSERT INTO users (
      id,
      email,
      role,
      name,
      wallet_balance,
      status,
      created_at,
      is_super_admin
    ) VALUES (
      admin_id,
      admin_email,
      'admin',
      'Joseph999',
      1000.00, -- Initial wallet balance
      'active',
      now(),
      true -- This is a super admin
    );

    -- Log super admin creation
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'create_super_admin',
      'users',
      admin_id,
      jsonb_build_object(
        'email', admin_email,
        'role', 'admin',
        'is_super_admin', true,
        'created_at', now()
      )
    );
    
    RAISE NOTICE 'Created new super admin user with email %', admin_email;
  ELSE
    -- Ensure super admin role is set correctly in public.users
    INSERT INTO users (
      id,
      email,
      role,
      name,
      wallet_balance,
      status,
      created_at,
      is_super_admin
    ) VALUES (
      admin_id,
      admin_email,
      'admin',
      'Joseph999',
      1000.00,
      'active',
      now(),
      true -- This is a super admin
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      role = 'admin',
      status = 'active',
      is_super_admin = true,
      updated_at = now();
      
    -- Update password if user exists
    UPDATE auth.users
    SET encrypted_password = crypt(admin_password, gen_salt('bf')),
        updated_at = now(),
        email_confirmed_at = now()
    WHERE id = admin_id;
    
    -- Log super admin update
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'update_super_admin',
      'users',
      admin_id,
      jsonb_build_object(
        'email', admin_email,
        'role', 'admin',
        'is_super_admin', true,
        'updated_at', now()
      )
    );
    
    RAISE NOTICE 'Updated existing super admin user with email %', admin_email;
  END IF;
END $$;

-- Create super admin user for Joseph998
DO $$
DECLARE
  admin_id uuid;
  admin_email text := 'joseph998@example.com';
  admin_password text := 'Joseph998!';
BEGIN
  -- Check if super admin user already exists in auth.users
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = admin_email;

  -- If super admin doesn't exist, create it
  IF admin_id IS NULL THEN
    -- Create super admin user in auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      now(),
      now()
    )
    RETURNING id INTO admin_id;

    -- Create super admin user in public.users
    INSERT INTO users (
      id,
      email,
      role,
      name,
      wallet_balance,
      status,
      created_at,
      is_super_admin
    ) VALUES (
      admin_id,
      admin_email,
      'admin',
      'Joseph998',
      1000.00, -- Initial wallet balance
      'active',
      now(),
      true -- This is a super admin
    );

    -- Log super admin creation
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'create_super_admin',
      'users',
      admin_id,
      jsonb_build_object(
        'email', admin_email,
        'role', 'admin',
        'is_super_admin', true,
        'created_at', now()
      )
    );
    
    RAISE NOTICE 'Created new super admin user with email %', admin_email;
  ELSE
    -- Ensure super admin role is set correctly in public.users
    INSERT INTO users (
      id,
      email,
      role,
      name,
      wallet_balance,
      status,
      created_at,
      is_super_admin
    ) VALUES (
      admin_id,
      admin_email,
      'admin',
      'Joseph998',
      1000.00,
      'active',
      now(),
      true -- This is a super admin
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      role = 'admin',
      status = 'active',
      is_super_admin = true,
      updated_at = now();
      
    -- Update password if user exists
    UPDATE auth.users
    SET encrypted_password = crypt(admin_password, gen_salt('bf')),
        updated_at = now(),
        email_confirmed_at = now()
    WHERE id = admin_id;
    
    -- Log super admin update
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'update_super_admin',
      'users',
      admin_id,
      jsonb_build_object(
        'email', admin_email,
        'role', 'admin',
        'is_super_admin', true,
        'updated_at', now()
      )
    );
    
    RAISE NOTICE 'Updated existing super admin user with email %', admin_email;
  END IF;
END $$;

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'add_super_admin_column',
  'users',
  NULL,
  jsonb_build_object(
    'description', 'Added is_super_admin column to users table and created super admin users',
    'timestamp', now()
  )
);
