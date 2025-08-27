-- Simple schema check for wallet_transactions

-- Just get the basic column info
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'wallet_transactions';

-- Check what our unique index looks like
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'wallet_transactions' AND indexname LIKE '%unique%';

-- Show a sample row to see actual data types
SELECT id, user_id, type, reference_id, amount FROM wallet_transactions LIMIT 1;
