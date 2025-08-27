/*
  # Add video ads feature

  1. New Tables
    - `video_ads`
      - `id` (uuid, primary key)
      - `creator_id` (uuid, references auth.users)
      - `title` (text)
      - `description` (text)
      - `price` (numeric)
      - `duration` (interval)
      - `thumbnail_url` (text)
      - `sample_video_url` (text)
      - `requirements` (text)
      - `active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on video_ads table
    - Add policies for creators to manage their ads
    - Add policies for users to view active ads
*/

CREATE TABLE IF NOT EXISTS video_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  price numeric NOT NULL,
  duration interval NOT NULL DEFAULT '24:00:00',
  thumbnail_url text,
  sample_video_url text,
  requirements text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE video_ads ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own ads
CREATE POLICY "Creators can manage their own ads"
  ON video_ads
  FOR ALL
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Anyone can view active ads
CREATE POLICY "Anyone can view active ads"
  ON video_ads
  FOR SELECT
  TO authenticated
  USING (active = true);
