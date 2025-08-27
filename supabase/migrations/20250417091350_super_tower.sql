/*
  # Create test creator data with conflict handling

  1. Changes
    - Create test user in auth.users table with conflict handling
    - Create user profile with conflict handling
    - Create creator profile
    - Create sample video ad
*/

DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- First try to get existing user id
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'testcreator@example.com';

  -- If user doesn't exist, create new user
  IF test_user_id IS NULL THEN
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
      'testcreator@example.com',
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now()
    )
    RETURNING id INTO test_user_id;
  END IF;

  -- Insert or update public.users
  INSERT INTO users (
    id,
    email,
    role,
    created_at
  ) VALUES (
    test_user_id,
    'testcreator@example.com',
    'creator',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'creator',
      updated_at = now();

  -- Insert or update creator profile
  INSERT INTO creator_profiles (
    id,
    name,
    category,
    bio,
    price,
    delivery_time,
    avatar_url,
    banner_url,
    social_links,
    created_at
  ) VALUES (
    test_user_id,
    'Test Creator',
    'musician',
    'Professional musician with 10+ years of experience. Available for personalized song requests and musical messages.',
    50,
    '24 hours',
    'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=500',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200',
    '{
      "website": "https://example.com",
      "twitter": "https://twitter.com/testcreator",
      "instagram": "https://instagram.com/testcreator"
    }',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET name = 'Test Creator',
      updated_at = now();

  -- Insert sample video ad if it doesn't exist
  INSERT INTO video_ads (
    creator_id,
    title,
    description,
    price,
    duration,
    thumbnail_url,
    requirements,
    active,
    created_at
  )
  SELECT
    test_user_id,
    'Personalized Song Performance',
    'I will create a custom song performance just for you or your loved ones. Perfect for birthdays, anniversaries, or any special occasion.',
    75,
    '48 hours',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
    'Please provide the occasion, preferred style/genre, and any specific lyrics or messages you would like included.',
    true,
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM video_ads 
    WHERE creator_id = test_user_id 
    AND title = 'Personalized Song Performance'
  );

END $$;
