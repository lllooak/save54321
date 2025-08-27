import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string;
  availableBalance: number;
  onSuccess: () => void;
}

export function WithdrawModal({ isOpen, onClose, creatorId, availableBalance, onSuccess }: WithdrawModalProps) {
  const [paypalEmail, setPaypalEmail] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'paypal' | 'bank'>('paypal');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState(50); // Default minimum
  const [savedPaypalEmail, setSavedPaypalEmail] = useState('');
  const [savedBankDetails, setSavedBankDetails] = useState('');
  const [saveDetails, setSaveDetails] = useState(false);
  const [availableForWithdrawal, setAvailableForWithdrawal] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchMinWithdrawAmount();
      fetchSavedWithdrawalDetails();
      fetchAvailableForWithdrawal();
    }
  }, [isOpen, creatorId]);

  const fetchMinWithdrawAmount = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'min_withdraw_amount')
        .single();

      if (error) {
        console.error('Error fetching minimum withdrawal amount:', error);
        return;
      }

      if (data?.value) {
        setMinWithdrawAmount(Number(data.value));
      }
    } catch (error) {
      console.error('Error fetching minimum withdrawal amount:', error);
    }
  };

  const fetchSavedWithdrawalDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('creator_profiles')
        .select('metadata')
        .eq('id', creatorId)
        .single();

      if (error) {
        console.error('Error fetching saved withdrawal details:', error);
        return;
      }

      if (data?.metadata?.withdrawal_details) {
        const details = data.metadata.withdrawal_details;
        setSavedPaypalEmail(details.paypal_email || '');
        setSavedBankDetails(details.bank_details || '');
        
        // Pre-fill the form with saved details
        if (details.paypal_email) {
          setPaypalEmail(details.paypal_email);
        }
        if (details.bank_details) {
          setBankDetails(details.bank_details);
        }
      }
    } catch (error) {
      console.error('Error fetching saved withdrawal details:', error);
    }
  };

  const fetchAvailableForWithdrawal = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_available_withdrawal_amount', {
          p_creator_id: creatorId
        });

      if (error) throw error;
      setAvailableForWithdrawal(data || 0);
    } catch (error) {
      console.error('Error fetching available withdrawal amount:', error);
      toast.error('שגיאה בטעינת סכום זמין למשיכה');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const withdrawAmount = parseFloat(amount);
    
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error('אנא הזן סכום תקין');
      return;
    }
    
    if (withdrawAmount > availableForWithdrawal) {
      toast.error('אין מספיק יתרה זמינה למשיכה');
      return;
    }
    
    if (withdrawAmount < minWithdrawAmount) {
      toast.error(`סכום המשיכה המינימלי הוא ₪${minWithdrawAmount}`);
      return;
    }
    
    if (withdrawMethod === 'paypal' && !paypalEmail) {
      toast.error('אנא הזן כתובת אימייל PayPal');
      return;
    }
    
    if (withdrawMethod === 'bank' && !bankDetails) {
      toast.error('אנא הזן פרטי בנק');
      return;
    }
    
    setLoading(true);
    
    try {
      // Save withdrawal details if requested
      if (saveDetails) {
        const { error: updateError } = await supabase
          .from('creator_profiles')
          .update({
            metadata: {
              withdrawal_details: {
                paypal_email: paypalEmail,
                bank_details: bankDetails
              }
            }
          })
          .eq('id', creatorId);
          
        if (updateError) {
          throw updateError;
        }
      }
      
      // Create withdrawal request
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .insert({
          creator_id: creatorId,
          amount: withdrawAmount,
          method: withdrawMethod,
          paypal_email: withdrawMethod === 'paypal' ? paypalEmail : null,
          bank_details: withdrawMethod === 'bank' ? bankDetails : null,
          status: 'pending'
        })
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      toast.success('בקשת המשיכה נשלחה בהצלחה');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error submitting withdrawal request:', error);
      toast.error('שגיאה בשליחת בקשת המשיכה');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full" dir="rtl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">בקשת משיכת כספים</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {availableForWithdrawal < minWithdrawAmount ? (
          <div className="bg-yellow-50 p-4 rounded-md mb-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 ml-2" />
            <div>
              <p className="text-yellow-700 font-medium">לא ניתן למשוך כספים כרגע</p>
              <p className="text-yellow-600 text-sm">
                סכום המשיכה המינימלי הוא ₪{minWithdrawAmount}. היתרה הזמינה למשיכה היא ₪{availableForWithdrawal.toFixed(2)}.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סכום המשיכה (₪)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₪</span>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={minWithdrawAmount}
                  max={availableForWithdrawal}
                  step="0.01"
                  className="pr-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                יתרה זמינה למשיכה: ₪{availableForWithdrawal.toFixed(2)} | מינימום למשיכה: ₪{minWithdrawAmount}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שיטת משיכה
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setWithdrawMethod('paypal')}
                  className={`flex items-center justify-center p-3 rounded-md border ${
                    withdrawMethod === 'paypal'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <DollarSign className="h-5 w-5 ml-2" />
                  <span>PayPal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawMethod('bank')}
                  className={`flex items-center justify-center p-3 rounded-md border ${
                    withdrawMethod === 'bank'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="h-5 w-5 ml-2" />
                  <span>העברה בנקאית</span>
                </button>
              </div>
            </div>

            {withdrawMethod === 'paypal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  אימייל PayPal
                </label>
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="your-email@example.com"
                  required
                />
                {savedPaypalEmail && (
                  <p className="mt-1 text-xs text-gray-500">
                    אימייל שמור: {savedPaypalEmail}
                  </p>
                )}
              </div>
            )}

            {withdrawMethod === 'bank' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  פרטי בנק
                </label>
                <textarea
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="שם בנק, מספר סניף, מספר חשבון, שם בעל החשבון"
                  required
                />
                {savedBankDetails && (
                  <p className="mt-1 text-xs text-gray-500">
                    פרטי בנק שמורים: {savedBankDetails}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center">
              <input
                id="save-details"
                type="checkbox"
                checked={saveDetails}
                onChange={(e) => setSaveDetails(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ml-2"
              />
              <label htmlFor="save-details" className="text-sm text-gray-700">
                שמור פרטים למשיכות עתידיות
              </label>
            </div>

            <div className="flex justify-end space-x-3 space-x-reverse">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 ml-3"
                disabled={loading}
              >
                ביטול
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                disabled={loading || availableForWithdrawal < minWithdrawAmount}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    מעבד...
                  </span>
                ) : (
                  'שלח בקשת משיכה'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
