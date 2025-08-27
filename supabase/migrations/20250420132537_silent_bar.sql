/*
  # Create additional test accounts

  1. Creates 4 new fan accounts:
    - Music lover
    - Sports enthusiast
    - Comedy fan
    - Art collector
  
  2. Creates 4 new creator accounts:
    - Singer
    - Athlete
    - Comedian
    - Artist
*/

DO $$
DECLARE
  fan1_id uuid;
  fan2_id uuid;
  fan3_id uuid;
  fan4_id uuid;
  creator1_id uuid;
  creator2_id uuid;
  creator3_id uuid;
  creator4_id uuid;
BEGIN
  -- Create fan accounts
  -- Fan 1: Music lover
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'musicfan@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO fan1_id;

  -- Fan 2: Sports enthusiast
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'sportsfan@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO fan2_id;

  -- Fan 3: Comedy fan
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'comedyfan@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO fan3_id;

  -- Fan 4: Art collector
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'artfan@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO fan4_id;

  -- Create creator accounts
  -- Creator 1: Singer
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'singer@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO creator1_id;

  -- Creator 2: Athlete
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'athlete@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO creator2_id;

  -- Creator 3: Comedian
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'comedian@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO creator3_id;

  -- Creator 4: Artist
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'artist@example.com', crypt('password123', gen_salt('bf')), now(), now(), now())
  RETURNING id INTO creator4_id;

  -- Create fan user profiles
  -- Fan 1: Music lover
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at, bio)
  VALUES (fan1_id, 'musicfan@example.com', 'fan', 'Music Lover', 300.00, 'active', now(), 'Passionate about all genres of music, especially rock and jazz.');

  -- Fan 2: Sports enthusiast
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at, bio)
  VALUES (fan2_id, 'sportsfan@example.com', 'fan', 'Sports Enthusiast', 250.00, 'active', now(), 'Dedicated sports fan who loves football, basketball, and tennis.');

  -- Fan 3: Comedy fan
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at, bio)
  VALUES (fan3_id, 'comedyfan@example.com', 'fan', 'Comedy Fan', 400.00, 'active', now(), 'Always looking for a good laugh. Stand-up comedy enthusiast.');

  -- Fan 4: Art collector
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at, bio)
  VALUES (fan4_id, 'artfan@example.com', 'fan', 'Art Collector', 350.00, 'active', now(), 'Passionate about visual arts and supporting creative talents.');

  -- Create creator user profiles
  -- Creator 1: Singer
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at)
  VALUES (creator1_id, 'singer@example.com', 'creator', 'Sarah Singer', 0.00, 'active', now());

  -- Creator 2: Athlete
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at)
  VALUES (creator2_id, 'athlete@example.com', 'creator', 'Alex Athlete', 0.00, 'active', now());

  -- Creator 3: Comedian
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at)
  VALUES (creator3_id, 'comedian@example.com', 'creator', 'Chris Comedian', 0.00, 'active', now());

  -- Creator 4: Artist
  INSERT INTO users (id, email, role, name, wallet_balance, status, created_at)
  VALUES (creator4_id, 'artist@example.com', 'creator', 'Ava Artist', 0.00, 'active', now());

  -- Create creator profiles
  -- Creator 1: Singer
  INSERT INTO creator_profiles (id, name, category, bio, price, delivery_time, avatar_url, banner_url, social_links, created_at)
  VALUES (
    creator1_id,
    'Sarah Singer',
    'musician',
    'Professional vocalist with 8 years of experience. Specializing in pop, R&B, and jazz. I can create personalized song covers or original compositions for any occasion.',
    120.00,
    '48 hours',
    'https://images.unsplash.com/photo-1516575150278-77136aed6920?w=500',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200',
    '{
      "website": "https://example.com/sarahsinger",
      "instagram": "https://instagram.com/sarahsinger",
      "youtube": "https://youtube.com/sarahsinger"
    }',
    now()
  );

  -- Creator 2: Athlete
  INSERT INTO creator_profiles (id, name, category, bio, price, delivery_time, avatar_url, banner_url, social_links, created_at)
  VALUES (
    creator2_id,
    'Alex Athlete',
    'athlete',
    'Professional basketball player with motivational speaking experience. I can create personalized pep talks, training tips, or celebration messages for sports fans.',
    150.00,
    '24 hours',
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200',
    '{
      "website": "https://example.com/alexathlete",
      "instagram": "https://instagram.com/alexathlete",
      "twitter": "https://twitter.com/alexathlete"
    }',
    now()
  );

  -- Creator 3: Comedian
  INSERT INTO creator_profiles (id, name, category, bio, price, delivery_time, avatar_url, banner_url, social_links, created_at)
  VALUES (
    creator3_id,
    'Chris Comedian',
    'comedian',
    'Stand-up comedian with a knack for personalized humor. I can create custom jokes, roasts, or funny birthday messages that will leave everyone laughing.',
    90.00,
    '36 hours',
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=500',
    'https://images.unsplash.com/photo-1525921429624-479b6a26d84d?w=1200',
    '{
      "website": "https://example.com/chriscomedian",
      "instagram": "https://instagram.com/chriscomedian",
      "tiktok": "https://tiktok.com/@chriscomedian"
    }',
    now()
  );

  -- Creator 4: Artist
  INSERT INTO creator_profiles (id, name, category, bio, price, delivery_time, avatar_url, banner_url, social_links, created_at)
  VALUES (
    creator4_id,
    'Ava Artist',
    'artist',
    'Visual artist specializing in digital illustrations and animations. I can create personalized artwork, animated messages, or custom designs for any special occasion.',
    180.00,
    '72 hours',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1200',
    '{
      "website": "https://example.com/avaartist",
      "instagram": "https://instagram.com/avaartist",
      "behance": "https://behance.net/avaartist"
    }',
    now()
  );

  -- Create sample video ads for each creator
  -- Creator 1: Singer
  INSERT INTO video_ads (creator_id, title, description, price, duration, thumbnail_url, requirements, active, created_at)
  VALUES (
    creator1_id,
    'Custom Song Cover',
    'I will record a personalized cover of your favorite song with custom lyrics mentioning names and special occasions.',
    120.00,
    '48 hours',
    'https://images.unsplash.com/photo-1516575150278-77136aed6920?w=500',
    'Please provide the song you want covered, any specific lyrics to include, and details about the occasion.',
    true,
    now()
  );

  -- Creator 2: Athlete
  INSERT INTO video_ads (creator_id, title, description, price, duration, thumbnail_url, requirements, active, created_at)
  VALUES (
    creator2_id,
    'Motivational Sports Message',
    'I will create a personalized motivational message for athletes, teams, or sports fans to inspire and encourage.',
    150.00,
    '24 hours',
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500',
    'Please provide details about the recipient, their sport, upcoming events, and any specific motivational themes.',
    true,
    now()
  );

  -- Creator 3: Comedian
  INSERT INTO video_ads (creator_id, title, description, price, duration, thumbnail_url, requirements, active, created_at)
  VALUES (
    creator3_id,
    'Custom Comedy Roast',
    'I will create a hilarious but friendly roast for birthdays, retirements, or any celebration where laughter is needed.',
    90.00,
    '36 hours',
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=500',
    'Please provide details about the person being roasted, their personality, hobbies, and any specific topics to avoid.',
    true,
    now()
  );

  -- Creator 4: Artist
  INSERT INTO video_ads (creator_id, title, description, price, duration, thumbnail_url, requirements, active, created_at)
  VALUES (
    creator4_id,
    'Animated Digital Art Message',
    'I will create a custom animated digital artwork with a personalized message integrated into the design.',
    180.00,
    '72 hours',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=500',
    'Please provide details about the recipient, preferred art style, color themes, and the message to be included.',
    true,
    now()
  );

END $$;
