-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create new policies with proper permissions
CREATE POLICY "Allow system functions to create audit logs"
ON audit_logs
FOR INSERT
TO PUBLIC
WITH CHECK (true);

CREATE POLICY "Admins can view audit logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Grant necessary permissions
GRANT INSERT ON audit_logs TO PUBLIC;
GRANT SELECT ON audit_logs TO authenticated;
