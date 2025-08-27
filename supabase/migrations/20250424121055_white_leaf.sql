/*
  # Fix messages table foreign key relationships

  1. Changes
    - Add foreign key constraints from messages.sender_id and messages.receiver_id to auth.users.id
    - This enables proper joins in queries using the sender:users and receiver:users syntax
  
  2. Security
    - Maintains existing RLS policies
    - Ensures proper data integrity with foreign key constraints
*/

-- Drop existing foreign key constraints if they exist
DO $$ 
BEGIN
  -- Check if the constraint exists before attempting to drop it
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint
    WHERE conname = 'messages_sender_id_fkey'
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_sender_id_fkey;
  END IF;

  -- Check if the constraint exists before attempting to drop it
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint
    WHERE conname = 'messages_receiver_id_fkey'
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_receiver_id_fkey;
  END IF;
END $$;

-- Add foreign key constraints
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id)
REFERENCES auth.users(id);

ALTER TABLE public.messages
ADD CONSTRAINT messages_receiver_id_fkey
FOREIGN KEY (receiver_id)
REFERENCES auth.users(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);
