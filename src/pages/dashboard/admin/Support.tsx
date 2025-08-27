import React, { useState } from 'react';
import { MessageSquare, Users, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateSupportTicket, createAuditLog } from '../../../lib/admin';

export function Support() {
  const [tickets, setTickets] = useState([
    {
      id: 'TICKET-001',
      user: 'יוסי כהן',
      subject: 'בעיית תשלום',
      status: 'open',
      priority: 'high',
      createdAt: '17/04/2025',
      lastUpdate: 'לפני שעתיים',
    },
    {
      id: 'TICKET-002',
      user: 'שרה לוי',
      subject: 'גישה לחשבון',
      status: 'in-progress',
      priority: 'medium',
      createdAt: '17/04/2025',
      lastUpdate: 'לפני 4 שעות',
    },
    {
      id: 'TICKET-003',
      user: 'דני אבני',
      subject: 'העלאת וידאו נכשלה',
      status: 'resolved',
      priority: 'low',
      createdAt: '16/04/2025',
      lastUpdate: 'לפני יום',
    },
  ]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await updateSupportTicket({
        id: ticketId,
        status: newStatus
      });

      await createAuditLog({
        action: 'update_ticket_status',
        entity: 'support_tickets',
        entity_id: ticketId,
        details: { status: newStatus }
      });

      setTickets(tickets.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
      ));

      toast.success('סטטוס הפנייה עודכן בהצלחה');
    } catch (error) {
      console.error('שגיאה בעדכון הפנייה:', error);
      toast.error('שגיאה בעדכון סטטוס הפנייה');
    }
  };

  const handlePriorityChange = async (ticketId: string, newPriority: string) => {
    try {
      await updateSupportTicket({
        id: ticketId,
        priority: newPriority
      });

      await createAuditLog({
        action: 'update_ticket_priority',
        entity: 'support_tickets',
        entity_id: ticketId,
        details: { priority: newPriority }
      });

      setTickets(tickets.map(ticket => 
        ticket.id === ticketId ? { ...ticket, priority: newPriority } : ticket
      ));

      toast.success('עדיפות הפנייה עודכנה בהצלחה');
    } catch (error) {
      console.error('שגיאה בעדכון עדיפות:', error);
      toast.error('שגיאה בעדכון עדיפות הפנייה');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">לוח בקרה תמיכה</h1>
        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          פנייה חדשה
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">פניות פתוחות</p>
              <p className="text-2xl font-semibold text-gray-900">23</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">נפתרו היום</p>
              <p className="text-2xl font-semibold text-gray-900">15</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <Clock className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">זמן תגובה ממוצע</p>
              <p className="text-2xl font-semibold text-gray-900">2.5 שעות</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">נציגים פעילים</p>
              <p className="text-2xl font-semibold text-gray-900">8</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">פניות אחרונות</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מזהה פנייה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  משתמש
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  נושא
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  עדיפות
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  עדכון אחרון
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {ticket.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.user}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                      className={`px-2 py-1 text-xs font-semibold rounded-full
                        ${ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${ticket.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : ''}
                        ${ticket.status === 'resolved' ? 'bg-green-100 text-green-800' : ''}
                      `}
                    >
                      <option value="open">פתוח</option>
                      <option value="in-progress">בטיפול</option>
                      <option value="resolved">נפתר</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={ticket.priority}
                      onChange={(e) => handlePriorityChange(ticket.id, e.target.value)}
                      className={`px-2 py-1 text-xs font-semibold rounded-full
                        ${ticket.priority === 'high' ? 'bg-red-100 text-red-800' : ''}
                        ${ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${ticket.priority === 'low' ? 'bg-green-100 text-green-800' : ''}
                      `}
                    >
                      <option value="high">גבוהה</option>
                      <option value="medium">בינונית</option>
                      <option value="low">נמוכה</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.lastUpdate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => {/* Handle view details */}}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      צפה בפרטים
                    </button>
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
