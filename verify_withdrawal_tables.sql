-- Verify withdrawal-related tables exist
-- Run this in Supabase SQL Editor

-- 1. Check if withdrawal_requests table exists and its structure
SELECT 'withdrawal_requests table structure' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'withdrawal_requests'
ORDER BY ordinal_position;

-- 2. Check if platform_config table exists (used by min withdrawal functions)
SELECT 'platform_config table structure' as info;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'platform_config'
ORDER BY ordinal_position;

-- 3. Check if audit_logs table exists (used by update functions)
SELECT 'audit_logs table structure' as info;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- 4. Check if creator_profiles table exists (used in JOIN)
SELECT 'creator_profiles table structure' as info;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'creator_profiles'
ORDER BY ordinal_position;
