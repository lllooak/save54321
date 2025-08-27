/*
  # Enable RLS on platform_config table

  1. Changes
    - Enable Row Level Security on platform_config table
    - Add policies for admins to manage platform config
    - Add policies for authenticated users to read platform config
  
  2. Security
    - Ensure only admins can modify platform configuration
    - Allow all authenticated users to read platform configuration
*/

-- Enable RLS on platform_config table
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage platform config" ON platform_config;
DROP POLICY IF EXISTS "Authenticated users can read platform config" ON platform_config;

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

-- Add function to update platform fee with admin check
CREATE OR REPLACE FUNCTION update_platform_fee(p_fee_percentage numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
BEGIN
  -- Check if the current user is an admin
  SELECT role INTO v_admin_role
  FROM users
  WHERE id = auth.uid();
  
  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can update platform fee'
    );
  END IF;

  -- Validate fee percentage
  IF p_fee_percentage < 0 OR p_fee_percentage > 100 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Platform fee must be between 0 and 100'
    );
  END IF;

  -- Update platform fee
  INSERT INTO platform_config (key, value, updated_at, updated_by)
  VALUES ('platform_fee', to_jsonb(p_fee_percentage), now(), auth.uid())
  ON CONFLICT (key)
  DO UPDATE SET
    value = to_jsonb(p_fee_percentage),
    updated_at = now(),
    updated_by = auth.uid();

  -- Log the update
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    user_id,
    details
  ) VALUES (
    'update_platform_fee',
    'platform_config',
    NULL,
    auth.uid(),
    jsonb_build_object(
      'new_fee_percentage', p_fee_percentage,
      'updated_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'platform_fee', p_fee_percentage
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_platform_fee TO authenticated;
