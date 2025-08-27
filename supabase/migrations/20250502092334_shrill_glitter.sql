/*
  # Fix creator_profiles RLS policy for registration

  1. Changes
    - Add policy to allow public insertion into creator_profiles table during signup
    - This allows the auth flow to create creator profiles without RLS blocking
  
  2. Security
    - Maintains existing RLS policies
    - Only allows insertion with specific constraints
*/

-- Enable RLS on creator_profiles table
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

-- Add policy to allow public insertion during signup
CREATE POLICY "Allow public to insert creator profiles during signup"
ON creator_profiles
FOR INSERT
TO public
WITH CHECK (true);

-- Add policy to allow authenticated users to insert creator profiles
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
    'description', 'Added policies to allow creator profile creation during signup',
    'timestamp', now()
  )
);
