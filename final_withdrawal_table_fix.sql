-- Final fix for withdrawal_requests table creation - handle existing policies
-- Run this in Supabase SQL Editor

-- Insert into platform_config without description column
INSERT INTO platform_config (key, value)
VALUES ('min_withdraw_amount', '50')
ON CONFLICT (key) DO NOTHING;

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('paypal', 'bank')),
  paypal_email text,
  bank_details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at timestamp with time zone,
  notes text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_creator_id ON withdrawal_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);

-- Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can create own withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Authenticated users can read platform config" ON platform_config;

-- Create RLS policies for withdrawal_requests
CREATE POLICY "Users can view own withdrawal requests" ON withdrawal_requests
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Users can create own withdrawal requests" ON withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- Create policy for platform_config
CREATE POLICY "Authenticated users can read platform config" ON platform_config
  FOR SELECT TO authenticated
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON withdrawal_requests TO authenticated;
GRANT ALL ON withdrawal_requests TO service_role;
GRANT SELECT ON platform_config TO authenticated;
GRANT ALL ON platform_config TO service_role;

SELECT 'withdrawal_requests table created successfully with policies' as result;
