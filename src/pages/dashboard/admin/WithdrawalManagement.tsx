import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { RefreshCw, Clock, Search, DollarSign, ChevronDown, ChevronUp, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface WithdrawalRequest {
  id: string;
  creator_id: string;
  amount: number;
  method: 'paypal' | 'bank';
  paypal_email: string | null;
  bank_details: string | null;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  processed_at: string | null;
  creator?: {
    name: string;
    email?: string;
    avatar_url?: string | null;
  };
}


export function WithdrawalManagement() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState(50);
  const [isEditingMinAmount, setIsEditingMinAmount] = useState(false);
  const [newMinAmount, setNewMinAmount] = useState('50');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(true);
  const [showPendingSection, setShowPendingSection] = useState(true);
  const [showRejectedSection, setShowRejectedSection] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const checkAccess = async () => {
      const hasAccess = await checkAdminAccess();
      setIsAdmin(hasAccess);
      
      if (hasAccess) {
        fetchWithdrawals();
        fetchMinWithdrawAmount();
        
        // Set up real-time subscription
        const subscription = supabase
          .channel('withdrawal_changes')
          .on('postgres_changes', 
            { 
              event: '*',
              schema: 'public',
              table: 'withdrawal_requests'
            }, 
            () => {
              fetchWithdrawals();
            }
          )
          .subscribe();

        return () => {
          subscription.unsubscribe();
        };
      }
    };
    
    checkAccess();
  }, [filter, searchQuery]);

  async function checkAdminAccess() {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session or user, return false instead of throwing
      if (!session?.user) {
        return false;
      }
      
      // Check if user is admin using service role function
      const { data: userData, error: userError } = await supabase.rpc(
        'admin_get_user_super_admin_status',
        { p_user_id: session.user.id }
      );
      
      if (userError) {
        console.error('Error checking admin status:', userError);
        return false;
      }
      
      // Check if user is either a regular admin or super admin
      return userData?.[0]?.is_admin === true || userData?.[0]?.is_super_admin === true;
    } catch (error) {
      console.error('Admin access check failed:', error);
      return false;
    }
  }

  async function fetchWithdrawals() {
    try {
      setLoading(true);
      
      // Get withdrawal count using service role function
      const { data: countData, error: countError } = await supabase.rpc(
        'admin_get_withdrawal_requests_count',
        { p_status_filter: filter }
      );
      
      if (countError) throw countError;
      setTotalCount(countData || 0);
      
      // Get withdrawal requests using service role function
      const { data, error } = await supabase.rpc(
        'admin_get_withdrawal_requests',
        {
          p_status_filter: filter,
          p_search_query: searchQuery
        }
      );

      if (error) throw error;
      
      // Transform data to match expected format
      const transformedWithdrawals = (data || []).map((withdrawal: any) => ({
        id: withdrawal.id,
        creator_id: withdrawal.creator_id,
        amount: withdrawal.amount,
        method: withdrawal.method,
        paypal_email: withdrawal.paypal_email,
        bank_details: withdrawal.bank_details,
        status: withdrawal.status,
        created_at: withdrawal.created_at,
        processed_at: withdrawal.processed_at,
        creator: {
          name: withdrawal.creator_name,
          email: withdrawal.creator_email,
          avatar_url: withdrawal.creator_avatar_url
        }
      }));

      setWithdrawals(transformedWithdrawals);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('שגיאה בטעינת בקשות משיכה');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const fetchMinWithdrawAmount = async () => {
    try {
      const { data: amount, error } = await supabase.rpc('admin_get_min_withdrawal_amount');

      if (error) throw error;

      setMinWithdrawAmount(amount || 50);
      setNewMinAmount((amount || 50).toString());
    } catch (error) {
      console.error('Error fetching minimum withdrawal amount:', error);
    }
  };

  const updateMinWithdrawAmount = async () => {
    try {
      const amount = parseFloat(newMinAmount);
      
      if (isNaN(amount) || amount <= 0) {
        toast.error('אנא הזן סכום תקין');
        return;
      }
      
      const { error } = await supabase.rpc(
        'admin_set_min_withdrawal_amount',
        { p_amount: amount }
      );

      if (error) throw error;
      
      setMinWithdrawAmount(amount);
      setIsEditingMinAmount(false);
      toast.success('סכום המשיכה המינימלי עודכן בהצלחה');
    } catch (error) {
      console.error('Error updating minimum withdrawal amount:', error);
      toast.error('שגיאה בעדכון סכום המשיכה המינימלי');
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'completed' | 'rejected') => {
    try {
      setProcessingId(id);
      
      const withdrawal = withdrawals.find(w => w.id === id);
      if (!withdrawal) {
        throw new Error('Withdrawal request not found');
      }
      
      // Check if the withdrawal is already processed
      if (withdrawal.status !== 'pending') {
        toast.error('בקשת המשיכה כבר עובדה');
        return;
      }
      
      // Update withdrawal status using service role function
      const { error } = await supabase.rpc(
        'admin_update_withdrawal_status',
        {
          p_withdrawal_id: id,
          p_new_status: newStatus
        }
      );

      if (error) throw error;
      
      toast.success(`בקשת המשיכה ${newStatus === 'completed' ? 'אושרה' : 'נדחתה'} בהצלחה`);
      
      // Update local state immediately
      setWithdrawals(prevWithdrawals => 
        prevWithdrawals.map(w => 
          w.id === id ? { ...w, status: newStatus, processed_at: new Date().toISOString() } : w
        )
      );
      
      // Refresh data after a short delay to ensure database trigger has completed
      setTimeout(() => {
        fetchWithdrawals();
      }, 1000);
    } catch (error) {
      console.error('Error updating withdrawal status:', error);
      toast.error('שגיאה בעדכון סטטוס המשיכה');
    } finally {
      setProcessingId(null);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchWithdrawals();
    toast.success('הנתונים עודכנו בהצלחה');
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'ממתין לאישור';
      case 'completed': return 'הושלם';
      case 'rejected': return 'נדחה';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'paypal': return <DollarSign className="h-5 w-5 text-blue-500" />;
      case 'bank': return <CreditCard className="h-5 w-5 text-purple-500" />;
      default: return null;
    }
  };

  // Filter withdrawals by status
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
  const rejectedWithdrawals = withdrawals.filter(w => w.status === 'rejected');

  const renderWithdrawalTable = (items: WithdrawalRequest[], showActions: boolean = false) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">יוצר</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך בקשה</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שיטה</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פרטים</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
            {showActions && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 7 : 6} className="px-6 py-4 text-center text-gray-500">
                אין בקשות משיכה
              </td>
            </tr>
          ) : (
            items.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {withdrawal.creator?.avatar_url && (
                      <img 
                        src={withdrawal.creator.avatar_url} 
                        alt={withdrawal.creator.name || 'יוצר'} 
                        className="h-8 w-8 rounded-full mr-3 object-cover"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{withdrawal.creator?.name || 'לא ידוע'}</div>
                      <div className="text-sm text-gray-500">{withdrawal.creator?.email || 'אין אימייל'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(withdrawal.created_at), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ₪{withdrawal.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getMethodIcon(withdrawal.method)}
                    <span className="mr-2 text-sm text-gray-900">
                      {withdrawal.method === 'paypal' ? 'PayPal' : 'העברה בנקאית'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {withdrawal.method === 'paypal' 
                    ? withdrawal.paypal_email 
                    : (
                      <button
                        onClick={() => {
                          if (withdrawal.bank_details) {
                            alert(`פרטי בנק: ${withdrawal.bank_details}`);
                          }
                        }}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        הצג פרטי בנק
                      </button>
                    )
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getStatusIcon(withdrawal.status)}
                    <span className={`mr-2 text-sm ${
                      withdrawal.status === 'completed' ? 'text-green-600' :
                      withdrawal.status === 'rejected' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {getStatusLabel(withdrawal.status)}
                    </span>
                  </div>
                  {withdrawal.processed_at && (
                    <div className="text-xs text-gray-500 mt-1">
                      טופל ב-{format(new Date(withdrawal.processed_at), 'dd/MM/yyyy')}
                    </div>
                  )}
                </td>
                {showActions && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleStatusChange(withdrawal.id, 'completed')}
                        disabled={processingId === withdrawal.id}
                        className="text-green-600 hover:text-green-700 disabled:opacity-50 ml-2"
                      >
                        {processingId === withdrawal.id ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            מעבד...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <CheckCircle className="h-5 w-5 ml-1" />
                            אשר
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange(withdrawal.id, 'rejected')}
                        disabled={processingId === withdrawal.id}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        <span className="flex items-center">
                          <XCircle className="h-5 w-5 ml-1" />
                          דחה
                        </span>
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין הרשאת גישה</h2>
          <p className="text-gray-600">אין לך הרשאות מנהל לצפות בדף זה.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">ניהול משיכות</h1>
          <p className="text-sm text-gray-500 mt-1">סה"כ {totalCount} בקשות</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={refreshData}
            className="px-3 py-1 text-gray-600 hover:text-gray-800 rounded-md flex items-center"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ml-1 ${refreshing ? 'animate-spin' : ''}`} />
            רענן נתונים
          </button>
          <div className="flex items-center bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm text-gray-600 ml-2">סכום משיכה מינימלי:</span>
            {isEditingMinAmount ? (
              <div className="flex items-center">
                <input
                  type="number"
                  value={newMinAmount}
                  onChange={(e) => setNewMinAmount(e.target.value)}
                  className="w-20 px-2 py-1 border rounded-md text-sm"
                  min="1"
                  step="1"
                />
                <button
                  onClick={updateMinWithdrawAmount}
                  className="ml-2 text-primary-600 hover:text-primary-700 text-sm"
                >
                  שמור
                </button>
                <button
                  onClick={() => {
                    setIsEditingMinAmount(false);
                    setNewMinAmount(minWithdrawAmount.toString());
                  }}
                  className="ml-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  ביטול
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <span className="font-medium">₪{minWithdrawAmount}</span>
                <button
                  onClick={() => setIsEditingMinAmount(true)}
                  className="ml-2 text-primary-600 hover:text-primary-700 text-sm"
                >
                  ערוך
                </button>
              </div>
            )}
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="all">כל הבקשות</option>
            <option value="pending">ממתינות</option>
            <option value="completed">הושלמו</option>
            <option value="rejected">נדחו</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center mb-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם יוצר או אימייל..."
            className="w-full pr-10 pl-4 py-2 border rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Pending Withdrawals Section */}
          {(filter === 'all' || filter === 'pending') && pendingWithdrawals.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-yellow-50">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-yellow-600 ml-2" />
                  <h2 className="text-lg font-medium text-gray-900">בקשות ממתינות ({pendingWithdrawals.length})</h2>
                </div>
                <button 
                  onClick={() => setShowPendingSection(!showPendingSection)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showPendingSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
              {showPendingSection && renderWithdrawalTable(pendingWithdrawals, true)}
            </div>
          )}

          {/* Completed Withdrawals Section */}
          {(filter === 'all' || filter === 'completed') && completedWithdrawals.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-green-50">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 ml-2" />
                  <h2 className="text-lg font-medium text-gray-900">בקשות שהושלמו ({completedWithdrawals.length})</h2>
                </div>
                <button 
                  onClick={() => setShowCompletedSection(!showCompletedSection)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showCompletedSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
              {showCompletedSection && renderWithdrawalTable(completedWithdrawals)}
            </div>
          )}

          {/* Rejected Withdrawals Section */}
          {(filter === 'all' || filter === 'rejected') && rejectedWithdrawals.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-red-50">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-600 ml-2" />
                  <h2 className="text-lg font-medium text-gray-900">בקשות שנדחו ({rejectedWithdrawals.length})</h2>
                </div>
                <button 
                  onClick={() => setShowRejectedSection(!showRejectedSection)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showRejectedSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
              {showRejectedSection && renderWithdrawalTable(rejectedWithdrawals)}
            </div>
          )}

          {/* No withdrawals message */}
          {withdrawals.length === 0 && (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              אין בקשות משיכה {filter !== 'all' ? `ב-${getStatusLabel(filter)}` : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}
