-- Debug script for request completion errors
-- Run this to diagnose what's failing when completing requests

-- 1. Check if our trigger function exists and is properly set up
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'update_earnings_and_wallet_on_completion';

-- 2. Check if the trigger exists on the requests table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'update_earnings_and_wallet_on_completion_trigger';

-- 3. Check if the RPC function exists and is accessible
SELECT 
    routine_name,
    routine_type,
    specific_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'complete_request_and_pay_creator';

-- 4. Test the RPC function with a sample request (replace with actual request ID)
-- First, let's see what pending/approved requests exist
SELECT 
    id,
    creator_id,
    status,
    price,
    created_at,
    deadline
FROM requests 
WHERE status IN ('pending', 'approved')
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check if there are any earnings records for these requests
SELECT 
    e.id,
    e.request_id,
    e.creator_id,
    e.amount,
    e.status,
    r.status as request_status
FROM earnings e
JOIN requests r ON e.request_id = r.id
WHERE r.status IN ('pending', 'approved')
ORDER BY e.created_at DESC
LIMIT 5;

-- 6. Check recent error logs in Supabase (if audit_logs table exists)
SELECT 
    action,
    entity,
    details,
    created_at
FROM audit_logs 
WHERE action LIKE '%error%' 
   OR details::text LIKE '%error%'
ORDER BY created_at DESC
LIMIT 10;

-- 7. Test the trigger function logic manually
-- This simulates what happens when a request is completed
DO $$
DECLARE
    test_request_id uuid;
    test_creator_id uuid;
    result_text text;
BEGIN
    -- Get a test request that's approved but not completed
    SELECT id, creator_id INTO test_request_id, test_creator_id
    FROM requests 
    WHERE status = 'approved' 
    LIMIT 1;
    
    IF test_request_id IS NOT NULL THEN
        RAISE NOTICE 'Found test request: % for creator: %', test_request_id, test_creator_id;
        
        -- Check if earnings exist for this request
        IF EXISTS (SELECT 1 FROM earnings WHERE request_id = test_request_id) THEN
            RAISE NOTICE 'Earnings record exists for request %', test_request_id;
        ELSE
            RAISE NOTICE 'NO earnings record found for request %', test_request_id;
        END IF;
        
        -- Check creator's current wallet balance
        SELECT wallet_balance INTO result_text FROM users WHERE id = test_creator_id;
        RAISE NOTICE 'Creator current wallet balance: %', result_text;
        
    ELSE
        RAISE NOTICE 'No approved requests found for testing';
    END IF;
END;
$$;

-- 8. Check for any foreign key constraints that might be failing
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (tc.table_name IN ('earnings', 'wallet_transactions', 'audit_logs', 'requests'));

-- 9. Check table permissions for authenticated users
SELECT 
    table_name,
    privilege_type
FROM information_schema.table_privileges 
WHERE grantee = 'authenticated' 
AND table_name IN ('earnings', 'wallet_transactions', 'audit_logs', 'requests', 'users');
