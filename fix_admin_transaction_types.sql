-- Fix wallet_transactions_type_check constraint to include admin transaction types
-- This fixes the error: "new row for relation "wallet_transactions" violates check constraint "wallet_transactions_type_check"

-- First, drop the existing constraint
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Add the updated constraint that includes admin transaction types
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type IN ('top_up', 'purchase', 'refund', 'earnings', 'admin_adjustment', 'admin_deduction'));

-- Verify the constraint was applied successfully
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'wallet_transactions_type_check';
