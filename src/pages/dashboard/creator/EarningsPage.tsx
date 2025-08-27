import { useEffect, useState } from 'react';
import { useCreatorStore } from '../../../stores/creatorStore';
import { DollarSign, Download, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import { EarningsChart } from '../../../components/EarningsChart';
import { format } from 'date-fns';
import { WithdrawModal } from '../../../components/WithdrawModal';
import { WithdrawalHistory } from '../../../components/WithdrawalHistory';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

// Enhanced withdrawal display component with real-time updates
interface WithdrawalDisplayProps {
  amount: number;
  isLoading: boolean;
  lastUpdated: Date;
  onRefresh: () => void;
}

const WithdrawalDisplay = ({ amount, isLoading, lastUpdated, onRefresh }: WithdrawalDisplayProps) => {
  const [animateAmount, setAnimateAmount] = useState(false);
  
  // Animate amount changes
  useEffect(() => {
    setAnimateAmount(true);
    const timer = setTimeout(() => setAnimateAmount(false), 500);
    return () => clearTimeout(timer);
  }, [amount]);

  const getStatusIndicator = () => {
    if (isLoading) return { icon: '⏳', color: '#f59e0b', text: 'מעדכן...' };
    if (amount > 0) return { icon: '💰', color: '#059669', text: 'זמין למשיכה' };
    return { icon: '📭', color: '#6b7280', text: 'אין סכום זמין' };
  };

  const status = getStatusIndicator();
  
  return (
    <div className="relative bg-gradient-to-r from-white to-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header with status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{status.icon}</span>
          <h3 className="text-sm font-medium text-gray-600">{status.text}</h3>
        </div>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50"
          title="רענן סכום"
        >
          <RefreshCw className={`h-4 w-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {/* Amount display */}
      <div className="flex items-baseline space-x-2">
        <span 
          className={`text-3xl font-bold transition-all duration-500 ${
            animateAmount ? 'scale-110 transform' : ''
          }`}
          style={{ color: status.color }}
        >
          ₪{amount.toFixed(2)}
        </span>
        {amount > 0 && (
          <div className="flex items-center space-x-1 text-xs text-green-600 font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>פעיל</span>
          </div>
        )}
      </div>
      
      {/* Last updated info */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          עודכן לאחרונה: {lastUpdated.toLocaleTimeString('he-IL')}
        </span>
        <div className="flex items-center space-x-1">
          <div className={`w-1.5 h-1.5 rounded-full ${
            Date.now() - lastUpdated.getTime() < 10000 ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span>{Date.now() - lastUpdated.getTime() < 10000 ? 'מעודכן' : 'יש לרענן'}</span>
        </div>
      </div>
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 rounded-xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      )}
    </div>
  );
};

export function EarningsPage() {
  const { earnings, initializeRealtime } = useCreatorStore();
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableForWithdrawal, setAvailableForWithdrawal] = useState(0);
  const [isWithdrawalLoading, setIsWithdrawalLoading] = useState(false);
  const [lastWithdrawalUpdate, setLastWithdrawalUpdate] = useState(new Date());
  const [withdrawalUpdateTrigger, setWithdrawalUpdateTrigger] = useState(0);

  useEffect(() => {
    checkUser();
    initializeRealtime();
  }, [initializeRealtime]);

  // Enhanced real-time withdrawal amount updates
  useEffect(() => {
    console.log('🔄 Withdrawal useEffect triggered:', {
      userId,
      earningsCount: earnings.length,
      currentWithdrawal: availableForWithdrawal,
      trigger: withdrawalUpdateTrigger,
      timestamp: new Date().toISOString()
    });
    
    if (userId) {
      // Always update when earnings change or manual trigger
      const delay = earnings.length > 0 ? 800 : 0; // Longer delay for earnings to ensure DB consistency
      
      const timeoutId = setTimeout(() => {
        console.log('⏰ Fetching withdrawal amount with updated trigger:', withdrawalUpdateTrigger);
        fetchAvailableForWithdrawal(userId, `earnings-auto-${withdrawalUpdateTrigger}`);
      }, delay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [earnings, userId, withdrawalUpdateTrigger]);

  useEffect(() => {
    // Set up real-time subscription for wallet balance updates
    const walletSubscription = supabase
      .channel('wallet_balance_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        }, 
        (payload) => {
          if (payload.new && payload.new.wallet_balance !== undefined && userId) {
            fetchAvailableForWithdrawal(userId, 'wallet-subscription');
          }
        }
      )
      .subscribe();
    
    // Enhanced real-time subscription for withdrawal status changes
    const withdrawalSubscription = supabase
      .channel('withdrawal_status_changes')
      .on('postgres_changes', 
        { 
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'withdrawal_requests',
          filter: `creator_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('🔄 Withdrawal subscription triggered:', payload);
          
          // Force immediate update for critical status changes
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'completed') {
            console.log('✅ Withdrawal approved - forcing immediate update');
            // Reset amount immediately for better UX
            setAvailableForWithdrawal(0);
            setLastWithdrawalUpdate(new Date());
            
            // Then fetch actual amount after short delay
            setTimeout(() => {
              if (userId) {
                fetchAvailableForWithdrawal(userId, 'withdrawal-approved', true);
              }
            }, 1000);
          } else {
            // Regular updates for other changes
            setTimeout(() => {
              if (userId) {
                fetchAvailableForWithdrawal(userId, 'withdrawal-subscription');
              }
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      walletSubscription.unsubscribe();
      withdrawalSubscription.unsubscribe();
    };
  }, [userId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('👤 Setting userId:', user.id);
      setUserId(user.id);
      fetchAvailableForWithdrawal(user.id, 'checkuser');
    } else {
      console.log('🙅 No authenticated user found');
    }
  };



  const fetchAvailableForWithdrawal = async (uid: string, caller: string = 'unknown', showLoading: boolean = false) => {
    try {
      if (showLoading) {
        setIsWithdrawalLoading(true);
      }
      
      console.log(`🌐 [${caller.toUpperCase()}] Making RPC call for user:`, uid, 'Current state:', availableForWithdrawal);
      
      // Use both RPC and direct query for reliability
      const [rpcResult, directResult] = await Promise.allSettled([
        supabase.rpc('get_available_withdrawal_amount', { p_creator_id: uid }),
        supabase
          .from('users')
          .select('wallet_balance')
          .eq('id', uid)
          .single()
          .then(async ({ data: user, error: userError }) => {
            if (userError) throw userError;
            
            const { data: pendingWithdrawals, error: withdrawalError } = await supabase
              .from('withdrawal_requests')
              .select('amount')
              .eq('creator_id', uid)
              .eq('status', 'pending');
              
            if (withdrawalError) throw withdrawalError;
            
            const pendingAmount = pendingWithdrawals?.reduce((sum, w) => sum + w.amount, 0) || 0;
            return Math.max(0, (user?.wallet_balance || 0) - pendingAmount);
          })
      ]);
      
      let newAmount = 0;
      
      // Prefer RPC result, fallback to direct calculation
      if (rpcResult.status === 'fulfilled' && !rpcResult.value.error) {
        newAmount = rpcResult.value.data || 0;
        console.log(`📡 [${caller.toUpperCase()}] Using RPC result:`, newAmount);
      } else if (directResult.status === 'fulfilled') {
        newAmount = directResult.value;
        console.log(`📊 [${caller.toUpperCase()}] Using direct calculation:`, newAmount);
      } else {
        throw new Error('Both RPC and direct query failed');
      }
      
      const oldAmount = availableForWithdrawal;
      setAvailableForWithdrawal(newAmount);
      setLastWithdrawalUpdate(new Date());
      
      // Show notification for significant changes
      if (Math.abs(newAmount - oldAmount) > 0.01) {
        if (newAmount > oldAmount) {
          toast.success(`סכום זמין למשיכה עודכן: ₪${newAmount.toFixed(2)}`, {
            duration: 3000,
            icon: '💰',
          });
        } else if (newAmount === 0 && oldAmount > 0) {
          toast.success('הסכום זמין למשיכה אופס לאחר אישור בקשת המשיכה', {
            duration: 4000,
            icon: '✅',
          });
        }
      }
      
      console.log(`✅ [${caller.toUpperCase()}] Updated withdrawal amount:`, { oldAmount, newAmount, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error(`❌ [${caller.toUpperCase()}] Error in fetchAvailableForWithdrawal:`, error);
      toast.error('שגיאה בטעינת סכום זמין למשיכה - נסה שוב');
    } finally {
      if (showLoading) {
        setIsWithdrawalLoading(false);
      }
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      if (userId) {
        await fetchAvailableForWithdrawal(userId, 'manual-refresh', true);
        // Trigger update counter to force re-calculation
        setWithdrawalUpdateTrigger(prev => prev + 1);
        toast.success('נתונים עודכנו בהצלחה');
      }
    } catch (error) {
      toast.error('שגיאה ברענון הנתונים');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate total earnings (only from completed earnings)
  const totalEarnings = earnings
    .filter(earning => earning.status === 'completed')
    .reduce((sum, earning) => sum + Number(earning.amount.toFixed(2)), 0);
  
  // Calculate pending earnings (not yet completed)
  const pendingEarnings = earnings
    .filter(earning => earning.status === 'pending')
    .reduce((sum, earning) => sum + Number(earning.amount.toFixed(2)), 0);

  const chartData = {
    labels: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני'],
    earnings: [1200, 1900, 1500, 2200, 1800, 2500],
    bookings: [24, 38, 30, 44, 36, 50],
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">הכנסות ותשלומים</h1>
        <button 
          onClick={refreshData}
          className="flex items-center px-4 py-2 text-gray-600 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          רענן נתונים
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">סך הכל הכנסות</p>
              <p className="text-2xl font-semibold text-gray-900">₪{totalEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">הכנסות בהמתנה</p>
              <p className="text-2xl font-semibold text-gray-900">₪{pendingEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div key={`withdrawal-${availableForWithdrawal}-${Date.now()}`} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <WithdrawalDisplay 
                amount={availableForWithdrawal}
                isLoading={isWithdrawalLoading}
                lastUpdated={lastWithdrawalUpdate}
                onRefresh={() => {
                  if (userId) {
                    fetchAvailableForWithdrawal(userId, 'manual-click', true);
                  }
                }}
              />
            </div>
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
              disabled={availableForWithdrawal <= 0}
            >
              משיכת כספים
            </button>
          </div>
        </div>
      </div>

      <WithdrawalHistory 
        creatorId={userId || ''} 
        onNewRequest={() => setIsWithdrawModalOpen(true)} 
      />

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">סקירת הכנסות</h2>
            <div className="flex space-x-4">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="border rounded-lg px-3 py-2 mr-4"
              >
                <option value="weekly">שבועי</option>
                <option value="monthly">חודשי</option>
                <option value="yearly">שנתי</option>
              </select>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as any)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="line">גרף קווי</option>
                <option value="bar">גרף עמודות</option>
              </select>
            </div>
          </div>
          <div className="h-96">
            <EarningsChart
              data={chartData}
              type={chartType}
              title={`הכנסות ${timeframe === 'weekly' ? 'שבועיות' : timeframe === 'monthly' ? 'חודשיות' : 'שנתיות'}`}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">היסטוריית תשלומים</h2>
            <button className="flex items-center text-primary-600 hover:text-primary-700">
              <Download className="h-5 w-5 ml-2" />
              ייצוא
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">בקשה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {earnings.map((earning) => (
                <tr key={earning.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(earning.created_at), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {earning.request_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₪{Number(earning.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${earning.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                      ${earning.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${earning.status === 'refunded' ? 'bg-red-100 text-red-800' : ''}
                    `}>
                      {earning.status === 'completed' ? 'שולם' : 
                       earning.status === 'pending' ? 'בהמתנה' : 
                       earning.status === 'refunded' ? 'הוחזר' : earning.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {userId && (
        <WithdrawModal
          isOpen={isWithdrawModalOpen}
          onClose={() => setIsWithdrawModalOpen(false)}
          creatorId={userId}
          availableBalance={availableForWithdrawal}
          onSuccess={() => {
            // Immediate UI update and data refresh after withdrawal request
            toast.success('בקשת משיכה נשלחה בהצלחה');
            setWithdrawalUpdateTrigger(prev => prev + 1);
            
            // Refresh all data
            setTimeout(() => {
              refreshData();
            }, 500);
          }}
        />
      )}
    </div>
  );
}
