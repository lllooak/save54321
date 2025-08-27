-- Fix multiple conflicting triggers causing wallet balance doubling
-- Multiple UPDATE AFTER triggers are firing simultaneously

-- Step 1: Get detailed info about each trigger to see what they do
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'requests'
AND event_manipulation = 'UPDATE'
ORDER BY trigger_name;

-- Step 2: Identify which triggers might be updating wallet_balance
-- Run this to see the function code for each trigger
SELECT 
  t.trigger_name,
  r.routine_name,
  r.routine_definition
FROM information_schema.triggers t
JOIN information_schema.routines r ON r.routine_name = REPLACE(t.action_statement, 'EXECUTE FUNCTION ', '')
WHERE t.event_object_table = 'requests'
AND t.event_manipulation = 'UPDATE'
AND r.routine_definition ILIKE '%wallet_balance%';

-- Step 3: EMERGENCY FIX - Drop potentially conflicting triggers
-- Keep only our main earnings trigger, drop others that might update wallet

-- First, let's see what we're about to drop:
SELECT 
  'TRIGGERS TO INVESTIGATE' as action,
  trigger_name,
  'DROP TRIGGER ' || trigger_name || ' ON requests;' as drop_command
FROM information_schema.triggers 
WHERE event_object_table = 'requests'
AND event_manipulation = 'UPDATE'
AND trigger_name != 'update_earnings_on_completion_trigger'  -- Keep our main trigger
ORDER BY trigger_name;

-- Step 4: Drop the problematic triggers (CAREFUL - backup first!)
-- Uncomment these one by one after confirming they're not needed:

-- DROP TRIGGER IF EXISTS affiliate_co ON requests;
-- DROP TRIGGER IF EXISTS earnings_w ON requests;  
-- DROP TRIGGER IF EXISTS request_no ON requests;
-- DROP TRIGGER IF EXISTS request_st ON requests;
-- DROP TRIGGER IF EXISTS trigger_con ON requests;

-- Keep only update_ear (which should be update_earnings_on_completion_trigger)

-- Step 5: Verify only one trigger remains
SELECT 
  'REMAINING TRIGGERS' as verification,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'requests'
ORDER BY trigger_name;

-- Step 6: Test the fix
-- After dropping conflicting triggers, test completing a request
-- The wallet balance should only update once (no more doubling)

-- IMPORTANT NOTES:
-- 1. Some triggers might be needed for other functionality
-- 2. Test carefully after dropping each trigger
-- 3. The goal is to have only ONE trigger that updates wallet_balance
-- 4. Backup your database before making these changes
