import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Home, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ThankYou() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract the order information from location state
  const orderInfo = location.state?.orderInfo || {};
  
  // Redirect to home page if this page is accessed directly without order info
  useEffect(() => {
    if (!location.state?.orderComplete) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-3xl w-full bg-white shadow-xl rounded-lg overflow-hidden">
        <div className="bg-primary-600 px-6 py-8 text-center">
          <CheckCircle className="h-16 w-16 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">תודה על הזמנתך!</h1>
        </div>
        
        <div className="p-8">
          <div className="text-center mb-8">
            <p className="text-xl text-gray-800 mb-4">
              ההזמנה שלך התקבלה בהצלחה!
            </p>
            <p className="text-gray-600 mb-6 max-w-xl mx-auto">
              ברגעים אלו היוצר מקבל התראה על הזמנתך והוא יספק את הוידאו בהקדם האפשרי.
              הוידאו יהיה זמין בלוח הבקרה שלך, ותוכל להוריד אותו בקלות לאחר שיושלם.
            </p>
            <p className="text-primary-600 font-semibold">תהנה!</p>
          </div>
          
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">מה הלאה?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <User className="h-5 w-5 ml-2 text-primary-600" />
                  עקוב אחרי ההזמנה שלך
                </h4>
                <p className="text-gray-600 mb-4">
                  תוכל לעקוב אחרי סטטוס ההזמנה שלך בלוח הבקרה האישי שלך
                </p>
                <Link 
                  to="/dashboard/fan" 
                  className="text-primary-600 font-medium hover:text-primary-700"
                >
                  לצפייה בלוח הבקרה
                </Link>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <Home className="h-5 w-5 ml-2 text-primary-600" />
                  המשך בחיפוש
                </h4>
                <p className="text-gray-600 mb-4">
                  גלה עוד יוצרים ושירותי וידאו להזדמנויות מיוחדות
                </p>
                <Link 
                  to="/explore" 
                  className="text-primary-600 font-medium hover:text-primary-700"
                >
                  גלה עוד יוצרים
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
