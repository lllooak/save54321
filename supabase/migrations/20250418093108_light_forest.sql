/*
  # Fix PayPal Integration

  1. Changes
    - Add missing RLS policies for PayPal webhook processing
    - Add functions for transaction validation and logging
    - Fix authentication issues for PayPal webhooks

  2. Security
    - Enable secure webhook processing without authentication
    - Add audit logging for PayPal events
    - Add transaction validation functions
*/

-- Check if policies exist before creating them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'wallet_transactions' 
    AND policyname = 'Allow PayPal webhook processing'
  ) THEN
    -- Add policy to allow PayPal webhook processing
    CREATE POLICY "Allow PayPal webhook processing"
      ON wallet_transactions
      FOR ALL
      TO public
      USING (payment_method = 'paypal')
      WITH CHECK (payment_method = 'paypal');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'wallet_transactions' 
    AND policyname = 'Users can view their own transactions'
  ) THEN
    -- Add policy to allow users to view their own transactions
    CREATE POLICY "Users can view their own transactions"
      ON wallet_transactions
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'wallet_transactions' 
    AND policyname = 'Users can create their own transactions'
  ) THEN
    -- Add policy to allow users to create their own transactions
    CREATE POLICY "Users can create their own transactions"
      ON wallet_transactions
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Create or replace function to validate PayPal transaction
CREATE OR REPLACE FUNCTION validate_paypal_transaction(
  p_transaction_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM wallet_transactions
    WHERE id = p_transaction_id
    AND user_id = p_user_id
    AND payment_method = 'paypal'
  );
END;
$$;

-- Create or replace function to log PayPal events
CREATE OR REPLACE FUNCTION log_paypal_event(
  p_event_type TEXT,
  p_transaction_id UUID,
  p_details JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    entity,
    entity_id,
    details
  ) VALUES (
    'paypal_' || p_event_type,
    'wallet_transactions',
    p_transaction_id::TEXT,
    p_details
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_paypal_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION log_paypal_event TO authenticated;
