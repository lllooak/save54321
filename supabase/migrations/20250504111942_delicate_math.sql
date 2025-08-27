/*
  # Fix creator active status when unblocking users

  1. Changes
    - Add trigger to automatically update creator_profiles.active when user status changes
    - Ensure creator profiles are properly activated/deactivated with user status
  
  2. Security
    - Maintain existing security measures
    - Ensure proper synchronization between users and creator_profiles tables
*/

-- Create function to sync user status with creator profile active status
CREATE OR REPLACE FUNCTION sync_user_status_with_creator_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process when status changes
  IF (NEW.status = OLD.status) THEN
    RETURN NEW;
  END IF;
  
  -- If user is a creator, update their creator profile active status
  IF EXISTS (
    SELECT 1 FROM creator_profiles
    WHERE id = NEW.id
  ) THEN
    -- If user is now active, activate their creator profile
    IF NEW.status = 'active' THEN
      UPDATE creator_profiles
      SET 
        active = true,
        updated_at = NOW()
      WHERE id = NEW.id;
      
      -- Log the activation
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        details
      ) VALUES (
        'activate_creator_profile',
        'creator_profiles',
        NEW.id,
        jsonb_build_object(
          'user_id', NEW.id,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'timestamp', NOW()
        )
      );
    -- If user is now banned, deactivate their creator profile
    ELSIF NEW.status = 'banned' THEN
      UPDATE creator_profiles
      SET 
        active = false,
        updated_at = NOW()
      WHERE id = NEW.id;
      
      -- Log the deactivation
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        details
      ) VALUES (
        'deactivate_creator_profile',
        'creator_profiles',
        NEW.id,
        jsonb_build_object(
          'user_id', NEW.id,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'timestamp', NOW()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error without failing
    RAISE WARNING 'Error in sync_user_status_with_creator_profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to sync user status with creator profile active status
DROP TRIGGER IF EXISTS sync_user_status_with_creator_profile_trigger ON users;
CREATE TRIGGER sync_user_status_with_creator_profile_trigger
AFTER UPDATE OF status ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_status_with_creator_profile();

-- Update existing creator profiles to match user status
DO $$
BEGIN
  -- Activate creator profiles for active users
  UPDATE creator_profiles
  SET active = true
  WHERE id IN (
    SELECT id FROM users
    WHERE status = 'active'
  )
  AND active = false;
  
  -- Deactivate creator profiles for banned users
  UPDATE creator_profiles
  SET active = false
  WHERE id IN (
    SELECT id FROM users
    WHERE status = 'banned'
  )
  AND active = true;
END $$;
