import React, { useState } from 'react';
import { AlertTriangle, MessageSquare, CheckCircle, XCircle } from 'lucide-react';

export function DisputeResolution() {
  const [disputes] = useState([
    {
      id: 1,
      requestId: '#REQ-001',
      creatorName: 'יוסי כהן',
      fanName: 'שרה לוי',
      status: 'pending',
      issue: 'איכות הוידאו לא כמצופה',
      dateSubmitted: '17/04/2025',
    },
    {
      id: 2,
      requestId: '#REQ-002',
      creatorName: 'רונית ישראלי',
      fanName: 'דני אבני',
      status: 'resolved',
      issue: 'עיכוב באספקה',
      dateSubmitted: '16/04/2025',
    }
  ]);

  return (
    <div className="container mx-auto px-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ניהול מחלוקות</h1>
        <div className="flex gap-4">
          <select className="rounded-lg border border-gray-300 px-4 py-2">
            <option value="all">כל המחלוקות</option>
            <option value="pending">בהמתנה</option>
            <option value="resolved">נפתרו</option>
            <option value="escalated">דחופות</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מזהה בקשה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">יוצר</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מעריץ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">נושא</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {disputes.map((dispute) => (
                <tr key={dispute.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dispute.requestId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dispute.creatorName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dispute.fanName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dispute.issue}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      dispute.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {dispute.status === 'pending' ? 'בהמתנה' : 'נפתר'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dispute.dateSubmitted}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <MessageSquare className="h-5 w-5" />
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <XCircle className="h-5 w-5" />
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
