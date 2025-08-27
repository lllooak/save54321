/*
  # Update audit logs RLS policies

  1. Changes
    - Add INSERT policy for audit logs table to allow admins to create audit logs
    - Ensure admins can manage audit logs through proper RLS policies

  2. Security
    - Enable RLS on audit_logs table (already enabled)
    - Add policy for admins to insert audit logs
    - Maintain existing SELECT policy for admins
*/

-- Add INSERT policy for admins to create audit logs
CREATE POLICY "Admins can create audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
