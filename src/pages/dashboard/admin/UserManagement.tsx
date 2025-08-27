import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { User } from '../../../types';
import { 
  UserX, Key, Download, 
  MoreVertical, DollarSign, Mail, CheckCircle, Ban, Star, 
  AlertTriangle, Loader, UserPlus, Search, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UserBalanceModal } from './UserBalanceModal';
import { checkAdminAccess, checkSuperAdminAccess } from '../../../lib/admin';

// Use User type directly since we added is_super_admin to it
type ExtendedUser = User & {
  login_count: number;
  failed_login_attempts: number;
};

interface UserActionMenuProps {
  user: ExtendedUser;
  onAction: (action: string, userId: string) => void;
  isSuperAdmin: boolean;
}

function UserActionMenu({ user, onAction, isSuperAdmin }: UserActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100"
        title="פעולות נוספות"
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      
      {isOpen && (
        <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
          <button
            onClick={() => {
              onAction('balance', user.id);
              setIsOpen(false);
            }}
            className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <DollarSign className="h-4 w-4 inline-block ml-2" />
            עדכן יתרה
          </button>
          
          <button
            onClick={() => {
              onAction('resetPassword', user.id);
              setIsOpen(false);
            }}
            className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Key className="h-4 w-4 inline-block ml-2" />
            איפוס סיסמה
          </button>
          
          <button
            onClick={() => {
              onAction('email', user.id);
              setIsOpen(false);
            }}
            className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Mail className="h-4 w-4 inline-block ml-2" />
            שלח אימייל
          </button>
          
          {user.status === 'banned' ? (
            <button
              onClick={() => {
                onAction('activate', user.id);
                setIsOpen(false);
              }}
              className="block w-full text-right px-4 py-2 text-sm text-green-700 hover:bg-green-100"
            >
              <CheckCircle className="h-4 w-4 inline-block ml-2" />
              הפעל משתמש
            </button>
          ) : (
            <button
              onClick={() => {
                onAction('ban', user.id);
                setIsOpen(false);
              }}
              className="block w-full text-right px-4 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              <Ban className="h-4 w-4 inline-block ml-2" />
              חסום משתמש
            </button>
          )}
          
          {isSuperAdmin && user.role === 'admin' && (
            <button
              onClick={() => {
                onAction('toggleSuperAdmin', user.id);
                setIsOpen(false);
              }}
              className="block w-full text-right px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-100"
            >
              <Star className="h-4 w-4 inline-block ml-2" />
              {user.is_super_admin ? 'הסר הרשאות מנהל-על' : 'הענק הרשאות מנהל-על'}
            </button>
          )}
          
          {isSuperAdmin && (
            <button
              onClick={() => {
                onAction('delete', user.id);
                setIsOpen(false);
              }}
              className="block w-full text-right px-4 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              <UserX className="h-4 w-4 inline-block ml-2" />
              מחק משתמש
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState<ExtendedUser | null>(null);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'ban' | 'activate' | 'delete' | 'toggleSuperAdmin';
    userId: string;
    userName: string;
  } | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const hasAdminAccess = await checkAdminAccess();
      const hasSuperAdminAccess = await checkSuperAdminAccess();
      
      setIsAdmin(hasAdminAccess);
      setIsSuperAdmin(hasSuperAdminAccess);
      
      if (hasAdminAccess) {
        fetchUsers();
      } else {
        setLoading(false);
        toast.error('אין לך הרשאות גישה לדף זה');
        navigate('/dashboard/Joseph998');
      }
    };
    
    checkAccess();
  }, [navigate, roleFilter, statusFilter, page, pageSize]);

  async function fetchUsers() {
    try {
      setLoading(true);
      
      // Use service role function to get all users
      const { data: allUsers, error } = await supabase
        .rpc('admin_get_all_users');
      
      if (error) throw error;
      
      if (!allUsers) {
        setUsers([]);
        setTotalUsers(0);
        setTotalPages(0);
        return;
      }
      
      // Apply client-side filters
      let filteredData = allUsers;
      
      if (roleFilter !== 'all') {
        filteredData = filteredData.filter((user: any) => user.role === roleFilter);
      }
      
      if (statusFilter !== 'all') {
        filteredData = filteredData.filter((user: any) => user.status === statusFilter);
      }
      
      // Apply pagination client-side
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);
      
      setUsers(paginatedData);
      setTotalUsers(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } catch (error) {
      console.error('שגיאה בטעינת משתמשים:', error);
      toast.error('שגיאה בטעינת משתמשים');
    } finally {
      setLoading(false);
    }
  }

  async function updateUserStatus(userId: string, newStatus: 'active' | 'banned') {
    try {
      // Use service role function to update user status
      const { data, error } = await supabase
        .rpc('admin_update_user_status', { 
          p_user_id: userId, 
          p_status: newStatus 
        });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update user status');
      }

      // If activating a user, also update their creator profile if they have one
      if (newStatus === 'active') {
        // Check if user is a creator
        const { data: creatorProfile, error: creatorError } = await supabase
          .from('creator_profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
          
        if (!creatorError && creatorProfile) {
          // Update creator profile to active
          const { error: updateProfileError } = await supabase
            .from('creator_profiles')
            .update({ active: true })
            .eq('id', userId);
            
          if (updateProfileError) {
            console.error('Error updating creator profile:', updateProfileError);
            toast.error('שגיאה בעדכון פרופיל היוצר');
          } else {
            toast.success('פרופיל היוצר הופעל בהצלחה');
          }
        }
      }

      // If banning a user, also disable all their video ads
      if (newStatus === 'banned') {
        // Check if user is a creator
        const { data: creatorProfile, error: creatorError } = await supabase
          .from('creator_profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
          
        if (!creatorError && creatorProfile) {
          // Update creator profile to inactive
          const { error: updateProfileError } = await supabase
            .from('creator_profiles')
            .update({ active: false })
            .eq('id', userId);
            
          if (updateProfileError) {
            console.error('Error updating creator profile:', updateProfileError);
            toast.error('שגיאה בעדכון פרופיל היוצר');
          }
          
          // Disable all video ads for this creator
          const { error: updateAdsError } = await supabase
            .from('video_ads')
            .update({ active: false })
            .eq('creator_id', userId);
            
          if (updateAdsError) {
            console.error('Error disabling video ads:', updateAdsError);
            toast.error('שגיאה בהשבתת מודעות הוידאו של המשתמש');
          } else {
            toast.success('כל מודעות הוידאו של המשתמש הושבתו');
          }
        }
      }

      toast.success(`המשתמש ${newStatus === 'banned' ? 'נחסם' : 'הופעל'} בהצלחה`);
      
      // Update the local state to reflect the change
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      // Log the action using service role function
      await supabase.rpc('admin_log_audit_event', {
        p_action: newStatus === 'banned' ? 'ban_user' : 'activate_user',
        p_table_name: 'users',
        p_record_id: userId,
        p_details: {
          previous_status: newStatus === 'banned' ? 'active' : 'banned',
          new_status: newStatus,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('שגיאה בעדכון סטטוס משתמש:', error);
      toast.error('שגיאה בעדכון סטטוס משתמש');
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    try {
      // Use service role function to update user role
      const { data, error } = await supabase
        .rpc('admin_update_user_role', { 
          p_user_id: userId, 
          p_role: newRole 
        });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update user role');
      }

      toast.success('תפקיד המשתמש עודכן בהצלחה');
      
      // Update the local state to reflect the change
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      // Log the action using service role function
      await supabase.rpc('admin_log_audit_event', {
        p_action: 'update_user_role',
        p_table_name: 'users',
        p_record_id: userId,
        p_details: {
          new_role: newRole,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('שגיאה בעדכון תפקיד משתמש:', error);
      toast.error('שגיאה בעדכון תפקיד משתמש');
    }
  }

  async function toggleSuperAdmin(userId: string, isSuperAdmin: boolean) {
    try {
      // Use service role function to update super admin status
      const { data, error } = await supabase
        .rpc('admin_update_super_admin_status', { 
          p_user_id: userId, 
          p_is_super_admin: !isSuperAdmin 
        });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update super admin status');
      }

      toast.success(isSuperAdmin ? 'הרשאות מנהל-על הוסרו בהצלחה' : 'הרשאות מנהל-על הוענקו בהצלחה');
      
      // Update the local state to reflect the change
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_super_admin: !isSuperAdmin } : user
      ));
      
      // Log the change using service role function
      await supabase.rpc('admin_log_audit_event', {
        p_action: isSuperAdmin ? 'revoke_super_admin' : 'grant_super_admin',
        p_table_name: 'users',
        p_record_id: userId,
        p_details: {
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

  async function sendPasswordResetEmail(userId: string) {
    try {
      // Get user email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      
      if (!userData?.email) {
        toast.error('לא נמצאה כתובת אימייל עבור משתמש זה');
        return;
      }
      
      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(userData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast.success('נשלח אימייל לאיפוס סיסמה');
      
      // Log the action using service role function
      await supabase.rpc('admin_log_audit_event', {
        p_action: 'send_password_reset',
        p_table_name: 'users',
        p_record_id: userId,
        p_details: {
          email: userData.email,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('שגיאה בשליחת אימייל לאיפוס סיסמה:', error);
      toast.error('שגיאה בשליחת אימייל לאיפוס סיסמה');
    }
  }

  async function deleteUser(userId: string) {
    try {
      // Use service role function to delete user
      const { data, error } = await supabase
        .rpc('admin_delete_user', { 
          p_user_id: userId 
        });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to delete user');
      }
      
      toast.success('המשתמש נמחק בהצלחה');
      
      // Update local state
      setUsers(users.filter(user => user.id !== userId));
      
      // Log the action using service role function
      await supabase.rpc('admin_log_audit_event', {
        p_action: 'delete_user',
        p_table_name: 'users',
        p_record_id: userId,
        p_details: {
          deleted_user_email: data.deleted_user_email,
          deleted_user_role: data.deleted_user_role,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('שגיאה במחיקת משתמש:', error);
      toast.error('שגיאה במחיקת משתמש');
    }
  }

  async function exportAllEmails() {
    try {
      // Only admins can export emails
      if (!isAdmin) {
        toast.error('אין לך הרשאות לייצא אימיילים');
        return;
      }
      
      toast.loading('מכין רשימת אימיילים...', { id: 'export-emails' });
      
      // Fetch all users using service role function
      const { data: allUsers, error } = await supabase
        .rpc('admin_get_all_users');

      if (error) throw error;

      if (!allUsers || allUsers.length === 0) {
        toast.error('לא נמצאו משתמשים', { id: 'export-emails' });
        return;
      }

      // Create CSV content
      const csvHeaders = 'Email,Name,Role,Status,Created At\n';
      const csvContent = allUsers.map((user: any) => {
        const email = user.email || '';
        const name = (user.name || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
        const role = user.role || 'user';
        const status = user.status || 'active';
        const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('he-IL') : '';
        return `${email},"${name}",${role},${status},${createdAt}`;
      }).join('\n');

      const fullCsvContent = csvHeaders + csvContent;

      // Create and download the file
      const blob = new Blob([fullCsvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `user-emails-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`ייצוא הושלם! ${allUsers.length} אימיילים נשמרו בקובץ`, { id: 'export-emails' });
      
      // Log the export action using service role function
      await supabase.rpc('admin_log_audit_event', {
        p_action: 'export_user_emails',
        p_table_name: 'users',
        p_record_id: null,
        p_details: {
          exported_count: allUsers.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('שגיאה בייצוא אימיילים:', error);
      toast.error('שגיאה בייצוא אימיילים', { id: 'export-emails' });
    }
  }

  const handleAction = (action: string, userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    switch (action) {
      case 'balance':
        setSelectedUser(user);
        setIsBalanceModalOpen(true);
        break;
      case 'resetPassword':
        setSelectedUser(user);
        sendPasswordResetEmail(userId);
        break;
      case 'email':
        setSelectedUser(user);
        toast.error('פונקציונליות זו עדיין לא זמינה');
        break;
      case 'activate':
        setConfirmAction({
          type: 'activate',
          userId,
          userName: user.name || user.email
        });
        setIsConfirmModalOpen(true);
        break;
      case 'ban':
        setConfirmAction({
          type: 'ban',
          userId,
          userName: user.name || user.email
        });
        setIsConfirmModalOpen(true);
        break;
      case 'toggleSuperAdmin':
        setConfirmAction({
          type: 'toggleSuperAdmin',
          userId,
          userName: user.name || user.email
        });
        setIsConfirmModalOpen(true);
        break;
      case 'delete':
        setConfirmAction({
          type: 'delete',
          userId,
          userName: user.name || user.email
        });
        setIsConfirmModalOpen(true);
        break;
      default:
        break;
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    
    switch (confirmAction.type) {
      case 'activate':
        updateUserStatus(confirmAction.userId, 'active');
        break;
      case 'ban':
        updateUserStatus(confirmAction.userId, 'banned');
        break;
      case 'toggleSuperAdmin':
        const user = users.find(u => u.id === confirmAction.userId);
        if (user) {
          toggleSuperAdmin(confirmAction.userId, user.is_super_admin || false);
        }
        break;
      case 'delete':
        deleteUser(confirmAction.userId);
        break;
    }
    
    setIsConfirmModalOpen(false);
    setConfirmAction(null);
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    
    return (
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.id.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'banned':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'creator':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderUserActions = (user: ExtendedUser) => {
    return (
      <div className="flex items-center space-x-2 space-x-reverse">
        {user.status === 'banned' ? (
          <button
            onClick={() => handleAction('activate', user.id)}
            className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-gray-100"
            title="הפעל משתמש"
          >
            <CheckCircle className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={() => handleAction('ban', user.id)}
            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-gray-100"
            title="חסום משתמש"
          >
            <Ban className="h-5 w-5" />
          </button>
        )}
        
        {/* Only show super admin toggle for admin users and only if current user is super admin */}
        {isSuperAdmin && user.role === 'admin' && (
          <button
            onClick={() => handleAction('toggleSuperAdmin', user.id)}
            className={`${user.is_super_admin ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'} p-1 rounded-full hover:bg-gray-100`}
            title={user.is_super_admin ? 'הסר הרשאות מנהל-על' : 'הענק הרשאות מנהל-על'}
          >
            <Star className="h-5 w-5" />
          </button>
        )}
        
        <UserActionMenu 
          user={user} 
          onAction={handleAction}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין הרשאת גישה</h2>
          <p className="text-gray-600">אין לך הרשאות מנהל לצפות בדף זה.</p>
        </div>
      </div>
    );
  }

  if (loading && users.length === 0) {
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
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">ניהול משתמשים</h1>
          <p className="text-sm text-gray-500 mt-1">סה"כ {totalUsers} משתמשים</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportAllEmails}
            className="flex items-center px-4 py-2 text-sm font-medium text-primary-600 bg-white border border-primary-600 rounded-lg hover:bg-primary-50"
            title="הורד את כל כתובות האימייל"
          >
            <Download className="w-4 h-4 ml-2" />
            הורד אימיילים
          </button>
          <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">
            <UserPlus className="w-4 h-4 ml-2" />
            הוסף משתמש
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="חיפוש משתמשים לפי אימייל, שם או מזהה..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(0); // Reset to first page when filter changes
          }}
          className="border rounded-lg px-4 py-2"
        >
          <option value="all">כל התפקידים</option>
          <option value="admin">מנהל</option>
          <option value="creator">יוצר</option>
          <option value="user">משתמש</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0); // Reset to first page when filter changes
          }}
          className="border rounded-lg px-4 py-2"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="banned">חסום</option>
          <option value="pending">ממתין</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && users.length > 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center z-10">
            <Loader className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">משתמש</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תפקיד</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">יתרה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעיל לאחרונה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">כניסות</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}`}
                            alt=""
                          />
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.name || user.email}
                            {user.is_super_admin && (
                              <span className="mr-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                מנהל-על
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">UUID:</span>
                            <div className="group flex items-center">
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 max-w-[200px] truncate">
                                {user.id}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(user.id);
                                  toast.success('UUID הועתק ללוח');
                                }}
                                className="opacity-0 group-hover:opacity-100 ml-1 p-1 hover:bg-gray-200 rounded transition-opacity"
                                title="העתק UUID"
                              >
                                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role || 'user'}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 ${getRoleColor(user.role || 'user')}`}
                      >
                        <option value="user">משתמש</option>
                        <option value="creator">יוצר</option>
                        <option value="admin">מנהל</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.status)}`}>
                        {user.status === 'active' ? 'פעיל' :
                         user.status === 'banned' ? 'חסום' :
                         user.status === 'pending' ? 'ממתין' : user.status}
                      </span>
                      {user.status === 'banned' && (
                        <div className="mt-1 flex items-center text-xs text-red-600">
                          <Lock className="h-3 w-3 mr-1" />
                          <span>לא יכול להתחבר</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="font-medium">₪{user.wallet_balance?.toFixed(2) || '0.00'}</span>
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setIsBalanceModalOpen(true);
                          }}
                          className="ml-2 text-primary-600 hover:text-primary-800 p-1 rounded-full hover:bg-gray-100"
                          title="עדכן יתרה"
                        >
                          <DollarSign className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_seen_at ? new Date(user.last_seen_at).toLocaleDateString('he-IL') : 'מעולם לא'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.login_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {renderUserActions(user as ExtendedUser)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    לא נמצאו משתמשים התואמים את החיפוש
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                הקודם
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                הבא
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  מציג <span className="font-medium">{page * pageSize + 1}</span> עד{' '}
                  <span className="font-medium">{Math.min((page + 1) * pageSize, totalUsers)}</span> מתוך{' '}
                  <span className="font-medium">{totalUsers}</span> משתמשים
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">הקודם</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pages around current page
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i;
                    } else if (page < 3) {
                      pageNum = i;
                    } else if (page > totalPages - 3) {
                      pageNum = totalPages - 5 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pageNum
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">הבא</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserBalanceModal
          isOpen={isBalanceModalOpen}
          onClose={() => {
            setIsBalanceModalOpen(false);
            setSelectedUser(null);
          }}
          onSuccess={fetchUsers}
        />
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">אישור פעולה</h3>
            
            {confirmAction.type === 'ban' && (
              <div>
                <p className="text-gray-700 mb-4">
                  האם אתה בטוח שברצונך לחסום את המשתמש <span className="font-semibold">{confirmAction.userName}</span>?
                </p>
                <p className="text-red-600 text-sm mb-4">
                  <Lock className="h-4 w-4 inline-block ml-1" />
                  משתמש חסום לא יוכל להתחבר למערכת וכל מודעות הוידאו שלו יושבתו.
                </p>
              </div>
            )}
            
            {confirmAction.type === 'activate' && (
              <p className="text-gray-700 mb-4">
                האם אתה בטוח שברצונך להפעיל את המשתמש <span className="font-semibold">{confirmAction.userName}</span>?
              </p>
            )}
            
            {confirmAction.type === 'delete' && (
              <div>
                <p className="text-gray-700 mb-4">
                  האם אתה בטוח שברצונך למחוק את המשתמש <span className="font-semibold">{confirmAction.userName}</span>?
                </p>
                <p className="text-red-600 text-sm mb-4">
                  <AlertTriangle className="h-4 w-4 inline-block ml-1" />
                  פעולה זו אינה ניתנת לביטול! כל הנתונים הקשורים למשתמש זה יימחקו לצמיתות.
                </p>
              </div>
            )}
            
            {confirmAction.type === 'toggleSuperAdmin' && (
              <p className="text-gray-700 mb-4">
                האם אתה בטוח שברצונך {users.find(u => u.id === confirmAction.userId)?.is_super_admin ? 'להסיר' : 'להעניק'} הרשאות מנהל-על למשתמש <span className="font-semibold">{confirmAction.userName}</span>?
              </p>
            )}
            
            <div className="flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 rounded-md text-white ${
                  confirmAction.type === 'delete' || confirmAction.type === 'ban'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                אישור
              </button>
              <button
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
