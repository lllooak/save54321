import React, { useState } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';

interface BookingFormProps {
  creatorId: string;
  creatorName: string;
  price: number;
  onSubmit: (data: BookingFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export interface BookingFormData {
  request_type: string;
  message: string;
  deadline: string;
  price: number;
  recipient: string;
}

export function BookingForm({ 
  creatorId, 
  creatorName, 
  price, 
  onSubmit, 
  onCancel,
  isSubmitting = false 
}: BookingFormProps) {
  // Calculate minimum deadline date (tomorrow)
  const tomorrow = addDays(new Date(), 1);
  const minDeadlineDate = format(tomorrow, 'yyyy-MM-dd');
  
  // Calculate default deadline date (7 days from now)
  const defaultDeadline = addDays(new Date(), 7);
  const defaultDeadlineStr = format(defaultDeadline, 'yyyy-MM-dd');

  const [formData, setFormData] = useState<BookingFormData>({
    request_type: '',
    message: '',
    deadline: defaultDeadlineStr,
    price: price,
    recipient: ''
  });
  
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.request_type) {
      toast.error('אנא בחר סוג בקשה');
      return;
    }
    
    if (!formData.message) {
      toast.error('אנא הזן הוראות לסרטון');
      return;
    }
    
    if (!formData.deadline) {
      toast.error('אנא בחר תאריך יעד');
      return;
    }
    
    if (!formData.recipient) {
      toast.error('אנא הזן שם הנמען');
      return;
    }
    
    // Submit form
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          סוג בקשה
        </label>
        <select
          value={formData.request_type}
          onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          required
          disabled={isSubmitting}
        >
          <option value="">בחר סוג בקשה</option>
          <option value="birthday">יום הולדת</option>
          <option value="anniversary">יום נישואין</option>
          <option value="congratulations">ברכות</option>
          <option value="motivation">מוטיבציה</option>
          <option value="other">אחר</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          נמען <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.recipient}
          onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
          placeholder="למי מיועד הסרטון?"
          required
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          תאריך האירוע <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="date"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            min={minDeadlineDate}
            className="block w-full pr-10 rounded-md border-gray-300 shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-right"
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">
            הוראות לסרטון <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center text-primary-600 text-sm"
          >
            {showInstructions ? (
              <>
                <ChevronUp className="h-4 w-4 ml-1" />
                הסתר הנחיות
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 ml-1" />
                הצג הנחיות
              </>
            )}
          </button>
        </div>
        
        {showInstructions && (
          <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 mb-2">
            <h3 className="font-bold mb-2">הנחיות למעריצים לקבל ברכה טובה</h3>
            <p>כדי לקבל ברכה טובה, מעריצים צריכים לספק ליוצר פרטים ברורים וממוקדים. הנה נוסח הנחיות שאפשר להציע למעריצים בזמן שליחת הבקשה:</p>
            <p className="font-medium mt-2">✍️ מה לכתוב ליוצר כדי לקבל ברכה מצוינת? כדי שהיוצר יוכל להקליט סרטון אישי ומרגש, אנא ציינו את הפרטים הבאים:</p>
            
            <p className="mt-2 font-medium">🧑‍🎓 למי מיועדת הברכה?</p>
            <ul className="list-inside space-y-1 mt-1">
              <li>שם פרטי (ואם צריך – גם שם משפחה)</li>
              <li>גיל (רשות, אבל עוזר להתאים את הסגנון)</li>
              <li>מה הקשר שלכם אליו? (חבר, בן משפחה, קולגה וכו')</li>
            </ul>
            
            <p className="mt-2 font-medium">🎉 מה סיבת הברכה?</p>
            <p>יום הולדת? חתונה? הצלחה בלימודים? עידוד בתקופה קשה? בקשת נישואין? נסחו זאת במשפט או שניים.</p>
            
            <p className="mt-2 font-medium">💬 מה תרצו שיוזכר בברכה?</p>
            <ul className="list-inside space-y-1 mt-1">
              <li>תחומי עניין (למשל: אוהב כדורגל, מעריץ של הארי פוטר, אוהבת ריקוד)</li>
              <li>עובדה מצחיקה או מרגשת שאפשר להתייחס אליה</li>
              <li>שם חיבה, משפט פנימי שלכם, או משהו פרטי (אם רוצים)</li>
            </ul>
            
            <p className="mt-2 font-medium">🎙️ טון וסגנון רצוי</p>
            <p>מרגש? מצחיק? קליל? מעודד? מקצועי?</p>
            <p>(לא חובה, אבל עוזר מאוד ליוצר להבין את הסגנון שאתם מצפים לו)</p>
            
            <p className="mt-2 font-medium">🛑 דוגמא לבקשה טובה:</p>
            <p className="italic">"שלום! אני רוצה ברכה לאחותי מיכל שחוגגת יום הולדת 30. היא אוהבת אותך בטירוף וצופה בך כל ערב! היא אוהבת כלבים, שוקולד וסרטים רומנטיים. תוכל לעשות לה ברכה מצחיקה אבל גם מרגשת? אולי תזכיר שהיא סוף סוף סיימה את התואר אחרי שנים?"</p>
          </div>
        )}
        
        <textarea
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          rows={5}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          placeholder="תאר בפירוט מה תרצה שהיוצר יאמר בסרטון, למי הוא מיועד, ופרטים נוספים שיעזרו ליוצר להכין סרטון מותאם אישית."
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-gray-900">₪{price.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 space-x-reverse">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 ml-3"
          disabled={isSubmitting}
        >
          ביטול
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              מעבד...
            </span>
          ) : (
            'הזמן עכשיו'
          )}
        </button>
      </div>
    </form>
  );
}
