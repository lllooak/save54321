-- Check if audit_logs table exists (needed by withdrawal admin functions)
-- Run this in Supabase SQL Editor

-- 1. Check if audit_logs table exists
SELECT 
  table_name,
  'audit_logs table status' as info
FROM information_schema.tables 
WHERE table_name = 'audit_logs';

-- 2. If it doesn't exist, check what audit/log tables do exist
SELECT 
  table_name,
  'Tables containing audit or log' as info
FROM information_schema.tables 
WHERE table_name ILIKE '%audit%' OR table_name ILIKE '%log%';

-- 3. Check if the admin functions can work without audit_logs
-- Test a simple withdrawal function that doesn't use audit_logs
SELECT 'Testing admin_get_withdrawal_requests_count (does not use audit_logs)' as test;
