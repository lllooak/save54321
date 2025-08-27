import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { DollarSign, CreditCard, Clock, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

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
  };
}

interface WithdrawalHistoryProps {
  creatorId: string;
  onNewRequest: () => void;
}

export function WithdrawalHistory({ creatorId, onNewRequest }: WithdrawalHistoryProps) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(true);
  const [showPendingSection, setShowPendingSection] = useState(true);
  const [showRejectedSection, setShowRejectedSection] = useState(true);
  const [availableAmount, setAvailableAmount] = useState<number>(0);

  useEffect(() => {
    if (creatorId && creatorId.trim() !== '') {
      fetchWithdrawals();
      fetchAvailableAmount();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('withdrawal_changes')
        .on('postgres_changes', 
          { 
            event: '*',
            schema: 'public',
            table: 'withdrawal_requests',
            filter: `creator_id=eq.${creatorId}`
          }, 
          (payload) => {
            console.log('Real-time update received:', payload);
            fetchWithdrawals();
            fetchAvailableAmount();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setLoading(false);
      setWithdrawals([]);
    }
  }, [creatorId]);

  async function fetchWithdrawals() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*, creator:creator_profiles(name)')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawal history:', error);
      toast.error('שגיאה בטעינת היסטוריית משיכות');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchAvailableAmount() {
    try {
      const { data, error } = await supabase
        .rpc('get_available_withdrawal_amount', {
          p_creator_id: creatorId
        });

      if (error) throw error;
      setAvailableAmount(data || 0);
    } catch (error) {
      console.error('Error fetching available withdrawal amount:', error);
      toast.error('שגיאה בטעינת סכום זמין למשיכה');
    }
  }

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

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWithdrawals(),
      fetchAvailableAmount()
    ]);
    toast.success('היסטוריית המשיכות עודכנה');
  };

  // Filter withdrawals by status
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
  const rejectedWithdrawals = withdrawals.filter(w => w.status === 'rejected');

  const renderWithdrawalTable = (items: WithdrawalRequest[]) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שיטה</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פרטים</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                אין בקשות משיכה
              </td>
            </tr>
          ) : (
            items.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(withdrawal.created_at), 'dd/MM/yyyy')}
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
                  {withdrawal.method === 'paypal' ? withdrawal.paypal_email : 'פרטי בנק'}
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (!creatorId || creatorId.trim() === '') {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 text-center text-gray-500">
          אנא התחבר כדי לצפות בהיסטוריית המשיכות
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">היסטוריית משיכות</h2>
            <p className="text-sm text-gray-500 mt-1">סכום זמין למשיכה: ₪{availableAmount.toFixed(2)}</p>
          </div>
          <div className="flex space-x-2 space-x-reverse">
            <button
              onClick={refreshData}
              className="px-3 py-1 text-gray-600 hover:text-gray-800 rounded-md flex items-center"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ml-1 ${refreshing ? 'animate-spin' : ''}`} />
              רענן
            </button>
            <button
              onClick={onNewRequest}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
              disabled={availableAmount <= 0}
            >
              בקשת משיכה חדשה
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            אין היסטוריית משיכות
          </div>
        ) : (
          <>
            {/* Pending Withdrawals Section */}
            {pendingWithdrawals.length > 0 && (
              <div>
                <div className="px-6 py-3 border-b border-gray-200 flex justify-between items-center bg-yellow-50">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-yellow-600 ml-2" />
                    <h3 className="text-md font-medium text-gray-900">בקשות ממתינות ({pendingWithdrawals.length})</h3>
                  </div>
                  <button 
                    onClick={() => setShowPendingSection(!showPendingSection)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {showPendingSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>
                {showPendingSection && renderWithdrawalTable(pendingWithdrawals)}
              </div>
            )}

            {/* Completed Withdrawals Section */}
            {completedWithdrawals.length > 0 && (
              <div>
                <div className="px-6 py-3 border-b border-gray-200 flex justify-between items-center bg-green-50">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 ml-2" />
                    <h3 className="text-md font-medium text-gray-900">בקשות שהושלמו ({completedWithdrawals.length})</h3>
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
            {rejectedWithdrawals.length > 0 && (
              <div>
                <div className="px-6 py-3 border-b border-gray-200 flex justify-between items-center bg-red-50">
                  <div className="flex items-center">
                    <XCircle className="h-5 w-5 text-red-600 ml-2" />
                    <h3 className="text-md font-medium text-gray-900">בקשות שנדחו ({rejectedWithdrawals.length})</h3>
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
          </>
        )}
      </div>
    </div>
  );
}
