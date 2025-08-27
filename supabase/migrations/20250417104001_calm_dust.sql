/*
  # Add wallet system

  1. New Tables
    - wallet_transactions: Tracks all wallet transactions
    - Add wallet_balance to users table
  
  2. Security
    - Enable RLS
    - Add policies for users to view their own transactions
    - Add policies for admins to view all transactions
*/

-- Add wallet_balance to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_balance numeric DEFAULT 0 CHECK (wallet_balance >= 0);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('top_up', 'purchase', 'refund')),
  amount numeric NOT NULL,
  payment_method text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  reference_id text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own transactions"
ON wallet_transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own transactions"
ON wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create function to update user balance
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'completed' THEN
    IF NEW.type = 'top_up' THEN
      UPDATE users 
      SET wallet_balance = wallet_balance + NEW.amount
      WHERE id = NEW.user_id;
    ELSIF NEW.type = 'purchase' THEN
      UPDATE users 
      SET wallet_balance = wallet_balance - NEW.amount
      WHERE id = NEW.user_id;
    ELSIF NEW.type = 'refund' THEN
      UPDATE users 
      SET wallet_balance = wallet_balance + NEW.amount
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for wallet balance updates
CREATE TRIGGER update_wallet_balance_trigger
AFTER UPDATE OF payment_status ON wallet_transactions
FOR EACH ROW
WHEN (OLD.payment_status != 'completed' AND NEW.payment_status = 'completed')
EXECUTE FUNCTION update_wallet_balance();
