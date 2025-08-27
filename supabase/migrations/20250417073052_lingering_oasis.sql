/*
  # Initial schema setup for creator platform

  1. New Tables
    - requests
    - messages
    - earnings
    - creator_profiles
    - reviews

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id),
  fan_id uuid REFERENCES auth.users(id),
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  price numeric NOT NULL,
  message text,
  deadline timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id),
  receiver_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create earnings table
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id),
  request_id uuid REFERENCES requests(id),
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Create creator_profiles table
CREATE TABLE IF NOT EXISTS creator_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text NOT NULL,
  category text NOT NULL,
  bio text,
  price numeric NOT NULL,
  delivery_time interval NOT NULL DEFAULT '24 hours',
  avatar_url text,
  banner_url text,
  social_links jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id),
  fan_id uuid REFERENCES auth.users(id),
  request_id uuid REFERENCES requests(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Creators can view their own requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can update their own requests"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Users can view their messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Creators can view their earnings"
  ON earnings
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can manage their profile"
  ON creator_profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Anyone can view creator profiles"
  ON creator_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view reviews"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Fans can create reviews"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (fan_id = auth.uid());

-- Create function to get creator stats
CREATE OR REPLACE FUNCTION get_creator_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'pendingRequests', (
      SELECT COUNT(*) 
      FROM requests 
      WHERE creator_id = auth.uid() AND status = 'pending'
    ),
    'completedRequests', (
      SELECT COUNT(*) 
      FROM requests 
      WHERE creator_id = auth.uid() AND status = 'completed'
    ),
    'totalEarnings', (
      SELECT COALESCE(SUM(amount), 0) 
      FROM earnings 
      WHERE creator_id = auth.uid() AND status = 'paid'
    ),
    'averageRating', (
      SELECT COALESCE(AVG(rating), 0) 
      FROM reviews 
      WHERE creator_id = auth.uid()
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
