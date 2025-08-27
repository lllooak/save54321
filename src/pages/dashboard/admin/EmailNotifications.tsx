import React from 'react';
import { Mail, Settings, Bell, Send } from 'lucide-react';

export function EmailNotifications() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">דואר והתראות</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Templates */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Mail className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">תבניות אימייל</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 border rounded-md hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium">אימייל ברוכים הבאים</h3>
              <p className="text-sm text-gray-500">נשלח למשתמשים חדשים בעת הרשמה</p>
            </div>
            <div className="p-4 border rounded-md hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium">אישור בקשה</h3>
              <p className="text-sm text-gray-500">נשלח כאשר נוצרת בקשה חדשה</p>
            </div>
            <div className="p-4 border rounded-md hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium">קבלת תשלום</h3>
              <p className="text-sm text-gray-500">נשלח לאחר תשלום מוצלח</p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Bell className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">הגדרות התראות</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">התראות מערכת</h3>
                <p className="text-sm text-gray-500">עדכונים והתראות חשובים</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">אימיילים שיווקיים</h3>
                <p className="text-sm text-gray-500">מבצעים ועלונים</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Email Configuration */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Settings className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">הגדרות אימייל</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">שרת SMTP</label>
              <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">פורט</label>
              <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">אימייל שולח</label>
              <input type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
          </div>
        </div>

        {/* Email Queue */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center mb-4">
            <Send className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">תור אימיילים</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-md">
              <div>
                <h3 className="font-medium">אימיילים בהמתנה</h3>
                <p className="text-sm text-gray-500">12 אימיילים בתור</p>
              </div>
              <button className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
                שלח עכשיו
              </button>
            </div>
            <div className="p-4 border rounded-md">
              <h3 className="font-medium">פעילות אחרונה</h3>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-500">אימייל ברוכים הבאים נשלח ל-user@example.com</p>
                <p className="text-sm text-gray-500">קבלת תשלום נשלחה ל-customer@example.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
