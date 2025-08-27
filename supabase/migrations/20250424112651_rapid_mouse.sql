-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('message', 'payment', 'request', 'system')),
  entity_id uuid,
  entity_type text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies with checks to avoid "already exists" errors
DO $$ 
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view their own notifications' 
    AND tablename = 'notifications' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON notifications
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update their own notifications' 
    AND tablename = 'notifications' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON notifications
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'System can create notifications' 
    AND tablename = 'notifications' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "System can create notifications"
      ON notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Add index for better performance if they don't exist
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);

-- Add read column to messages table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'read'
  ) THEN
    ALTER TABLE messages ADD COLUMN read boolean DEFAULT false;
  END IF;
END $$;

-- Create or replace function to create notification when a message is received
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for the receiver
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    entity_id,
    entity_type,
    read,
    created_at
  ) VALUES (
    NEW.receiver_id,
    'הודעה חדשה',
    (SELECT COALESCE(name, email) FROM users WHERE id = NEW.sender_id) || ' שלח לך הודעה',
    'message',
    NEW.sender_id,
    'message',
    false,
    NEW.created_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message notifications if it doesn't exist
DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
CREATE TRIGGER message_notification_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION create_message_notification();

-- Create or replace function to create notification when a request status changes
CREATE OR REPLACE FUNCTION create_request_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification when status changes
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  
  -- Create notification based on status change
  IF NEW.status = 'approved' THEN
    -- Notify fan that request was approved
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      NEW.fan_id,
      'בקשת הוידאו אושרה',
      'בקשת הוידאו שלך אושרה ותטופל בקרוב',
      'request',
      NEW.id,
      'request'
    );
  ELSIF NEW.status = 'completed' THEN
    -- Notify fan that request was completed
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      NEW.fan_id,
      'הוידאו שלך מוכן!',
      'הוידאו שהזמנת מוכן לצפייה',
      'request',
      NEW.id,
      'request'
    );
  ELSIF NEW.status = 'declined' THEN
    -- Notify fan that request was declined
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      NEW.fan_id,
      'בקשת הוידאו נדחתה',
      'לצערנו, בקשת הוידאו שלך נדחתה. הכסף הוחזר לארנק שלך.',
      'request',
      NEW.id,
      'request'
    );
  ELSIF NEW.status = 'pending' AND OLD.status IS NULL THEN
    -- Notify creator about new request
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      NEW.creator_id,
      'בקשת וידאו חדשה',
      'התקבלה בקשת וידאו חדשה',
      'request',
      NEW.id,
      'request'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for request notifications if it doesn't exist
DROP TRIGGER IF EXISTS request_notification_trigger ON requests;
CREATE TRIGGER request_notification_trigger
AFTER INSERT OR UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION create_request_notification();

-- Create or replace function to create notification when a payment is processed
CREATE OR REPLACE FUNCTION create_payment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification for completed payments
  IF NEW.payment_status != 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Create notification based on transaction type
  IF NEW.type = 'top_up' THEN
    -- Notify user about wallet top-up
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      NEW.user_id,
      'טעינת ארנק הושלמה',
      'טעינת הארנק שלך בסך ₪' || NEW.amount || ' הושלמה בהצלחה',
      'payment',
      NEW.id,
      'payment'
    );
  ELSIF NEW.type = 'earning' THEN
    -- Notify creator about earnings
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      NEW.user_id,
      'הכנסה חדשה',
      'קיבלת תשלום בסך ₪' || NEW.amount,
      'payment',
      NEW.id,
      'payment'
    );
  ELSIF NEW.type = 'refund' THEN
    -- Notify user about refund
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      entity_id,
      entity_type
    ) VALUES (
      NEW.user_id,
      'החזר כספי',
      'קיבלת החזר כספי בסך ₪' || NEW.amount,
      'payment',
      NEW.id,
      'payment'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment notifications if it doesn't exist
DROP TRIGGER IF EXISTS payment_notification_trigger ON wallet_transactions;
CREATE TRIGGER payment_notification_trigger
AFTER INSERT OR UPDATE OF payment_status ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION create_payment_notification();
