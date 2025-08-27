/*
  # Add default email templates

  1. Changes
    - Insert default email templates for welcome, verification, and password reset
    - Set up template variables and content
  
  2. Security
    - No changes to RLS policies needed
*/

-- Insert default email templates if they don't exist
INSERT INTO email_templates (name, subject, content, variables)
VALUES 
  (
    'welcome',
    'ברוך הבא ל-MyStar!',
    '<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h1 style="color: #0284c7; text-align: center;">ברוך הבא ל-MyStar!</h1>
      <p>שלום {{name}},</p>
      <p>תודה שהצטרפת ל-MyStar, הפלטפורמה המובילה לקבלת ברכות מותאמות אישית מהכוכבים האהובים עליך.</p>
      <p>כעת תוכל:</p>
      <ul>
        <li>לחפש יוצרים מהקטגוריות האהובות עליך</li>
        <li>להזמין ברכות מותאמות אישית</li>
        <li>לשתף את הברכות עם חברים ומשפחה</li>
      </ul>
      <div style="text-align: center; margin-top: 30px;">
        <a href="{{loginUrl}}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">התחבר לחשבון שלך</a>
      </div>
      <p style="margin-top: 30px;">אם יש לך שאלות, אל תהסס לפנות אלינו ב-<a href="mailto:support@mystar.co.il">support@mystar.co.il</a>.</p>
      <p>בברכה,<br>צוות MyStar</p>
    </div>',
    '{"name": "שם המשתמש", "loginUrl": "קישור להתחברות"}'
  ),
  (
    'verification',
    'אימות כתובת האימייל שלך',
    '<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h1 style="color: #0284c7; text-align: center;">אימות כתובת האימייל</h1>
      <p>שלום {{name}},</p>
      <p>תודה שנרשמת ל-MyStar. כדי להשלים את תהליך ההרשמה, אנא אמת את כתובת האימייל שלך על ידי לחיצה על הכפתור למטה:</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="{{verificationUrl}}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">אמת את האימייל שלי</a>
      </div>
      <p style="margin-top: 30px;">אם לא נרשמת ל-MyStar, אנא התעלם מהודעה זו.</p>
      <p>קישור זה יפוג תוך 24 שעות.</p>
      <p>בברכה,<br>צוות MyStar</p>
    </div>',
    '{"name": "שם המשתמש", "verificationUrl": "קישור לאימות"}'
  ),
  (
    'password_reset',
    'איפוס סיסמה',
    '<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h1 style="color: #0284c7; text-align: center;">איפוס סיסמה</h1>
      <p>שלום,</p>
      <p>קיבלנו בקשה לאיפוס הסיסמה לחשבון MyStar שלך. לחץ על הכפתור למטה כדי לאפס את הסיסמה:</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="{{resetUrl}}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">איפוס סיסמה</a>
      </div>
      <p style="margin-top: 30px;">אם לא ביקשת לאפס את הסיסמה, אנא התעלם מהודעה זו.</p>
      <p>קישור זה יפוג תוך 24 שעות.</p>
      <p>בברכה,<br>צוות MyStar</p>
    </div>',
    '{"resetUrl": "קישור לאיפוס סיסמה"}'
  )
ON CONFLICT (id) DO NOTHING;

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'add_email_templates',
  'email_templates',
  NULL,
  jsonb_build_object(
    'description', 'Added default email templates',
    'timestamp', now()
  )
);
