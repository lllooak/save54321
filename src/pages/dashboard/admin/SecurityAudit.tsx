import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Lock, History, UserCheck, Database, Loader } from 'lucide-react';
import { checkSuperAdminAccess } from '../../../lib/admin';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id?: string;
  user_id?: string;
  details?: any;
  created_at: string;
  user_email?: string;
}

export function SecurityAudit() {
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    const checkAccess = async () => {
      const hasSuperAdminAccess = await checkSuperAdminAccess();
      setIsSuperAdmin(hasSuperAdminAccess);
      
      if (hasSuperAdminAccess) {
        fetchAuditLogs();
      } else {
        setLoading(false);
        toast.error('רק מנהל-על יכול לגשת לדף זה');
        navigate('/dashboard/Joseph999');
      }
    };
    
    checkAccess();
  }, [navigate, actionFilter]);

  async function fetchAuditLogs() {
    try {
      setLoading(true);
      
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          user:user_id (
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      
      // Process the data to extract user email
      const processedLogs = data?.map(log => ({
        ...log,
        user_email: log.user?.email
      })) || [];
      
      setAuditLogs(processedLogs);
    } catch (error) {
      console.error('שגיאה בטעינת יומן אבטחה:', error);
      toast.error('שגיאה בטעינת יומן אבטחה');
    } finally {
      setLoading(false);
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes('login') || action.includes('auth')) {
      return <UserCheck className="h-5 w-5 text-blue-500" />;
    } else if (action.includes('admin') || action.includes('super_admin')) {
      return <Shield className="h-5 w-5 text-purple-500" />;
    } else if (action.includes('security') || action.includes('password')) {
      return <Lock className="h-5 w-5 text-red-500" />;
    } else if (action.includes('database') || action.includes('data')) {
      return <Database className="h-5 w-5 text-green-500" />;
    } else {
      return <History className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
        <span className="mr-2 text-gray-600">טוען נתונים...</span>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין הרשאת גישה</h2>
          <p className="text-gray-600">רק מנהל-על יכול לגשת לדף זה.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">אבטחה וביקורת</h1>
        <div className="flex space-x-4">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border rounded-lg px-4 py-2 ml-4"
          >
            <option value="all">כל הפעולות</option>
            <option value="login">התחברות</option>
            <option value="admin">פעולות מנהל</option>
            <option value="super_admin">פעולות מנהל-על</option>
            <option value="update">עדכונים</option>
            <option value="delete">מחיקות</option>
          </select>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            הפק דוח ביקורת
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Security Overview Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="h-6 w-6 text-green-600 ml-2" />
            <h2 className="text-lg font-medium">סטטוס אבטחה</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>סטטוס מערכת</span>
              <span className="text-green-600">מאובטח</span>
            </div>
            <div className="flex justify-between items-center">
              <span>סריקה אחרונה</span>
              <span>לפני שעתיים</span>
            </div>
            <div className="flex justify-between items-center">
              <span>איומים שזוהו</span>
              <span>אין</span>
            </div>
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3 mb-4">
            <History className="h-6 w-6 text-blue-600 ml-2" />
            <h2 className="text-lg font-medium">פעילות אחרונה</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 text-gray-500 ml-2" />
              <span>התחברות מנהל מ-192.168.1.1</span>
            </div>
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-gray-500 ml-2" />
              <span>גיבוי מסד נתונים הושלם</span>
            </div>
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-gray-500 ml-2" />
              <span>מדיניות אבטחה עודכנה</span>
            </div>
          </div>
        </div>

        {/* Security Alerts Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 ml-2" />
            <h2 className="text-lg font-medium">התראות אבטחה</h2>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 rounded-md">
              <p className="text-sm text-yellow-800">
                2 משתמשים לא הפעילו אימות דו-שלבי
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-md">
              <p className="text-sm text-yellow-800">
                3 חשבונות מנהל לא פעילים מעל 30 יום
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">יומן אבטחה</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">זמן</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ישות</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">משתמש</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פרטים</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getActionIcon(log.action)}
                        <span className="ml-2 text-sm font-medium text-gray-900">{log.action}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.entity}{log.entity_id ? ` (${log.entity_id.substring(0, 8)}...)` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.user_email || log.user_id?.substring(0, 8) || 'מערכת'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.details ? (
                        <pre className="whitespace-pre-wrap text-xs">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-gray-400">אין פרטים</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    לא נמצאו רשומות ביומן האבטחה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
