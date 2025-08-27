/*
  # Add PayPal integration support

  1. New Tables
    - No new tables needed, using platform_config for settings

  2. Functions
    - Add function to get PayPal configuration
    - Add function to update PayPal configuration
*/

-- Create function to get PayPal configuration
CREATE OR REPLACE FUNCTION get_paypal_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_value jsonb;
BEGIN
  SELECT value INTO config_value
  FROM platform_config
  WHERE key = 'paypal_config';
  
  RETURN COALESCE(config_value, '{
    "client_id": "",
    "client_secret": "",
    "environment": "sandbox",
    "webhook_id": "",
    "currency": "ILS",
    "auto_capture": true,
    "enabled": false,
    "last_tested": null,
    "test_status": null
  }'::jsonb);
END;
$$;

-- Create function to update PayPal configuration
CREATE OR REPLACE FUNCTION update_paypal_config(
  p_client_id text,
  p_client_secret text,
  p_environment text,
  p_webhook_id text DEFAULT NULL,
  p_currency text DEFAULT 'ILS',
  p_auto_capture boolean DEFAULT true,
  p_enabled boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  updated_config jsonb;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only admins can update PayPal configuration'
    );
  END IF;

  -- Build the updated config
  updated_config := jsonb_build_object(
    'client_id', p_client_id,
    'client_secret', p_client_secret,
    'environment', p_environment,
    'webhook_id', p_webhook_id,
    'currency', p_currency,
    'auto_capture', p_auto_capture,
    'enabled', p_enabled,
    'last_updated', now()
  );

  -- Update or insert the config
  INSERT INTO platform_config (key, value, updated_at, updated_by)
  VALUES ('paypal_config', updated_config, now(), auth.uid())
  ON CONFLICT (key)
  DO UPDATE SET
    value = updated_config,
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING jsonb_build_object(
    'success', true,
    'config', value
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_paypal_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_paypal_config(text, text, text, text, text, boolean, boolean) TO authenticated;
