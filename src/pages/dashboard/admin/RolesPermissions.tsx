import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Edit, Trash2, Save, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { saveRole, createAuditLog, checkSuperAdminAccess } from '../../../lib/admin';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

interface Role {
  id: string | number;
  name: string;
  description: string;
  users: number;
  permissions: string[];
}

export function RolesPermissions() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([
    {
      id: 1,
      name: 'מנהל',
      description: 'גישה מלאה למערכת',
      users: 5,
      permissions: [
        'manage_users',
        'manage_content',
        'manage_settings',
        'view_analytics',
        'manage_payments',
      ],
    },
    {
      id: 2,
      name: 'מנהל תוכן',
      description: 'ניהול תוכן ותמיכת משתמשים',
      users: 12,
      permissions: [
        'manage_content',
        'view_analytics',
        'manage_support',
      ],
    },
    {
      id: 3,
      name: 'נציג תמיכה',
      description: 'טיפול בפניות תמיכה',
      users: 8,
      permissions: [
        'view_tickets',
        'respond_tickets',
        'view_users',
      ],
    },
  ]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });

  useEffect(() => {
    const checkAccess = async () => {
      const hasSuperAdminAccess = await checkSuperAdminAccess();
      setIsSuperAdmin(hasSuperAdminAccess);
      
      if (!hasSuperAdminAccess) {
        toast.error('רק מנהל-על יכול לגשת לדף זה');
        navigate('/dashboard/Joseph999');
      }
      
      setLoading(false);
    };
    
    checkAccess();
  }, [navigate]);

  const handleSaveRole = async (role: Role) => {
    try {
      await saveRole({
        id: role.id.toString(),
        name: role.name,
        description: role.description,
        permissions: role.permissions
      });

      await createAuditLog({
        action: 'update_role',
        entity: 'roles',
        entity_id: role.id.toString(),
        details: role
      });

      toast.success('התפקיד עודכן בהצלחה');
    } catch (error) {
      console.error('שגיאה בשמירת תפקיד:', error);
      toast.error('שגיאה בעדכון התפקיד');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    try {
      // First check if there are any users assigned to this role
      const hasUsers = roles.find(r => r.id === roleId)?.users > 0;
      
      if (hasUsers) {
        toast.error('לא ניתן למחוק תפקיד עם משתמשים מוקצים');
        return;
      }

      await createAuditLog({
        action: 'delete_role',
        entity: 'roles',
        entity_id: roleId.toString()
      });

      setRoles(roles.filter(r => r.id !== roleId));
      toast.success('התפקיד נמחק בהצלחה');
    } catch (error) {
      console.error('שגיאה במחיקת תפקיד:', error);
      toast.error('שגיאה במחיקת התפקיד');
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: [...role.permissions]
    });
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: []
    });
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingRole) return;
    
    try {
      const updatedRole = {
        ...editingRole,
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions
      };
      
      await handleSaveRole(updatedRole);
      
      // Update local state
      setRoles(roles.map(role => 
        role.id === editingRole.id ? updatedRole : role
      ));
      
      // Reset form
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('שגיאה בעדכון התפקיד');
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => {
      const permissions = prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission];
      
      return { ...prev, permissions };
    });
  };

  const translatePermission = (permission: string) => {
    const translations: Record<string, string> = {
      'manage_users': 'ניהול משתמשים',
      'manage_content': 'ניהול תוכן',
      'manage_settings': 'ניהול הגדרות',
      'view_analytics': 'צפייה בנתונים',
      'manage_payments': 'ניהול תשלומים',
      'manage_support': 'ניהול תמיכה',
      'view_tickets': 'צפייה בפניות',
      'respond_tickets': 'מענה לפניות',
      'view_users': 'צפייה במשתמשים'
    };
    
    return translations[permission] || permission.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
        <h1 className="text-2xl font-semibold text-gray-900">תפקידים והרשאות</h1>
        <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <UserPlus className="h-5 w-5 ml-2" />
          הוסף תפקיד
        </button>
      </div>

      {editingRole && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">עריכת תפקיד: {editingRole.name}</h2>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם התפקיד</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">הרשאות</label>
              <div className="grid grid-cols-2 gap-2">
                {['manage_users', 'manage_content', 'manage_settings', 'view_analytics', 
                  'manage_payments', 'manage_support', 'view_tickets', 'respond_tickets', 'view_users'].map((permission) => (
                  <label key={permission} className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(permission)}
                      onChange={() => handlePermissionToggle(permission)}
                      className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 ml-2"
                    />
                    <span className="text-sm text-gray-700">{translatePermission(permission)}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 space-x-reverse">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 ml-3"
              >
                <Save className="h-4 w-4 inline-block ml-1" />
                שמור שינויים
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4 inline-block ml-1" />
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-primary-100">
                  <Shield className="h-6 w-6 text-primary-600" />
                </div>
                <div className="mr-4">
                  <h2 className="text-lg font-medium text-gray-900">{role.name}</h2>
                  <p className="text-sm text-gray-500">{role.description}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditRole(role)}
                  className="p-2 text-gray-400 hover:text-gray-500"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDeleteRole(Number(role.id))}
                  className="p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">הרשאות</h3>
                <span className="text-sm text-gray-500">{role.users} משתמשים</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {role.permissions.map((permission) => (
                  <div
                    key={permission}
                    className="px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-700"
                  >
                    {translatePermission(permission)}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  ניהול משתמשים
                </button>
                <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  עריכת הרשאות
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
