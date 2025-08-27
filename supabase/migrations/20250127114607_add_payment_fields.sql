-- Add payment method and details fields to users table for affiliate payouts

-- Add payment_method field (paypal or bank_transfer)
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Add payment_details field as JSONB to store method-specific details
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_details JSONB;

-- Create an index on payment_method for better query performance
CREATE INDEX IF NOT EXISTS idx_users_payment_method ON users(payment_method);

-- Update RLS policies to allow users to update their own payment details
-- (The existing update policy should already cover this, but let's ensure it's explicit)
