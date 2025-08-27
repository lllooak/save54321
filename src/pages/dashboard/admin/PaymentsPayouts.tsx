import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Search, Users, DollarSign, Star, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { UserBalanceModal } from './UserBalanceModal';

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  description: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  user_role?: string;
}

interface TransactionStats {
  totalTopUps: number;
  totalAmount: number;
  averageTopUp: number;
  activeUsers: number;
  totalPurchases: number;
  totalRefunds: number;
}

export function PaymentsPayouts() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    totalTopUps: 0,
    totalAmount: 0,
    averageTopUp: 0,
    activeUsers: 0,
    totalPurchases: 0,
    totalRefunds: 0
  });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  useEffect(() => {
    fetchTransactions();
    calculateStats();
  }, [typeFilter, statusFilter]);

  async function fetchTransactions() {
    try {
      setLoading(true);
      
      // Get transaction count using service role function
      const { data: countData, error: countError } = await supabase.rpc(
        'admin_get_wallet_transactions_count',
        {
          p_type_filter: typeFilter,
          p_status_filter: statusFilter
        }
      );
      
      if (countError) throw countError;
      setTotalTransactions(countData || 0);
      
      // Get transactions using service role function
      const { data, error } = await supabase.rpc(
        'admin_get_wallet_transactions',
        {
          p_type_filter: typeFilter,
          p_status_filter: statusFilter,
          p_limit: 50
        }
      );

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('שגיאה בטעינת העברות:', error);
      toast.error('שגיאה בטעינת העברות');
    } finally {
      setLoading(false);
    }
  }

  async function calculateStats() {
    try {
      // Get payment statistics using service role function
      const { data: statsData, error: statsError } = await supabase.rpc('admin_get_payment_stats');
      
      if (statsError) throw statsError;
      
      setStats({
        totalTopUps: statsData?.totalTopUps || 0,
        totalAmount: Number(statsData?.totalAmount || 0),
        averageTopUp: Number(statsData?.averageTopUp || 0),
        activeUsers: statsData?.activeUsers || 0,
        totalPurchases: Number(statsData?.totalPurchases || 0),
        totalRefunds: Number(statsData?.totalRefunds || 0)
      });
    } catch (error) {
      console.error('שגיאה בחישוב סטטיסטיקות:', error);
      toast.error('שגיאה בחישוב סטטיסטיקות');
    }
  }

  const filteredTransactions = transactions.filter(transaction => {
    if (!searchQuery) return true;
    
    return (
      (transaction.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (transaction.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (transaction.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    );
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'top_up': return 'טעינה';
      case 'purchase': return 'רכישה';
      case 'refund': return 'החזר';
      case 'earning': return 'הכנסה';
      case 'fee': return 'עמלה';
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'הושלם';
      case 'pending': return 'בהמתנה';
      case 'failed': return 'נכשל';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">תשלומים והעברות</h1>
          <p className="text-sm text-gray-500 mt-1">סה"כ {totalTransactions} העברות</p>
        </div>
        <div className="flex space-x-4">
          <button 
            onClick={() => setIsBalanceModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 ml-4"
          >
            <DollarSign className="h-5 w-5 inline-block ml-1" />
            עדכון יתרה ידני
          </button>
          <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            ייצא דוח
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <Star className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">סך הכל טעינות</p>
              <p className="text-2xl font-semibold text-gray-900">₪{stats.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Clock className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">טעינה ממוצעת</p>
              <p className="text-2xl font-semibold text-gray-900">₪{stats.averageTopUp.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">סך הכל העברות</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalTopUps}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">משתמשים פעילים</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeUsers}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש לפי משתמש או תיאור..."
            className="w-full pr-10 pl-4 py-2 border rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded-lg px-4 py-2"
        >
          <option value="all">כל סוגי ההעברות</option>
          <option value="top_up">טעינות</option>
          <option value="purchase">רכישות</option>
          <option value="refund">החזרים</option>
          <option value="earning">הכנסות</option>
          <option value="fee">עמלות</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-4 py-2"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="completed">הושלם</option>
          <option value="pending">בהמתנה</option>
          <option value="failed">נכשל</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">העברות אחרונות</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">טוען נתונים...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">משתמש</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סוג</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שיטת תשלום</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תיאור</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="font-medium">{transaction.user_name}</span>
                        </div>
                        <div className="text-xs text-gray-500">{transaction.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getTypeLabel(transaction.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₪{Number(transaction.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.payment_method === 'admin' ? 'עדכון ידני' : 
                         transaction.payment_method === 'paypal' ? 'PayPal' :
                         transaction.payment_method === 'wallet' ? 'ארנק' :
                         transaction.payment_method === 'platform' ? 'פלטפורמה' :
                         transaction.payment_method || 'לא צוין'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(transaction.payment_status)}`}>
                          {getStatusLabel(transaction.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.description || 'אין תיאור'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      לא נמצאו העברות התואמות את החיפוש
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <UserBalanceModal 
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        onSuccess={() => {
          fetchTransactions();
          calculateStats();
        }}
      />
    </div>
  );
}
