/*
  # Add withdrawal requests functionality

  1. New Tables
    - `withdrawal_requests`: Stores creator withdrawal requests
      - `id` (uuid, primary key)
      - `creator_id` (uuid, references creator_profiles)
      - `amount` (numeric)
      - `method` (text)
      - `paypal_email` (text)
      - `bank_details` (text)
      - `status` (text)
      - `created_at` (timestamptz)
      - `processed_at` (timestamptz)

  2. Security
    - Enable RLS on withdrawal_requests table
    - Add policies for creators to view their own requests
    - Add policies for admins to manage all requests
*/

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES creator_profiles(id),
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('paypal', 'bank')),
  paypal_email text,
  bank_details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Creators can view their own withdrawal requests"
  ON withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can insert their own withdrawal requests"
  ON withdrawal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Admins can manage all withdrawal requests"
  ON withdrawal_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add minimum withdrawal amount to platform_config
-- Fix: Convert integer to JSONB using to_jsonb()
INSERT INTO platform_config (key, value)
VALUES ('min_withdraw_amount', to_jsonb(50))
ON CONFLICT (key) DO NOTHING;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS withdrawal_requests_creator_id_idx ON withdrawal_requests(creator_id);
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_idx ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS withdrawal_requests_created_at_idx ON withdrawal_requests(created_at);

-- Create function to check if withdrawal amount meets minimum requirement
CREATE OR REPLACE FUNCTION check_withdrawal_minimum()
RETURNS TRIGGER AS $$
DECLARE
  min_amount numeric;
BEGIN
  -- Get minimum withdrawal amount from platform_config
  SELECT COALESCE(
    (SELECT (value)::numeric FROM platform_config WHERE key = 'min_withdraw_amount'),
    50 -- Default to 50 if not configured
  ) INTO min_amount;
  
  -- Check if withdrawal amount meets minimum requirement
  IF NEW.amount < min_amount THEN
    RAISE EXCEPTION 'Withdrawal amount must be at least %', min_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check minimum withdrawal amount
CREATE TRIGGER check_withdrawal_minimum_trigger
BEFORE INSERT ON withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION check_withdrawal_minimum();
