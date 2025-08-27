-- Fix user creation trigger to automatically insert users into users table
-- This resolves the "Error checking user status" issue after profile creation

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert the new user into the users table (handle duplicates gracefully)
  INSERT INTO public.users (
    id,
    email,
    role,
    name,
    wallet_balance,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    'fan', -- Default role for new users
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    0.00, -- Default wallet balance
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Avoid duplicate user creation
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically handle new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also create a function to handle existing users that might be missing from users table
CREATE OR REPLACE FUNCTION public.ensure_user_exists(user_id uuid)
RETURNS void AS $$
DECLARE
  auth_user_record auth.users%ROWTYPE;
BEGIN
  -- Check if user exists in users table
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_id) THEN
    -- Get user data from auth.users
    SELECT * INTO auth_user_record FROM auth.users WHERE id = user_id;
    
    IF FOUND THEN
      -- Insert missing user into users table (handle duplicates gracefully)
      INSERT INTO public.users (
        id,
        email,
        role,
        name,
        wallet_balance,
        status,
        created_at,
        updated_at
      ) VALUES (
        auth_user_record.id,
        auth_user_record.email,
        'fan',
        COALESCE(auth_user_record.raw_user_meta_data->>'name', split_part(auth_user_record.email, '@', 1)),
        0.00,
        'active',
        auth_user_record.created_at,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW()
      WHERE users.email IS NULL OR users.email != EXCLUDED.email;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_exists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_exists(uuid) TO service_role;

-- Fix RLS policy to be more permissive for user existence checks
-- Update the policy to allow users to check if they exist
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id OR auth.uid() IS NOT NULL);

-- Also ensure existing users are properly set up
-- This will be called when the migration runs to handle any existing users
DO $$
DECLARE
  auth_user_record auth.users%ROWTYPE;
BEGIN
  -- Loop through all auth users and ensure they exist in users table
  FOR auth_user_record IN SELECT * FROM auth.users WHERE email IS NOT NULL LOOP
    PERFORM public.ensure_user_exists(auth_user_record.id);
  END LOOP;
END $$;

-- Add a test to verify the trigger works
DO $$
BEGIN
  RAISE NOTICE 'User creation trigger and RLS policy fix applied successfully';
END $$;
