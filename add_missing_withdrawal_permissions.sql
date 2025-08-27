-- Add only missing withdrawal permissions - skip if exists
-- Run this in Supabase SQL Editor

-- 1. Try to create INSERT policy (will skip if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'withdrawal_requests' 
    AND policyname = 'Creators can create their own withdrawal requests'
  ) THEN
    EXECUTE 'CREATE POLICY "Creators can create their own withdrawal requests" ON withdrawal_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id)';
    RAISE NOTICE 'Created INSERT policy for withdrawal_requests';
  ELSE
    RAISE NOTICE 'INSERT policy already exists';
  END IF;
END
$$;

-- 2. Create or replace the get_available_withdrawal_amount function
CREATE OR REPLACE FUNCTION get_available_withdrawal_amount(p_creator_id uuid)
RETURNS numeric
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  available_amount numeric;
BEGIN
  -- Calculate available withdrawal amount from wallet transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('credit', 'earning') THEN amount
      WHEN type IN ('debit', 'withdrawal') THEN -amount
      ELSE 0
    END
  ), 0) INTO available_amount
  FROM wallet_transactions
  WHERE user_id = p_creator_id;
  
  -- Subtract pending withdrawal requests
  SELECT available_amount - COALESCE(SUM(amount), 0) INTO available_amount
  FROM withdrawal_requests
  WHERE creator_id = p_creator_id AND status = 'pending';
  
  RETURN GREATEST(available_amount, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_withdrawal_amount TO authenticated;

-- 3. Test a withdrawal insertion to see if it works now
SELECT 'Withdrawal permissions setup complete - test withdrawal creation now' as result;
