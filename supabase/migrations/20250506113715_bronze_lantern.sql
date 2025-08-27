-- Add email column to support_tickets if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'email'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN email text;
  END IF;
END $$;

-- Enable RLS on support_tickets table
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Add policy to allow public to insert support tickets (contact form submissions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_tickets' AND policyname = 'Allow public to submit contact forms'
  ) THEN
    CREATE POLICY "Allow public to submit contact forms"
      ON support_tickets
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;

-- Add policy for users to view their own tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_tickets' AND policyname = 'Users can view their own tickets'
  ) THEN
    CREATE POLICY "Users can view their own tickets"
      ON support_tickets
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

-- Add policy for admins to manage all tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_tickets' AND policyname = 'Admins can manage all tickets'
  ) THEN
    CREATE POLICY "Admins can manage all tickets"
      ON support_tickets
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Create function to notify admins of new tickets
CREATE OR REPLACE FUNCTION notify_admin_of_new_ticket()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create notifications for all admin users
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type
  )
  SELECT
    id,
    'פנייה חדשה התקבלה',
    'פנייה חדשה התקבלה בנושא: ' || NEW.subject,
    'system',
    NEW.id,
    'support_ticket'
  FROM users
  WHERE role = 'admin';
  
  RETURN NEW;
END;
$$;

-- Create trigger for new ticket notifications
DROP TRIGGER IF EXISTS new_ticket_notification_trigger ON support_tickets;
CREATE TRIGGER new_ticket_notification_trigger
AFTER INSERT ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION notify_admin_of_new_ticket();
