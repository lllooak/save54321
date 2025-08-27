import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle } from 'lucide-react';
import { resendVerificationEmail } from '../lib/emailService';
import toast from 'react-hot-toast';

interface SignupSuccessMessageProps {
  email?: string;
}

export function SignupSuccessMessage({ email }: SignupSuccessMessageProps) {
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(time => time - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleResendVerification = async () => {
    if (!email || cooldown > 0) return;
    
    setIsResending(true);
    try {
      const result = await resendVerificationEmail(email);
      if (result.success) {
        toast.success('אימייל אימות נשלח בהצלחה');
        setCooldown(60); // Set 60 second cooldown
      } else {
        if (result.error.message?.includes('rate limit')) {
          toast.error('נא להמתין לפני שליחת אימייל אימות נוסף');
          setCooldown(60);
        } else {
          toast.error('שגיאה בשליחת אימייל אימות');
        }
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast.error('שגיאה בשליחת אימייל אימות');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-md" dir="rtl">
      <div className="flex">
        <div className="flex-shrink-0">
          <Mail className="h-5 w-5 text-blue-500" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">אימות חשבון נדרש</h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>
              שלחנו אימייל אימות לכתובת {email ? <strong>{email}</strong> : 'האימייל שלך'}.
              אנא בדוק את תיבת הדואר הנכנס שלך (וגם את תיקיית הספאם) ולחץ על הקישור לאימות החשבון.
            </p>
            <p className="mt-2 flex items-center">
              <AlertCircle className="h-4 w-4 text-blue-500 ml-1" />
              <span>לא תוכל להתחבר לחשבונך עד שתאמת את כתובת האימייל שלך.</span>
            </p>
            {email && (
              <div className="mt-3">
                <button
                  onClick={handleResendVerification}
                  disabled={isResending || cooldown > 0}
                  className="text-blue-700 hover:text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'שולח...' : 
                   cooldown > 0 ? `שלח שוב (${cooldown}s)` : 
                   'לא קיבלת? שלח שוב'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}