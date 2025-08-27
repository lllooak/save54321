-- Fix withdrawal_requests insert permissions for creators
-- Run this in Supabase SQL Editor

-- 1. Check current RLS policies on withdrawal_requests
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'withdrawal_requests';

-- 2. Check if creators can insert withdrawal requests
SELECT 'Testing creator INSERT permission:' as info;

-- 3. Add INSERT policy for creators to create their own withdrawal requests
CREATE POLICY "Creators can create their own withdrawal requests"
ON withdrawal_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

-- 4. Check if get_available_withdrawal_amount function exists
SELECT 'Checking get_available_withdrawal_amount function:' as info;
SELECT routine_name, routine_type, data_type
FROM information_schema.routines 
WHERE routine_name = 'get_available_withdrawal_amount';

-- 5. Create the get_available_withdrawal_amount function if missing
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

-- 6. Test the withdrawal creation process
SELECT 'Withdrawal insert permissions and function updated' as result;

-- 7. Also make sure creators can read their own withdrawal requests
CREATE POLICY "Creators can view their own withdrawal requests"
ON withdrawal_requests
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

SELECT 'All withdrawal permissions updated' as final_result;
