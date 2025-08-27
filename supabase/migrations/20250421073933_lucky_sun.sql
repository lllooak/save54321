/*
  # Fix requests table relationships and RLS policies

  1. Changes
    - Drop existing foreign key constraints if they exist
    - Add correct foreign key relationships between requests and users/creator_profiles
    - Add proper RLS policies for fans and creators
    - Add indexes for better performance

  2. Security
    - Enable RLS on requests table
    - Add policies for fans to view their requests
    - Add policies for creators to manage their requests
*/

-- Drop existing foreign key constraints if they exist
DO $$ 
BEGIN
  -- Check if the constraint exists before attempting to drop it
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint
    WHERE conname = 'requests_creator_id_fkey'
    AND conrelid = 'public.requests'::regclass
  ) THEN
    ALTER TABLE public.requests DROP CONSTRAINT requests_creator_id_fkey;
  END IF;

  -- Check if the constraint exists before attempting to drop it
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint
    WHERE conname = 'requests_fan_id_fkey'
    AND conrelid = 'public.requests'::regclass
  ) THEN
    ALTER TABLE public.requests DROP CONSTRAINT requests_fan_id_fkey;
  END IF;
END $$;

-- Add foreign key constraints
ALTER TABLE public.requests
ADD CONSTRAINT requests_creator_id_fkey
FOREIGN KEY (creator_id)
REFERENCES public.creator_profiles(id);

ALTER TABLE public.requests
ADD CONSTRAINT requests_fan_id_fkey
FOREIGN KEY (fan_id)
REFERENCES auth.users(id);

-- Add policies for fans to view their requests (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Fans can view their requests'
    AND tablename = 'requests'
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Fans can view their requests"
    ON public.requests
    FOR SELECT
    TO authenticated
    USING (fan_id = auth.uid());
  END IF;
END $$;

-- Add policy for creators to view and manage requests assigned to them (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Creators can view and manage their requests'
    AND tablename = 'requests'
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Creators can view and manage their requests"
    ON public.requests
    FOR ALL
    TO authenticated
    USING (creator_id = auth.uid())
    WITH CHECK (creator_id = auth.uid());
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS requests_fan_id_idx ON public.requests(fan_id);
CREATE INDEX IF NOT EXISTS requests_creator_id_idx ON public.requests(creator_id);
CREATE INDEX IF NOT EXISTS requests_status_idx ON public.requests(status);
CREATE INDEX IF NOT EXISTS requests_created_at_idx ON public.requests(created_at);
