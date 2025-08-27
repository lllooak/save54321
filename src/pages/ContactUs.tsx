import React, { useState } from 'react';
import { Mail, MapPin, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function ContactUs() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate form
      if (!formData.name || !formData.email || !formData.message) {
        toast.error('אנא מלא את כל שדות החובה');
        setIsSubmitting(false);
        return;
      }

      // First attempt to send via Edge Function (Resend.com)
      try {
        const { data: functionData, error: functionError } = await supabase.functions.invoke('send-contact-form', {
          body: {
            name: formData.name,
            email: formData.email,
            subject: formData.subject || 'פנייה מטופס יצירת קשר',
            message: formData.message
          }
        });

        if (functionError) {
          console.error('Edge function error:', functionError);
          throw new Error(functionError.message || 'Failed to send email');
        }
        
        if (functionData && functionData.success) {
          if (functionData.emailSent) {
            toast.success('ההודעה נשלחה בהצלחה! נחזור אליך בהקדם.');
          } else {
            toast.success('הפנייה התקבלה, אך היתה בעיה בשליחת האימייל. צוות התמיכה יצור איתך קשר בהקדם.');
          }
          
          // Reset form
          setFormData({
            name: '',
            email: '',
            subject: '',
            message: ''
          });
          
          return;
        } else {
          throw new Error(functionData?.error || 'שגיאה בשליחת הטופס');
        }
      } catch (functionErr) {
        console.error('Error with edge function:', functionErr);
        // Fall back to direct DB insertion if edge function fails
      }

      // Fallback: Submit to Supabase directly
      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          subject: formData.subject || 'פנייה מטופס יצירת קשר',
          description: formData.message,
          email: formData.email,
          status: 'open',
          priority: 'medium'
        }]);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      // Success message
      toast.success('הפנייה נשמרה במערכת. נחזור אליך בהקדם.');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error('אירעה שגיאה בשליחת הטופס. אנא נסה שוב מאוחר יותר.');
      setError('אירעה שגיאה בשליחת הטופס');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">צור קשר</h1>
          <p className="text-lg text-gray-600">יש לך שאלה או בקשה? אנחנו כאן כדי לעזור!</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Contact Information */}
            <div className="bg-primary-600 text-white p-8 lg:col-span-2">
              <h2 className="text-2xl font-semibold mb-6">פרטי התקשרות</h2>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <Mail className="h-6 w-6 ml-3 mt-1" />
                  <div>
                    <p className="font-medium">אימייל</p>
                    <a href="mailto:support@mystar.co.il" className="text-white hover:text-primary-100">
                      support@mystar.co.il
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <MapPin className="h-6 w-6 ml-3 mt-1" />
                  <div>
                    <p className="font-medium">כתובת</p>
                    <p>קיסריה</p>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <h3 className="text-xl font-semibold mb-4">שעות פעילות</h3>
                <p className="mb-2">ימים א'-ה': 9:00 - 18:00</p>
                <p>יום ו': 9:00 - 13:00</p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="p-8 lg:col-span-3">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">שלח לנו הודעה</h2>
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    שם מלא <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    placeholder="הזן את שמך המלא"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    כתובת אימייל <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    placeholder="הזן את כתובת האימייל שלך"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    נושא
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    disabled={isSubmitting}
                  >
                    <option value="">בחר נושא</option>
                    <option value="support">תמיכה טכנית</option>
                    <option value="billing">תשלומים וחיובים</option>
                    <option value="creators">שאלות ליוצרים</option>
                    <option value="fans">שאלות למעריצים</option>
                    <option value="other">אחר</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    הודעה <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    placeholder="כתוב את הודעתך כאן..."
                    required
                    disabled={isSubmitting}
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white\" xmlns="http://www.w3.org/2000/svg\" fill="none\" viewBox="0 0 24 24">
                        <circle className="opacity-25\" cx="12\" cy="12\" r="10\" stroke="currentColor\" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      שולח...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Send className="h-5 w-5 ml-2" />
                      שלח הודעה
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-16 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">שאלות נפוצות</h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">כיצד אני מזמין סרטון מותאם אישית?</h3>
              <p className="text-gray-600">בחר יוצר, מלא את פרטי הבקשה, בצע תשלום, והיוצר יכין את הסרטון המותאם אישית עבורך.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">כמה זמן לוקח לקבל את הסרטון?</h3>
              <p className="text-gray-600">זמן האספקה משתנה בין היוצרים. זמן האספקה הממוצע הוא בין 24 ל-72 שעות.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">האם אני יכול לבקש החזר כספי?</h3>
              <p className="text-gray-600">אם היוצר דוחה את בקשתך, תקבל החזר כספי מלא. אם הסרטון הושלם, החזרים כספיים נתונים למדיניות היוצר.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">כיצד אני מצטרף כיוצר?</h3>
              <p className="text-gray-600">הירשם כיוצר, השלם את פרופיל היוצר שלך, והתחל לקבל בקשות מהמעריצים שלך.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}