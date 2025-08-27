/*
  # Add user profile fields

  1. Changes
    - Add profile-related columns to users table
    - Add metadata column for additional user information
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add profile fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
