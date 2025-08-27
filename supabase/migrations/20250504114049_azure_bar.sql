/*
  # Fix creator_profiles RLS policies

  1. Changes
    - Drop existing policies that might be causing issues
    - Create new policies to ensure both public and authenticated users can view creator profiles
    - Add policy for creators to manage their own profiles
  
  2. Security
    - Maintain proper access control while fixing visibility issues
*/

-- Enable RLS on creator_profiles table
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Anyone can view creator profiles" ON creator_profiles;
  DROP POLICY IF EXISTS "Creators can manage their profile" ON creator_profiles;
  DROP POLICY IF EXISTS "Allow public to insert creator profiles during signup" ON creator_profiles;
  DROP POLICY IF EXISTS "Allow authenticated to insert creator profiles" ON creator_profiles;
END $$;

-- Create new policies with proper permissions
-- Policy for public to view active creator profiles
CREATE POLICY "Public can view active creator profiles"
ON creator_profiles
FOR SELECT
TO public
USING (
  active = true OR active IS NULL
);

-- Policy for authenticated users to view all creator profiles
CREATE POLICY "Authenticated users can view all creator profiles"
ON creator_profiles
FOR SELECT
TO authenticated
USING (true);

-- Policy for creators to manage their own profile
CREATE POLICY "Creators can manage their own profile"
ON creator_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy to allow public insertion during signup
CREATE POLICY "Allow public to insert creator profiles during signup"
ON creator_profiles
FOR INSERT
TO public
WITH CHECK (true);

-- Policy to allow authenticated users to insert creator profiles
CREATE POLICY "Allow authenticated to insert creator profiles"
ON creator_profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'fix_creator_profiles_rls',
  'creator_profiles',
  NULL,
  jsonb_build_object(
    'description', 'Fixed RLS policies for creator_profiles table',
    'timestamp', now()
  )
);
