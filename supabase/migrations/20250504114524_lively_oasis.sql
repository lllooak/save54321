-- Check and update creator profiles to ensure they have active status set correctly
DO $$
BEGIN
  -- Set active = true for all creator profiles where it's NULL
  UPDATE creator_profiles
  SET active = true
  WHERE active IS NULL;
  
  -- Ensure all creator profiles for active users are also active
  UPDATE creator_profiles
  SET active = true
  WHERE id IN (
    SELECT cp.id 
    FROM creator_profiles cp
    JOIN users u ON cp.id = u.id
    WHERE u.status = 'active'
  )
  AND active = false;
  
  -- Log the update
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    details
  ) VALUES (
    'update_creator_active_status',
    'creator_profiles',
    NULL,
    jsonb_build_object(
      'description', 'Updated active status for creator profiles',
      'timestamp', now(),
      'updated_count', (SELECT COUNT(*) FROM creator_profiles WHERE active = true)
    )
  );
END $$;

-- Create a function to ensure new creator profiles have active status set
CREATE OR REPLACE FUNCTION ensure_creator_profile_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If active is NULL, set it to true
  IF NEW.active IS NULL THEN
    NEW.active := true;
  END IF;
  
  -- If the user is active, ensure the creator profile is also active
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.id
    AND status = 'active'
  ) THEN
    NEW.active := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to ensure active status is set correctly
DROP TRIGGER IF EXISTS ensure_creator_profile_active_trigger ON creator_profiles;
CREATE TRIGGER ensure_creator_profile_active_trigger
BEFORE INSERT OR UPDATE ON creator_profiles
FOR EACH ROW
EXECUTE FUNCTION ensure_creator_profile_active();

-- Verify RLS policies are correct
DO $$ 
BEGIN
  -- Ensure the policy for public to view active creator profiles exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Public can view active creator profiles' 
    AND tablename = 'creator_profiles' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Public can view active creator profiles"
    ON creator_profiles
    FOR SELECT
    TO public
    USING (active = true);
  END IF;

  -- Ensure the policy for authenticated users to view all creator profiles exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Authenticated users can view all creator profiles' 
    AND tablename = 'creator_profiles' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Authenticated users can view all creator profiles"
    ON creator_profiles
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
