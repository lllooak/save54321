/*
  # Add update_platform_fee function

  1. Changes
    - Create a function to update platform fee
    - Ensure platform fee is stored as a numeric value
    - Add validation for fee percentage range
  
  2. Security
    - Function is accessible to authenticated users
    - Validation prevents invalid fee percentages
*/

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
  INSERT INTO platform_config (key, value, updated_at)
  VALUES ('platform_fee', to_jsonb(p_fee_percentage), NOW())
  ON CONFLICT (key)
  DO UPDATE SET
    value = to_jsonb(p_fee_percentage),
    updated_at = NOW();

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
