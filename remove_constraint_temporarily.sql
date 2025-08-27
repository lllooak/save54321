-- Temporarily remove wallet_transactions constraint to allow video upload
-- Run this in Supabase SQL Editor

-- Remove the problematic constraint completely
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Check what transaction types exist after removing constraint
SELECT 'Constraint removed - try video upload now' as message;

-- After video upload succeeds, run this to see what type was inserted:
-- SELECT DISTINCT type, COUNT(*) FROM wallet_transactions GROUP BY type ORDER BY type;
