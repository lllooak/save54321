import React from 'react';
import { BarChart2, TrendingUp, Users, DollarSign } from 'lucide-react';

export function Analytics() {
  const stats = [
    {
      title: 'סך הכל הכנסות',
      value: '₪124,592',
      change: '+12.3%',
      icon: DollarSign,
    },
    {
      title: 'משתמשים פעילים',
      value: '8,271',
      change: '+18.6%',
      icon: Users,
    },
    {
      title: 'בקשות שהושלמו',
      value: '3,849',
      change: '+8.2%',
      icon: BarChart2,
    },
    {
      title: 'צמיחת הפלטפורמה',
      value: '+24.5%',
      change: '+5.7%',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">ניתוח נתונים</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.value}</p>
              </div>
              <div className="bg-primary-50 p-3 rounded-full">
                <stat.icon className="h-6 w-6 text-primary-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm font-medium text-green-600">{stat.change}</span>
              <span className="text-sm text-gray-600"> לעומת החודש שעבר</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-4">מגמות הכנסה</h2>
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded">
            <p className="text-gray-500">גרף הכנסות יוצג כאן</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-4">פעילות משתמשים</h2>
          <div className="h-80 flex items-center justify-center bg-gray-50 rounded">
            <p className="text-gray-500">גרף פעילות משתמשים יוצג כאן</p>
          </div>
        </div>
      </div>
    </div>
  );
}
