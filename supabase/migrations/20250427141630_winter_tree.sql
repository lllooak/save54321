/*
  # Create admin9 user with specific credentials

  1. Changes
    - Create a new admin user with email admin9@example.com
    - Set password to 12121212
    - Assign admin role and active status
  
  2. Security
    - Password is properly hashed using bcrypt
    - User is created with admin role
*/

DO $$
DECLARE
  admin_id uuid;
  admin_email text := 'admin9@example.com';
  admin_password text := '12121212';
BEGIN
  -- Check if admin user already exists in auth.users
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = admin_email;

  -- If admin doesn't exist, create it
  IF admin_id IS NULL THEN
    -- Create admin user in auth.users
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

    -- Create admin user in public.users
    INSERT INTO users (
      id,
      email,
      role,
      name,
      wallet_balance,
      status,
      created_at
    ) VALUES (
      admin_id,
      admin_email,
      'admin',
      'System Administrator',
      1000.00, -- Initial wallet balance
      'active',
      now()
    );

    -- Log admin creation
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'create_admin_user',
      'users',
      admin_id,
      jsonb_build_object(
        'email', admin_email,
        'role', 'admin',
        'created_at', now()
      )
    );
    
    RAISE NOTICE 'Created new admin user with email %', admin_email;
  ELSE
    -- Ensure admin role is set correctly in public.users
    INSERT INTO users (
      id,
      email,
      role,
      name,
      wallet_balance,
      status,
      created_at
    ) VALUES (
      admin_id,
      admin_email,
      'admin',
      'System Administrator',
      1000.00,
      'active',
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      role = 'admin',
      status = 'active',
      updated_at = now();
      
    -- Update password if user exists
    UPDATE auth.users
    SET encrypted_password = crypt(admin_password, gen_salt('bf')),
        updated_at = now(),
        email_confirmed_at = now()
    WHERE id = admin_id;
    
    -- Log admin update
    INSERT INTO audit_logs (
      action,
      entity,
      entity_id,
      details
    ) VALUES (
      'update_admin_user',
      'users',
      admin_id,
      jsonb_build_object(
        'email', admin_email,
        'role', 'admin',
        'updated_at', now()
      )
    );
    
    RAISE NOTICE 'Updated existing admin user with email %', admin_email;
  END IF;
END $$;
