import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface UserBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserBalanceModal({ isOpen, onClose, onSuccess }: UserBalanceModalProps) {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchUsers = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      // Check admin access first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('אתה לא מחובר למערכת');
      }

      // Use existing admin function to get user by super admin status first
      const { data: adminData, error: adminError } = await supabase.rpc(
        'admin_get_user_super_admin_status',
        { p_user_id: session.user.id }
      );
      
      if (adminError || !adminData?.[0]?.is_admin) {
        throw new Error('אין לך הרשאות גישה');
      }

      // Try new RPC function first, fallback if not available
      let data, error;
      try {
        const result = await supabase.rpc('admin_search_users', {
          p_search_query: query,
          p_limit: 5
        });
        data = result.data;
        error = result.error;
      } catch (rpcError) {
        // Fallback: Manual ID entry mode
        console.log('admin_search_users RPC not available, enabling manual ID entry');
        setSearchResults([]);
        toast.error('חיפוש לא זמין כרגע. הכנס ID משתמש ישירות');
        return;
      }

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('שגיאה בחיפוש משתמשים');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setUserId(user.id);
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!userId) {
      setError('יש לבחור משתמש');
      return;
    }
    
    if (!amount || isNaN(parseFloat(amount))) {
      setError('יש להזין סכום תקין');
      return;
    }

    // Round to 2 decimal places
    const roundedAmount = parseFloat(parseFloat(amount).toFixed(2));

    setLoading(true);
    try {
      // First check if the current user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('אתה לא מחובר למערכת');
      }

      // Use service role function to update user balance (includes admin check)
      const operation = roundedAmount >= 0 ? 'add' : 'subtract';
      const absoluteAmount = Math.abs(roundedAmount);
      
      const { data, error } = await supabase.rpc('admin_update_user_balance', {
        p_user_id: userId,
        p_amount: absoluteAmount,
        p_operation: operation,
        p_description: reason || 'עדכון יתרה ידני על ידי מנהל'
      });

      if (error) {
        console.error('RPC error:', error);
        throw new Error(error.message || 'שגיאה בעדכון היתרה');
      }
      
      if (!data || !data.success) {
        throw new Error(data?.error || 'שגיאה בעדכון היתרה');
      }

      toast.success('היתרה עודכנה בהצלחה');
      onSuccess();
      onClose();
      
      // Reset form
      setUserId('');
      setAmount('');
      setReason('');
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error adjusting balance:', error);
      setError(error.message || 'שגיאה בעדכון היתרה');
      toast.error(error.message || 'שגיאה בעדכון היתרה');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full" dir="rtl">
        <h2 className="text-lg font-semibold mb-4">עדכון יתרת ארנק</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              חיפוש משתמש / הכנסת ID ידנית
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש לפי אימייל/שם או הכנס UUID של משתמש..."
                className="w-full px-3 py-2 border rounded-md"
              />
              {searchLoading && (
                <div className="absolute left-3 top-2">
                  <div className="animate-spin h-5 w-5 border-2 border-primary-500 rounded-full border-t-transparent"></div>
                </div>
              )}
            </div>
            
            {/* Manual UUID entry option */}
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                או הכנס UUID ישירות:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="12345678-1234-5678-9012-123456789012"
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                  onChange={(e) => {
                    const uuid = e.target.value.trim();
                    if (uuid.length === 36) {
                      setUserId(uuid);
                      setSelectedUser({ id: uuid, name: 'משתמש (ID ידני)', email: 'לא זמין', role: 'לא ידוע', wallet_balance: 0 });
                      setSearchQuery('');
                      setSearchResults([]);
                    }
                  }}
                />
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-1 border rounded-md shadow-sm max-h-40 overflow-y-auto">
                {searchResults.map(user => (
                  <div 
                    key={user.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="font-medium">{user.name || 'ללא שם'}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">
                      {user.role === 'creator' ? 'יוצר' : user.role === 'admin' ? 'מנהל' : 'מעריץ'} | 
                      יתרה: ₪{parseFloat((user.wallet_balance || 0).toFixed(2))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {selectedUser && (
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <div className="font-medium">{selectedUser.name || 'ללא שם'}</div>
                <div className="text-sm">{selectedUser.email}</div>
                <div className="text-sm">
                  תפקיד: {selectedUser.role === 'creator' ? 'יוצר' : selectedUser.role === 'admin' ? 'מנהל' : selectedUser.role === 'לא ידוע' ? 'לא ידוע' : 'מעריץ'}
                </div>
                <div className="text-sm font-medium">
                  {selectedUser.wallet_balance !== undefined ? 
                    `יתרה נוכחית: ₪${parseFloat((selectedUser.wallet_balance || 0).toFixed(2))}` : 
                    'יתרה: לא זמין (הוכנס ID ידנית)'
                  }
                </div>
                {selectedUser.name === 'משתמש (ID ידני)' && (
                  <div className="text-xs text-orange-600 mt-1">
                    ⚠️ הוכנס ID ידנית - אמת שזה המשתמש הנכון לפני עדכון יתרה
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סכום (₪)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">₪</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  // Limit to 2 decimal places
                  const value = e.target.value;
                  if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) {
                    setAmount(value);
                  }
                }}
                className="w-full pr-7 pl-3 py-2 border rounded-md"
                placeholder="הזן סכום (חיובי להוספה, שלילי להורדה)"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              הזן מספר חיובי להוספת כסף, או מספר שלילי להורדת כסף
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סיבה
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="סיבה לשינוי היתרה"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 ml-3"
              disabled={loading}
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              disabled={loading || !userId || !amount}
            >
              {loading ? 'מעדכן...' : 'עדכן יתרה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
