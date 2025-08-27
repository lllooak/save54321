/*
  # Add platform fee to platform_config

  1. Changes
    - Ensure platform_fee exists in platform_config table
    - Set default platform fee to 10%
    - Update platform_fee if it already exists but has incorrect format
*/

-- Insert platform_fee into platform_config if it doesn't exist
INSERT INTO platform_config (key, value)
VALUES ('platform_fee', '10')
ON CONFLICT (key) DO UPDATE
SET value = CASE 
  WHEN platform_config.value IS NULL THEN '10'
  WHEN platform_config.value::text = '' THEN '10'
  WHEN platform_config.value::text ~ '^[0-9]+(\.[0-9]+)?$' THEN platform_config.value
  ELSE '10'
END;

-- Create function to update platform fee
CREATE OR REPLACE FUNCTION update_platform_fee(p_fee_percentage numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate fee percentage
  IF p_fee_percentage < 0 OR p_fee_percentage > 100 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Platform fee must be between 0 and 100'
    );
  END IF;

  -- Update platform fee
  UPDATE platform_config
  SET 
    value = p_fee_percentage::text,
    updated_at = NOW()
  WHERE key = 'platform_fee';

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
      'updated_at', NOW()
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
