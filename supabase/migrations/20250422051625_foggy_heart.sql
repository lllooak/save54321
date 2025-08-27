-- Enable RLS on platform_config table
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can manage platform config' 
    AND tablename = 'platform_config' 
    AND schemaname = 'public'
  ) THEN
    DROP POLICY "Admins can manage platform config" ON platform_config;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Authenticated users can read platform config' 
    AND tablename = 'platform_config' 
    AND schemaname = 'public'
  ) THEN
    DROP POLICY "Authenticated users can read platform config" ON platform_config;
  END IF;
END $$;

-- Create policy for admins to manage platform config
CREATE POLICY "Admins can manage platform config"
ON platform_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Create policy for authenticated users to read platform config
CREATE POLICY "Authenticated users can read platform config"
ON platform_config
FOR SELECT
TO authenticated
USING (true);

-- Fix users table RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view own data' 
    AND tablename = 'users' 
    AND schemaname = 'public'
  ) THEN
    DROP POLICY "Users can view own data" ON users;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update own data' 
    AND tablename = 'users' 
    AND schemaname = 'public'
  ) THEN
    DROP POLICY "Users can update own data" ON users;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can manage all users' 
    AND tablename = 'users' 
    AND schemaname = 'public'
  ) THEN
    DROP POLICY "Admins can manage all users" ON users;
  END IF;
END $$;

-- Create new policies
CREATE POLICY "Users can view own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all users"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_all_users();

-- Create function to get all users (for admin use)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user is an admin
  IF EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ) THEN
    RETURN QUERY SELECT * FROM users ORDER BY created_at DESC;
  ELSE
    RAISE EXCEPTION 'Only administrators can access all users';
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
