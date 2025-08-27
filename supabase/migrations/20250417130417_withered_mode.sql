-- Ensure RLS is disabled for platform_config table
ALTER TABLE platform_config DISABLE ROW LEVEL SECURITY;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_config' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE platform_config 
    ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add unique constraint on key if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'platform_config_key_key'
  ) THEN
    ALTER TABLE platform_config 
    ADD CONSTRAINT platform_config_key_key UNIQUE (key);
  END IF;
END $$;

-- Initialize default settings if they don't exist
INSERT INTO platform_config (key, value)
VALUES 
  ('platform_fee', 10),
  ('min_request_price', 5),
  ('max_request_price', 1000),
  ('default_delivery_time', 24),
  ('max_delivery_time', 72),
  ('allowed_file_types', ARRAY['mp4', 'mov', 'avi']),
  ('max_file_size', 100),
  ('auto_approve_creators', false),
  ('require_email_verification', true),
  ('enable_disputes', true),
  ('dispute_window', 48),
  ('payout_threshold', 50),
  ('payout_schedule', 'weekly')
ON CONFLICT (key) DO NOTHING;
