/*
  # Create test fan user

  1. Creates a new fan user with:
    - Email: testfan2@example.com
    - Password: password123
    - Initial wallet balance: $200
  
  2. Adds sample transactions:
    - Initial top-up
    - Test purchase
    - Refund
*/

DO $$
DECLARE
  test_fan_id uuid;
BEGIN
  -- First try to get existing user id
  SELECT id INTO test_fan_id
  FROM auth.users
  WHERE email = 'testfan2@example.com';

  -- If user doesn't exist, create new user
  IF test_fan_id IS NULL THEN
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
      'testfan2@example.com',
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now()
    )
    RETURNING id INTO test_fan_id;
  END IF;

  -- Insert or update public.users
  INSERT INTO users (
    id,
    email,
    role,
    wallet_balance,
    created_at
  ) VALUES (
    test_fan_id,
    'testfan2@example.com',
    'fan',
    200.00, -- Initial wallet balance
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'fan',
      wallet_balance = 200.00,
      updated_at = now();

  -- Add sample transactions
  INSERT INTO wallet_transactions (
    user_id,
    type,
    amount,
    payment_method,
    payment_status,
    description,
    created_at
  ) VALUES
  -- Initial top-up
  (
    test_fan_id,
    'top_up',
    150.00,
    'paypal',
    'completed',
    'Initial wallet top-up',
    now() - interval '10 days'
  ),
  -- Second top-up
  (
    test_fan_id,
    'top_up',
    100.00,
    'paypal',
    'completed',
    'Additional wallet top-up',
    now() - interval '7 days'
  ),
  -- Test purchase
  (
    test_fan_id,
    'purchase',
    75.00,
    'wallet',
    'completed',
    'Video request payment',
    now() - interval '5 days'
  ),
  -- Test refund
  (
    test_fan_id,
    'refund',
    25.00,
    'wallet',
    'completed',
    'Partial refund for cancelled request',
    now() - interval '2 days'
  );

END $$;
