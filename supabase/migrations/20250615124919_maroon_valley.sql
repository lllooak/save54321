/*
  # Create request notification trigger

  1. New Functions
    - `create_request_notification` - Creates notifications for new requests and status changes
  
  2. Triggers
    - Add trigger on requests table for INSERT and UPDATE events
*/

-- Create function to generate notifications for requests
CREATE OR REPLACE FUNCTION create_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
  fan_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  notification_user_id UUID;
BEGIN
  -- Get creator name
  SELECT name INTO creator_name FROM creator_profiles WHERE id = NEW.creator_id;
  
  -- Get fan name
  SELECT name INTO fan_name FROM users WHERE id = NEW.fan_id;
  
  -- For new requests, notify the creator
  IF TG_OP = 'INSERT' THEN
    notification_title := 'הזמנה חדשה';
    notification_message := 'התקבלה הזמנה חדשה מ-' || COALESCE(fan_name, 'מעריץ');
    notification_user_id := NEW.creator_id;
    
    -- Insert notification for creator
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      entity_id, 
      entity_type
    ) VALUES (
      notification_user_id,
      notification_title,
      notification_message,
      'request',
      NEW.id,
      'requests'
    );
    
    -- Also send email notification via edge function
    PERFORM pg_notify('send_order_notification', json_build_object(
      'request_id', NEW.id
    )::text);
    
  -- For status updates, notify both creator and fan
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    -- Notify fan about status change
    CASE NEW.status
      WHEN 'approved' THEN
        notification_title := 'הזמנה אושרה';
        notification_message := 'ההזמנה שלך אושרה על ידי ' || COALESCE(creator_name, 'היוצר');
      WHEN 'completed' THEN
        notification_title := 'הזמנה הושלמה';
        notification_message := 'הסרטון שלך מוכן! ' || COALESCE(creator_name, 'היוצר') || ' השלים את ההזמנה שלך.';
      WHEN 'declined' THEN
        notification_title := 'הזמנה נדחתה';
        notification_message := 'לצערנו, ההזמנה שלך נדחתה על ידי ' || COALESCE(creator_name, 'היוצר');
      ELSE
        notification_title := 'עדכון סטטוס הזמנה';
        notification_message := 'סטטוס ההזמנה שלך עודכן ל-' || NEW.status;
    END CASE;
    
    -- Insert notification for fan
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      entity_id, 
      entity_type
    ) VALUES (
      NEW.fan_id,
      notification_title,
      notification_message,
      'request',
      NEW.id,
      'requests'
    );
    
    -- If status changed to completed, also notify creator
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
      INSERT INTO notifications (
        user_id, 
        title, 
        message, 
        type, 
        entity_id, 
        entity_type
      ) VALUES (
        NEW.creator_id,
        'הזמנה הושלמה',
        'השלמת בהצלחה את ההזמנה עבור ' || COALESCE(fan_name, 'המעריץ'),
        'request',
        NEW.id,
        'requests'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on requests table
DROP TRIGGER IF EXISTS request_notification_trigger ON requests;
CREATE TRIGGER request_notification_trigger
AFTER INSERT OR UPDATE OF status ON requests
FOR EACH ROW
EXECUTE FUNCTION create_request_notification();