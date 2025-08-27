import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/currency';
import { PayPalButton } from './PayPalButton';

interface WalletWidgetProps {
  userId: string;
}

export function WalletWidget({ userId }: WalletWidgetProps) {
  const [balance, setBalance] = useState(0);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'paypal'>('paypal');

  useEffect(() => {
    fetchBalance();
    setupRealtimeSubscription();
  }, [userId]);

  function setupRealtimeSubscription() {
    const subscription = supabase
      .channel('wallet_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        }, 
        (payload) => {
          if (payload.new.wallet_balance !== undefined) {
            setBalance(payload.new.wallet_balance);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  async function fetchBalance() {
    try {
      console.log('fetchBalance called with userId:', userId);
      console.log('Current user session:', await supabase.auth.getUser());
      
      // Try direct query first as alternative to RPC
      const { data, error } = await supabase
        .from('users')
        .select('wallet_balance')
        .eq('id', userId)
        .single();

      console.log('Direct query response:', { data, error });
      
      if (error) {
        console.error('Direct query error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Fallback to RPC if direct query fails
        console.log('Falling back to RPC call...');
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_user_wallet_balance', {
            user_id: userId
          });
        
        console.log('RPC fallback response:', { data: rpcData, error: rpcError });
        
        if (rpcError) {
          console.error('RPC fallback error details:', {
            message: rpcError.message,
            details: rpcError.details,
            hint: rpcError.hint,
            code: rpcError.code
          });
          throw rpcError;
        }
        
        console.log('Setting balance from RPC fallback:', rpcData || 0);
        setBalance(rpcData || 0);
        return;
      }
      
      const balance = data?.wallet_balance || 0;
      console.log('Setting balance from direct query:', balance);
      setBalance(balance);
    } catch (error) {
      console.error('Error loading wallet balance:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        userId,
        timestamp: new Date().toISOString()
      });
      toast.error('Failed to load wallet balance');
    }
  }

  async function handleManualTopUp(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      setIsProcessing(true);
      const amount = parseFloat(topUpAmount);
      
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      // Create transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: userId,
          type: 'top_up',
          amount,
          payment_method: 'manual',
          description: 'Manual wallet top-up',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Simulate a successful payment (for testing only)
      await simulatePayment(transaction.id);

      toast.success('Top-up successful!');
      setIsTopUpModalOpen(false);
      setTopUpAmount('');
      await fetchBalance();
    } catch (error) {
      console.error('Error processing top-up:', error);
      toast.error('Failed to process top-up');
    } finally {
      setIsProcessing(false);
    }
  }

  async function simulatePayment(transactionId: string) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { error } = await supabase
      .from('wallet_transactions')
      .update({
        payment_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (error) throw error;
  }

  const handlePayPalSuccess = () => {
    toast.success('Payment successful!');
    setIsTopUpModalOpen(false);
    setTopUpAmount('');
    // Add delay to allow database transaction to propagate
    setTimeout(() => {
      fetchBalanceWithRetry();
    }, 1000);
  };

  // Retry mechanism for fetching balance after PayPal payment
  const fetchBalanceWithRetry = async (retryCount = 0) => {
    try {
      console.log(`fetchBalanceWithRetry attempt ${retryCount + 1} with userId:`, userId);
      console.log('Current user session:', await supabase.auth.getUser());
      
      // Try direct query first as alternative to RPC
      const { data, error } = await supabase
        .from('users')
        .select('wallet_balance')
        .eq('id', userId)
        .single();

      console.log('Direct query response (retry):', { data, error, retryCount });
      
      if (error) {
        console.error('Direct query error details (retry):', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          retryCount
        });
        
        // Fallback to RPC if direct query fails
        console.log('Falling back to RPC call (retry)...');
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_user_wallet_balance', {
            user_id: userId
          });
        
        console.log('RPC fallback response (retry):', { data: rpcData, error: rpcError, retryCount });
        
        if (rpcError) {
          console.error('RPC fallback error details (retry):', {
            message: rpcError.message,
            details: rpcError.details,
            hint: rpcError.hint,
            code: rpcError.code,
            retryCount
          });
          throw rpcError;
        }
        
        console.log('Setting balance from RPC fallback (retry):', rpcData || 0);
        setBalance(rpcData || 0);
        return;
      }
      
      const balance = data?.wallet_balance || 0;
      console.log('Setting balance from direct query (retry):', balance);
      setBalance(balance);
    } catch (error) {
      console.error('Error loading wallet balance (retry):', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        userId,
        retryCount,
        timestamp: new Date().toISOString()
      });
      
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Retrying in ${delay}ms...`);
        setTimeout(() => {
          fetchBalanceWithRetry(retryCount + 1);
        }, delay);
      } else {
        // Only show error after all retries failed
        console.error('All retries failed for wallet balance fetch');
        toast.error('Failed to load wallet balance. Please refresh the page.');
      }
    }
  };

  const handlePayPalError = (error: any) => {
    console.error('PayPal payment error:', {
      error,
      message: error.message,
      timestamp: new Date().toISOString(),
      userId,
      amount: topUpAmount
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Payment failed. Please try again.';
    
    if (error.message) {
      if (error.message.includes('wallet balance')) {
        errorMessage = 'Payment processed but failed to update wallet. Please contact support.';
      } else if (error.message.includes('PayPal')) {
        errorMessage = 'PayPal service error. Please try again later.';
      } else if (error.message.includes('credentials')) {
        errorMessage = 'Payment service configuration error. Please contact support.';
      } else {
        errorMessage = error.message;
      }
    }
    
    toast.error(errorMessage);
    
    // Keep the modal open so the user can try again
    // Don't clear the amount so user can retry with same amount
  };

  const handlePayPalCancel = () => {
    toast.error('Payment was cancelled');
    setTopUpAmount('');
  };

  return (
    <div className="relative">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-primary-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">Available Balance</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(balance)}</p>
            </div>
          </div>
          <button
            onClick={() => setIsTopUpModalOpen(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-5 w-5 ml-2" />
            Top Up Wallet
          </button>
        </div>
      </div>

      {isTopUpModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Top Up Wallet</h3>
              <button
                onClick={() => setIsTopUpModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₪</span>
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="pr-7 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="0"
                  required
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="payment-method"
                    value="paypal"
                    checked={paymentMethod === 'paypal'}
                    onChange={() => setPaymentMethod('paypal')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 ml-2"
                  />
                  <div className="flex items-center">
                    <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" alt="PayPal" className="h-6 ml-2" />
                    <span className="font-medium">PayPal</span>
                  </div>
                </label>

                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="payment-method"
                    value="manual"
                    checked={paymentMethod === 'manual'}
                    onChange={() => setPaymentMethod('manual')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 ml-2"
                  />
                  <div className="flex items-center">
                    <CreditCard className="h-6 w-6 text-primary-600 ml-2" />
                    <span className="font-medium">Manual Payment (Demo)</span>
                  </div>
                </label>
              </div>
            </div>

            {paymentMethod === 'paypal' ? (
              <PayPalButton
                amount={parseFloat(topUpAmount) || 0}
                onSuccess={handlePayPalSuccess}
                onError={handlePayPalError}
                onCancel={handlePayPalCancel}
                disabled={!topUpAmount || parseFloat(topUpAmount) <= 0}
              />
            ) : (
              <div className="flex justify-end space-x-4">
                <button
                  onClick={handleManualTopUp}
                  disabled={isProcessing || !topUpAmount || parseFloat(topUpAmount) <= 0}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                >
                  {isProcessing ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    'Confirm Payment'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
