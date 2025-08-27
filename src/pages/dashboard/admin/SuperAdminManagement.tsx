import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Users, Star, Shield, AlertTriangle, Loader, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkSuperAdminAccess } from '../../../lib/admin';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  is_super_admin: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export function SuperAdminManagement() {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const hasSuperAdminAccess = await checkSuperAdminAccess();
      setIsSuperAdmin(hasSuperAdminAccess);
      
      if (hasSuperAdminAccess) {
        fetchAdmins();
      } else {
        setLoading(false);
        toast.error('רק מנהל-על יכול לגשת לדף זה');
        navigate('/dashboard/Joseph999');
      }
    };
    
    checkAccess();
  }, [navigate]);

  async function fetchAdmins() {
    try {
      setLoading(true);
      
      // Get all admin users
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, is_super_admin, created_at, last_seen_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error('שגיאה בטעינת מנהלים:', error);
      toast.error('שגיאה בטעינת מנהלים');
    } finally {
      setLoading(false);
    }
  }

  async function toggleSuperAdmin(userId: string, isSuperAdmin: boolean) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_super_admin: !isSuperAdmin })
        .eq('id', userId);

      if (error) throw error;

      toast.success(isSuperAdmin ? 'הרשאות מנהל-על הוסרו בהצלחה' : 'הרשאות מנהל-על הוענקו בהצלחה');
      
      // Update the local state to reflect the change
      setAdmins(admins.map(admin => 
        admin.id === userId ? { ...admin, is_super_admin: !isSuperAdmin } : admin
      ));
      
      // Log the change
      await supabase
        .from('audit_logs')
        .insert({
          action: isSuperAdmin ? 'revoke_super_admin' : 'grant_super_admin',
          entity: 'users',
          entity_id: userId,
          details: {
            previous_status: isSuperAdmin,
            new_status: !isSuperAdmin,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Error toggling super admin status:', error);
      toast.error('שגיאה בעדכון סטטוס מנהל-על');
    }
  }

  const filteredAdmins = admins.filter(admin => {
    if (!searchQuery) return true;
    
    return (
      admin.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (admin.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    );
  });

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
        <span className="mr-2 text-gray-600">טוען נתונים...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול מנהלי-על</h1>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש מנהלים..."
            className="pr-10 pl-4 py-2 border rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="mb-4 text-gray-600">
          מנהלי-על הם מנהלים עם הרשאות מיוחדות שיכולים לגשת לכל חלקי המערכת, כולל הגדרות רגישות ומידע אבטחה.
          רק מנהל-על יכול להעניק או להסיר הרשאות מנהל-על.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מנהל</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס מנהל-על</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעיל לאחרונה</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAdmins.length > 0 ? (
              filteredAdmins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img
                          className="h-10 w-10 rounded-full"
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name || admin.email)}`}
                          alt=""
                        />
                      </div>
                      <div className="mr-4">
                        <div className="text-sm font-medium text-gray-900">{admin.name || admin.email}</div>
                        <div className="text-sm text-gray-500">{admin.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      admin.is_super_admin ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {admin.is_super_admin ? 'מנהל-על' : 'מנהל רגיל'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {admin.last_seen_at ? new Date(admin.last_seen_at).toLocaleDateString('he-IL') : 'מעולם לא'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleSuperAdmin(admin.id, admin.is_super_admin)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        admin.is_super_admin
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      <Star className="h-4 w-4 ml-1" />
                      {admin.is_super_admin ? 'הסר הרשאות מנהל-על' : 'הענק הרשאות מנהל-על'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  לא נמצאו מנהלים התואמים את החיפוש
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
