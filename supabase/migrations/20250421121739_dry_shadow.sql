-- Create admin user with specific credentials for login
DO $$
DECLARE
  admin_id uuid;
  admin_email text := 'dontworry2much@gmail.com';
  admin_password text := '1232123';
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
        updated_at = now()
    WHERE id = admin_id;
    
    RAISE NOTICE 'Updated existing admin user with email %', admin_email;
  END IF;
END $$;
