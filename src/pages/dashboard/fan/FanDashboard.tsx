import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { WalletWidget } from '../../../components/WalletWidget';
import { FanProfile } from '../../../components/FanProfile';
import { CompletedRequests } from '../../../components/CompletedRequests';
import { AffiliateProgram } from './AffiliateProgram';
import { Clock, CheckCircle, XCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  payment_status: string;
  description: string;
  created_at: string;
}

interface Request {
  id: string;
  creator_id: string;
  request_type: string;
  status: string;
  price: number;
  deadline: string;
  created_at: string;
  video_url?: string;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}

export function FanDashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'requests' | 'affiliate'>('profile');

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (!session || !session.user) {
        navigate('/login');
        return;
      }

      setUserId(session.user.id);
      await Promise.all([
        fetchTransactions(session.user.id),
        fetchRequests(session.user.id)
      ]);
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error('Error checking authentication status');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTransactions(userId: string) {
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error loading transaction history');
    }
  }

  async function fetchRequests(userId: string) {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          creator:creator_profiles!requests_creator_id_fkey(
            name,
            avatar_url
          )
        `)
        .eq('fan_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Error loading requests');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">לוח בקרה למעריץ</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px space-x-8 space-x-reverse">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              פרופיל
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'wallet'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ארנק
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              בקשות וידאו
            </button>
            <button
              onClick={() => setActiveTab('affiliate')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'affiliate'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              תוכנית שותפים
            </button>
          </nav>
        </div>

        {/* Content based on active tab */}
        <div className="mt-6">
          {activeTab === 'profile' && <FanProfile userId={userId} />}
          
          {activeTab === 'wallet' && (
            <>
              <div className="bg-white rounded-lg shadow p-4 mb-4 text-center">
                <p className="text-gray-700">Top up your wallet balance using a credit card.</p>
                <p dir="rtl" className="text-gray-700">הטעין את חשבונך בכסף ולאחר מכן תוכל להשתמש בו לרכישת ברכות.</p>
              </div>

              <WalletWidget
                userId={userId}
                returnUrl={`${window.location.origin}/payment-success`}
              />

              {/* Transaction History */}
              <div className="bg-white rounded-lg shadow mt-8">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">היסטוריית עסקאות</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      אין עסקאות עדיין
                    </div>
                  ) : (
                    transactions.map((transaction) => (
                      <div key={transaction.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-full ${
                              transaction.type === 'top_up' 
                                ? 'bg-green-100 text-green-600'
                                : transaction.type === 'purchase'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-yellow-100 text-yellow-600'
                            }`}>
                              {transaction.type === 'top_up' && <CheckCircle className="h-5 w-5" />}
                              {transaction.type === 'purchase' && <Clock className="h-5 w-5" />}
                              {transaction.type === 'refund' && <XCircle className="h-5 w-5" />}
                            </div>
                            <div className="mr-4">
                              <p className="text-sm font-medium text-gray-900">
                                {transaction.type === 'top_up' ? 'טעינת ארנק' :
                                transaction.type === 'purchase' ? 'רכישת וידאו' : 'החזר כספי'}
                              </p>
                              <p className="text-sm text-gray-500">{transaction.description}</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className={`text-sm font-semibold ${
                              transaction.type === 'purchase' ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {transaction.type === 'purchase' ? '-' : '+'}₪{transaction.amount}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'requests' && <CompletedRequests requests={requests} />}
          
          {activeTab === 'affiliate' && <AffiliateProgram />}
        </div>
      </div>
    </div>
  );
}