import React from 'react';
import { Shield, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export function ContentModeration() {
  const reports = [
    {
      id: 1,
      type: 'וידאו',
      reportedBy: 'user123',
      reason: 'תוכן לא הולם',
      status: 'pending',
      date: '17/04/2025',
    },
    {
      id: 2,
      type: 'תגובה',
      reportedBy: 'user456',
      reason: 'הטרדה',
      status: 'resolved',
      date: '16/04/2025',
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול תוכן</h1>
        <div className="flex space-x-4">
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            <AlertCircle className="inline-block w-5 h-5 ml-2" />
            תוכן שדווח
          </button>
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Shield className="inline-block w-5 h-5 ml-2" />
            תור בדיקה
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="text-right text-sm font-medium text-gray-500">
                <th className="pb-4">סוג</th>
                <th className="pb-4">דווח על ידי</th>
                <th className="pb-4">סיבה</th>
                <th className="pb-4">סטטוס</th>
                <th className="pb-4">תאריך</th>
                <th className="pb-4">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="py-4">{report.type}</td>
                  <td className="py-4">{report.reportedBy}</td>
                  <td className="py-4">{report.reason}</td>
                  <td className="py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        report.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {report.status === 'pending' ? 'בבדיקה' : 'טופל'}
                    </span>
                  </td>
                  <td className="py-4">{report.date}</td>
                  <td className="py-4">
                    <div className="flex space-x-2">
                      <button className="p-1 text-green-600 hover:text-green-800">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button className="p-1 text-red-600 hover:text-red-800">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
