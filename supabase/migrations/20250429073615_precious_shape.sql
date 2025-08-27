/*
  # Add page content management system

  1. New Tables
    - `page_content`: Stores editable page content for footer links
      - `id` (uuid, primary key)
      - `slug` (text, unique)
      - `title` (text)
      - `content` (text)
      - `is_published` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `updated_by` (uuid)

  2. Security
    - Enable RLS on page_content table
    - Add policies for admins to manage page content
    - Add policies for public to view published pages
*/

-- Create page_content table
CREATE TABLE IF NOT EXISTS page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage page content"
  ON page_content
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Public can view published pages"
  ON page_content
  FOR SELECT
  TO public
  USING (is_published = true);

-- Create initial pages
INSERT INTO page_content (slug, title, content, is_published)
VALUES 
  ('about', 'מי אנחנו', '<h1>מי אנחנו</h1><p>MyStar היא פלטפורמה המחברת בין מעריצים ליוצרים, ומאפשרת הזמנת סרטוני ברכה מותאמים אישית מהכוכבים האהובים עליכם.</p><p>הפלטפורמה שלנו נוסדה בשנת 2025 עם חזון לאפשר חוויות אישיות ובלתי נשכחות בין מעריצים ליוצרים.</p>', true),
  ('careers', 'דרושים', '<h1>הצטרפו לצוות שלנו</h1><p>אנו מחפשים אנשים מוכשרים ונלהבים להצטרף לצוות שלנו ולעזור לנו להמשיך לצמוח ולהתפתח.</p><p>בדקו את המשרות הפתוחות שלנו וצרו איתנו קשר.</p>', true),
  ('help', 'מרכז עזרה', '<h1>מרכז עזרה</h1><p>מצאתם שאלה? יש לכם בעיה? אנחנו כאן כדי לעזור!</p><p>עיינו בשאלות הנפוצות שלנו או צרו איתנו קשר ישירות.</p>', true),
  ('become-creator', 'הצטרף כיוצר', '<h1>הצטרף כיוצר</h1><p>יש לך מעריצים שרוצים לקבל ממך סרטוני ברכה? הצטרף לפלטפורמה שלנו כיוצר וקבל תשלום עבור יצירת סרטוני ברכה מותאמים אישית.</p><p>התהליך פשוט ומהיר, ואתה שולט במחיר, בזמינות ובסוג הבקשות שאתה מקבל.</p>', true),
  ('creator-guidelines', 'הנחיות ליוצרים', '<h1>הנחיות ליוצרים</h1><p>כדי להבטיח חוויה חיובית לכולם, אנא עקוב אחר ההנחיות הבאות:</p><ul><li>הגב לבקשות בזמן</li><li>צור תוכן איכותי ומותאם אישית</li><li>שמור על תקשורת מכבדת עם המעריצים</li><li>הימנע מתוכן פוגעני או לא הולם</li></ul>', true);

-- Log the change
INSERT INTO audit_logs (
  action,
  entity,
  entity_id,
  details
) VALUES (
  'create_page_content_table',
  'page_content',
  NULL,
  jsonb_build_object(
    'description', 'Created page_content table for footer pages',
    'timestamp', now()
  )
);
