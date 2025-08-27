import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Link, Share2, Copy, DollarSign, Users, TrendingUp, RefreshCw, ChevronUp, ChevronDown, X, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../utils/currency';
import { getTierThresholds, getCommissionRate } from '../../../utils/affiliate';

export function AffiliateProgram() {
  const [user, setUser] = useState<any>(null);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [affiliateStats, setAffiliateStats] = useState({
    visits: 0,
    signups: 0,
    conversions: 0,
    earnings: 0,
    pendingEarnings: 0,
    tier: 'bronze'
  });
  const [referralLink, setReferralLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningAsAffiliate, setJoiningAsAffiliate] = useState(false);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [showCommissionsSection, setShowCommissionsSection] = useState(true);
  const [showPayoutsSection, setShowPayoutsSection] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tierThresholds, setTierThresholds] = useState(getTierThresholds());
  const [showSharingTips, setShowSharingTips] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paymentDetails, setPaymentDetails] = useState({ email: '', bankAccount: '', bankName: '', accountHolder: '' });
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setUser(user);

      // Check if user is already an affiliate
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_affiliate, affiliate_code, affiliate_tier, affiliate_earnings')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        toast.error('שגיאה בטעינת נתוני משתמש');
      } else if (userData) {
        setIsAffiliate(userData.is_affiliate || false);
        setAffiliateCode(userData.affiliate_code || '');
        
        if (userData.is_affiliate && userData.affiliate_code) {
          setReferralLink(`${window.location.origin}/?ref=${userData.affiliate_code}`);
          await fetchAffiliateStats(user.id, userData.affiliate_code);
          await fetchCommissions(user.id);
          await fetchPaymentHistory(user.id);
          await fetchPaymentMethod(user.id);
          
          // Set up realtime subscriptions
          setupRealtimeSubscriptions(user.id);
        }
      }

      // Fetch tier thresholds from platform_config
      await fetchTierThresholds();
      
      // Load payment details if user is an affiliate
      if (isAffiliate) {
        await fetchPaymentDetails();
      }
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error('שגיאה בבדיקת משתמש');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTierThresholds() {
    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'affiliate_tiers')
        .maybeSingle();

      if (error) {
        console.error('Error fetching tier thresholds:', error);
        return;
      }

      if (data?.value?.tiers) {
        setTierThresholds(data.value.tiers);
      } else {
        console.log('Using default tier thresholds');
      }
    } catch (error) {
      console.error('Error fetching tier thresholds:', error);
    }
  }

  async function fetchAffiliateStats(userId: string, code: string) {
    try {
      // First, get visit counts
      const { data: visitData, error: visitError } = await supabase
        .from('affiliate_tracking')
        .select('event_type')
        .eq('affiliate_id', userId)
        .eq('event_type', 'visit');

      if (visitError) throw visitError;

      // Get signup counts
      const { data: signupData, error: signupError } = await supabase
        .from('affiliate_tracking')
        .select('event_type')
        .eq('affiliate_id', userId)
        .eq('event_type', 'signup');

      if (signupError) throw signupError;

      // Get booking counts
      const { data: bookingData, error: bookingError } = await supabase
        .from('affiliate_tracking')
        .select('event_type')
        .eq('affiliate_id', userId)
        .eq('event_type', 'booking');

      if (bookingError) throw bookingError;

      // Count events
      const visits = visitData?.length || 0;
      const signups = signupData?.length || 0;
      const bookings = bookingData?.length || 0;

      // Fetch commission data
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('affiliate_commissions')
        .select('amount, status')
        .eq('affiliate_id', userId);

      if (commissionsError) throw commissionsError;

      // Process commission data
      const confirmedEarnings = commissionsData
        ?.filter(item => item.status === 'confirmed' || item.status === 'paid')
        .reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      
      const pendingEarnings = commissionsData
        ?.filter(item => item.status === 'pending')
        .reduce((sum, item) => sum + Number(item.amount), 0) || 0;

      // Get user's current tier
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('affiliate_tier')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      setAffiliateStats({
        visits: Number(visits),
        signups: Number(signups),
        conversions: Number(bookings),
        earnings: confirmedEarnings,
        pendingEarnings,
        tier: userData?.affiliate_tier || 'bronze'
      });
    } catch (error) {
      console.error('Error fetching affiliate stats:', error);
      toast.error('שגיאה בטעינת נתוני שותף');
    }
  }

  function setupRealtimeSubscriptions(userId: string) {
    // Subscribe to affiliate tracking changes
    const trackingSubscription = supabase
      .channel('affiliate_tracking_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT',
          schema: 'public',
          table: 'affiliate_tracking',
          filter: `affiliate_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('New tracking event:', payload);
          // Update stats when new tracking events occur
          fetchAffiliateStats(userId, affiliateCode);
        }
      )
      .subscribe();

    // Subscribe to commission changes
    const commissionsSubscription = supabase
      .channel('affiliate_commissions_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'affiliate_commissions',
          filter: `affiliate_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('Commission change:', payload);
          // Refresh commissions and stats
          fetchCommissions(userId);
          fetchAffiliateStats(userId, affiliateCode);
        }
      )
      .subscribe();

    // Subscribe to payout changes
    const payoutsSubscription = supabase
      .channel('affiliate_payouts_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'affiliate_payouts',
          filter: `affiliate_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('Payout change:', payload);
          // Refresh payouts
          fetchPaymentHistory(userId);
        }
      )
      .subscribe();

    // Subscribe to user changes (for tier updates)
    const userSubscription = supabase
      .channel('user_affiliate_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        }, 
        (payload) => {
          console.log('User update:', payload);
          // Update affiliate tier and earnings
          if (payload.new) {
            setAffiliateStats(prev => ({
              ...prev,
              tier: payload.new.affiliate_tier || prev.tier,
              earnings: payload.new.affiliate_earnings || prev.earnings
            }));
          }
        }
      )
      .subscribe();

    // Return cleanup function
    return () => {
      trackingSubscription.unsubscribe();
      commissionsSubscription.unsubscribe();
      payoutsSubscription.unsubscribe();
      userSubscription.unsubscribe();
    };
  }

  async function fetchCommissions(userId: string) {
    try {
      // Fetch commissions with related data
      const { data, error } = await supabase
        .from('affiliate_commissions')
        .select(`
          *,
          request:request_id(request_type)
        `)
        .eq('affiliate_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For each commission, fetch the referred user's details
      const commissionsWithUserDetails = await Promise.all(
        (data || []).map(async (commission) => {
          if (!commission.referred_user_id) return commission;

          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', commission.referred_user_id)
            .single();

          if (userError) {
            console.error('Error fetching user data:', userError);
            return {
              ...commission,
              referred_user: { name: 'Unknown', email: 'Unknown' }
            };
          }

          return {
            ...commission,
            referred_user: userData
          };
        })
      );

      setCommissions(commissionsWithUserDetails);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      toast.error('שגיאה בטעינת עמלות');
    }
  }

  async function fetchPaymentHistory(userId: string) {
    try {
      const { data, error } = await supabase
        .from('affiliate_payouts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('שגיאה בטעינת היסטוריית תשלומים');
    }
  }

  async function fetchPaymentMethod(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('payment_method, payment_details')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data?.payment_method) {
        setPaymentMethod(data.payment_method);
      }
      if (data?.payment_details) {
        setPaymentDetails(data.payment_details);
      }
    } catch (error) {
      console.error('Error fetching payment method:', error);
    }
  }

  async function fetchPaymentDetails() {
    if (!user) return;
    
    try {
      // Get payment info from database columns
      const { data: userData, error } = await supabase
        .from('users')
        .select('payment_method, payment_details')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching payment details:', error);
        return;
      }
      
      if (userData?.payment_method && userData?.payment_details) {
        setPaymentMethod(userData.payment_method);
        setPaymentDetails(userData.payment_details);
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
    }
  }

  async function savePaymentMethod() {
    if (!user) return;
    
    setSavingPaymentMethod(true);
    try {
      const details = paymentMethod === 'paypal' 
        ? { email: paymentDetails.email }
        : { 
            bankAccount: paymentDetails.bankAccount,
            bankName: paymentDetails.bankName,
            accountHolder: paymentDetails.accountHolder
          };

      // Save to database columns
      const { error } = await supabase
        .from('users')
        .update({
          payment_method: paymentMethod,
          payment_details: details
        })
        .eq('id', user.id);

      if (error) {
        console.error('Database save error:', error);
        toast.error('שגיאה בשמירת פרטי התשלום');
        return;
      }

      toast.success('פרטי התשלום נשמרו בהצלחה');
      setShowPaymentMethodModal(false);
    } catch (error) {
      console.error('Error saving payment method:', error);
      toast.error('שגיאה בשמירת פרטי התשלום');
    } finally {
      setSavingPaymentMethod(false);
    }
  }

  async function joinAffiliateProgram() {
    if (!user) {
      toast.error('עליך להתחבר כדי להצטרף לתוכנית השותפים');
      return;
    }

    setJoiningAsAffiliate(true);
    try {
      // Generate a unique affiliate code
      const code = generateAffiliateCode(user.email);
      
      // Update user record
      const { error: userError } = await supabase
        .from('users')
        .update({
          is_affiliate: true,
          affiliate_code: code,
          affiliate_tier: 'bronze',
          affiliate_joined_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (userError) throw userError;

      // Create affiliate link record
      const { error: linkError } = await supabase
        .from('affiliate_links')
        .insert({
          user_id: user.id,
          code: code,
          landing_page: '/'
        });

      if (linkError) throw linkError;

      setIsAffiliate(true);
      setAffiliateCode(code);
      setReferralLink(`${window.location.origin}/?ref=${code}`);
      toast.success('הצטרפת בהצלחה לתוכנית השותפים!');
      
      // Refresh affiliate data
      await fetchAffiliateStats(user.id, code);
      
      // Set up realtime subscriptions
      setupRealtimeSubscriptions(user.id);
    } catch (error) {
      console.error('Error joining affiliate program:', error);
      toast.error('שגיאה בהצטרפות לתוכנית השותפים');
    } finally {
      setJoiningAsAffiliate(false);
    }
  }

  function generateAffiliateCode(email: string) {
    // Generate a code based on email and random string
    const username = email.split('@')[0];
    const randomStr = Math.random().toString(36).substring(2, 6);
    return `${username}-${randomStr}`;
  }

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('הקישור הועתק ללוח');
    } catch (err) {
      toast.error('שגיאה בהעתקת הקישור');
    }
  };

  const refreshData = async () => {
    if (!user || !isAffiliate || !affiliateCode) return;
    
    setRefreshing(true);
    try {
      await Promise.all([
        fetchAffiliateStats(user.id, affiliateCode),
        fetchCommissions(user.id),
        fetchPaymentHistory(user.id)
      ]);
      toast.success('הנתונים עודכנו בהצלחה');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('שגיאה בעדכון הנתונים');
    } finally {
      setRefreshing(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-amber-100 text-amber-800';
      case 'silver': return 'bg-gray-100 text-gray-800';
      case 'gold': return 'bg-yellow-100 text-yellow-800';
      case 'platinum': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCommissionTypeLabel = (type: string) => {
    switch (type) {
      case 'signup': return 'הרשמה';
      case 'booking': return 'הזמנה';
      case 'recurring': return 'מתמשך';
      default: return type;
    }
  };

  const getPayoutMethodLabel = (method: string) => {
    switch (method) {
      case 'paypal': return 'PayPal';
      case 'bank_transfer': return 'העברה בנקאית';
      case 'wallet_credit': return 'זיכוי ארנק';
      default: return method;
    }
  };

  // Get commission rate for current tier
  const getCurrentCommissionRate = () => {
    return getCommissionRate(affiliateStats.tier) * 100;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">עליך להתחבר כדי לגשת לתוכנית השותפים</h2>
        <p className="text-gray-600 mb-6">אנא התחבר או הירשם כדי להצטרף לתוכנית השותפים שלנו.</p>
        <div className="flex justify-center space-x-4">
          <Link to="/login" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            התחבר
          </Link>
          <Link to="/signup/fan" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            הירשם
          </Link>
        </div>
      </div>
    );
  }

  if (!isAffiliate) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">הצטרף לתוכנית השותפים שלנו</h2>
        <p className="text-gray-600 mb-6">
          הפנה חברים לאתר שלנו וקבל עמלות על כל הזמנה שהם מבצעים! תוכנית השותפים שלנו מציעה:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg">
            <div className="text-3xl text-primary-600 mb-2">10%</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">עמלת הזמנה</h3>
            <p className="text-sm text-gray-600">מכל הזמנה שהמופנים שלך מבצעים</p>
          </div>

          <div className="bg-white p-6 rounded-lg">
            <div className="text-3xl text-primary-600 mb-2">30</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">ימי מעקב</h3>
            <p className="text-sm text-gray-600">אנו עוקבים אחר המופנים שלך למשך 30 יום</p>
          </div>

          <div className="bg-white p-6 rounded-lg">
            <div className="text-3xl text-primary-600 mb-2">4</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">דרגות שותפים</h3>
            <p className="text-sm text-gray-600">עם הטבות גדלות ככל שאתה מפנה יותר</p>
          </div>
        </div>
        
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">דרגות שותפים והטבות</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-right">דרגה</th>
                  <th className="py-2 text-right">הכנסות נדרשות</th>
                  <th className="py-2 text-right">עמלת הזמנה</th>
                  <th className="py-2 text-right">הטבות נוספות</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">ברונזה</span>
                  </td>
                  <td className="py-3">₪0 - ₪{tierThresholds.silver - 1}</td>
                  <td className="py-3">{getCommissionRate('bronze') * 100}%</td>
                  <td className="py-3">גישה לחומרי שיווק</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">כסף</span>
                  </td>
                  <td className="py-3">₪{tierThresholds.silver} - ₪{tierThresholds.gold - 1}</td>
                  <td className="py-3">{getCommissionRate('silver') * 100}%</td>
                  <td className="py-3">+ תשלום מהיר</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">זהב</span>
                  </td>
                  <td className="py-3">₪{tierThresholds.gold} - ₪{tierThresholds.platinum - 1}</td>
                  <td className="py-3">{getCommissionRate('gold') * 100}%</td>
                  <td className="py-3">+ תמיכה אישית</td>
                </tr>
                <tr>
                  <td className="py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">פלטינום</span>
                  </td>
                  <td className="py-3">₪{tierThresholds.platinum}+</td>
                  <td className="py-3">{getCommissionRate('platinum') * 100}%</td>
                  <td className="py-3">+ הטבות VIP</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <button
          onClick={joinAffiliateProgram}
          disabled={joiningAsAffiliate}
          className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {joiningAsAffiliate ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              מצטרף לתוכנית...
            </span>
          ) : (
            'הצטרף לתוכנית השותפים'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">תוכנית השותפים</h1>
        <button 
          onClick={refreshData}
          className="flex items-center px-4 py-2 text-gray-600 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
          רענן נתונים
        </button>
      </div>

      {/* Referral Link Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">קישור ההפניה שלך</h2>
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-grow relative">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="w-full pr-4 pl-10 py-2 border rounded-lg bg-gray-50"
            />
            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <button
            onClick={copyReferralLink}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Copy className="h-4 w-4 ml-2" />
            העתק קישור
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'הצטרף ל-MyStar דרך הקישור שלי',
                  text: 'הצטרף ל-MyStar והזמן סרטוני ברכה מותאמים אישית מהכוכבים האהובים עליך!',
                  url: referralLink
                });
              } else {
                copyReferralLink();
              }
            }}
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4 ml-2" />
            שתף
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          קוד הפנייה: <span className="font-medium">{affiliateCode}</span>
        </p>
        
        <div className="mt-4">
          <button 
            onClick={() => setShowSharingTips(!showSharingTips)}
            className="text-primary-600 text-sm flex items-center"
          >
            {showSharingTips ? "הסתר טיפים לשיתוף" : "הצג טיפים לשיתוף"}
            {showSharingTips ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          </button>
          
          {showSharingTips && (
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">טיפים לשיתוף יעיל</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">פייסבוק</h4>
                  <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                    <p>גיליתי אתר מדהים! MyStar מאפשר לך להזמין סרטוני ברכה אישיים מהיוצרים האהובים עליך. הזמנתי כבר כמה וזה היה מושלם! 🤩 הצטרפו עכשיו דרך הקישור שלי: {referralLink}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">אינסטגרם</h4>
                  <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                    <p>רוצים להפתיע מישהו מיוחד? 🎁 קבלו סרטון ברכה אישי מהיוצרים האהובים עליכם ב-MyStar! הקישור בביו שלי או כאן: {referralLink} #מתנהמושלמת #הפתעה</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">וואטסאפ</h4>
                  <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                    <p>היי! חייב/ת לספר לך על MyStar - אתר שמאפשר לך לקבל סרטוני ברכה אישיים מיוצרים ואמנים מובילים! מעולה למתנות יום הולדת, אירועים מיוחדים או סתם להפתיע מישהו 😊 הנה הקישור שלי: {referralLink}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">אימייל</h4>
                  <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                    <p>שלום,<br/><br/>רציתי לשתף איתך שירות מדהים שגיליתי לאחרונה - MyStar.<br/><br/>האתר מאפשר לך להזמין סרטוני ברכה מותאמים אישית מיוצרים, אמנים וסלבריטאים לכל אירוע מיוחד. זו מתנה ייחודית ובלתי נשכחת!<br/><br/>אם מעניין אותך, הנה קישור הפנייה שלי: {referralLink}<br/><br/>בברכה,<br/>[שמך]</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">מופנים</p>
              <p className="text-2xl font-semibold text-gray-900">{affiliateStats.signups}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">המרות</p>
              <p className="text-2xl font-semibold text-gray-900">{affiliateStats.conversions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">סה"כ הכנסות</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(affiliateStats.earnings)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">דרגת שותף</p>
              <div className="flex items-center">
                <p className="text-2xl font-semibold text-gray-900 ml-2">{affiliateStats.tier}</p>
                <span className={`px-2 py-1 text-xs rounded-full ${getTierColor(affiliateStats.tier)}`}>
                  {affiliateStats.tier}
                </span>
              </div>
              <p className="text-sm text-primary-600 font-medium">
                {getCurrentCommissionRate()}% עמלה
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress to Next Tier */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">התקדמות לדרגה הבאה</h2>
        
        {affiliateStats.tier !== 'platinum' ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {affiliateStats.tier === 'bronze' ? 'ברונזה → כסף' : affiliateStats.tier === 'silver' ? 'כסף → זהב' : 'זהב → פלטינום'}
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {formatCurrency(affiliateStats.earnings)} / 
                  {affiliateStats.tier === 'bronze' ? formatCurrency(tierThresholds.silver) : 
                   affiliateStats.tier === 'silver' ? formatCurrency(tierThresholds.gold) : 
                   formatCurrency(tierThresholds.platinum)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${
                    affiliateStats.tier === 'bronze' ? 'bg-gray-500' : 
                    affiliateStats.tier === 'silver' ? 'bg-yellow-500' : 
                    'bg-blue-500'
                  }`} 
                  style={{ 
                    width: `${Math.min(100, 
                      affiliateStats.tier === 'bronze' ? 
                        (affiliateStats.earnings / tierThresholds.silver) * 100 : 
                      affiliateStats.tier === 'silver' ? 
                        ((affiliateStats.earnings - tierThresholds.silver) / (tierThresholds.gold - tierThresholds.silver)) * 100 : 
                        ((affiliateStats.earnings - tierThresholds.gold) / (tierThresholds.platinum - tierThresholds.gold)) * 100
                    )}%` 
                  }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {affiliateStats.tier === 'bronze' ? 
                  `נדרש עוד ${formatCurrency(tierThresholds.silver - affiliateStats.earnings)} כדי להגיע לדרגת כסף (${getCommissionRate('silver') * 100}% עמלה)` : 
                 affiliateStats.tier === 'silver' ? 
                  `נדרש עוד ${formatCurrency(tierThresholds.gold - affiliateStats.earnings)} כדי להגיע לדרגת זהב (${getCommissionRate('gold') * 100}% עמלה)` : 
                  `נדרש עוד ${formatCurrency(tierThresholds.platinum - affiliateStats.earnings)} כדי להגיע לדרגת פלטינום (${getCommissionRate('platinum') * 100}% עמלה)`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-800 font-medium">ברכות! הגעת לדרגה הגבוהה ביותר - פלטינום</p>
            <p className="text-blue-600">אתה מקבל עמלה של {getCommissionRate('platinum') * 100}% על כל הזמנה!</p>
          </div>
        )}
      </div>

      {/* Payment Method Setup Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">הגדרות תשלום</h2>
          <button
            onClick={() => setShowPaymentMethodModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
          >
            עדכן פרטי תשלום
          </button>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <span className="text-sm font-medium text-gray-700">שיטת תשלום נוכחית:</span>
            <span className="mr-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              {paymentMethod === 'paypal' ? 'PayPal' : 'העברה בנקאית'}
            </span>
          </div>
          
          {paymentMethod === 'paypal' && paymentDetails.email && (
            <p className="text-sm text-gray-600">
              <strong>כתובת אימייל:</strong> {paymentDetails.email}
            </p>
          )}
          
          {paymentMethod === 'bank_transfer' && paymentDetails.bankAccount && (
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>מספר חשבון:</strong> ****{paymentDetails.bankAccount.slice(-4)}</p>
              <p><strong>שם הבנק:</strong> {paymentDetails.bankName}</p>
              <p><strong>שם בעל החשבון:</strong> {paymentDetails.accountHolder}</p>
            </div>
          )}
          
          {(!paymentDetails.email && paymentMethod === 'paypal') || 
           (!paymentDetails.bankAccount && paymentMethod === 'bank_transfer') ? (
            <p className="text-sm text-amber-600">
              יש להגדיר פרטי תשלום כדי לקבל תשלומים
            </p>
          ) : null}
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <History className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">היסטוריית תשלומים</h2>
          </div>
          <button 
            onClick={() => setShowPaymentHistory(!showPaymentHistory)}
            className="text-gray-500 hover:text-gray-700"
          >
            {showPaymentHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        
        {showPaymentHistory && (
          <div className="p-6">
            {paymentHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">עדיין לא התקבלו תשלומים</p>
                <p className="text-sm text-gray-400 mt-1">התשלומים יופיעו כאן לאחר שהמנהל יאשר אותם</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ שולם
                          </span>
                          <span className="mr-3 text-sm text-gray-500">
                            {new Date(payment.created_at).toLocaleDateString('he-IL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p><strong>שיטת תשלום:</strong> {payment.payout_method === 'paypal' ? 'PayPal' : 'העברה בנקאית'}</p>
                          {payment.payout_details && (
                            <p className="mt-1">
                              <strong>פרטים:</strong> 
                              {payment.payout_method === 'paypal' && payment.payout_details.email ? 
                                ` ${payment.payout_details.email}` : 
                                payment.payout_method === 'bank_transfer' && payment.payout_details.bankAccount ? 
                                  ` ****${payment.payout_details.bankAccount.slice(-4)}` : 
                                  ' לא זמין'
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          סכום ששולם
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commissions Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">עמלות</h2>
          </div>
          <button 
            onClick={() => setShowCommissionsSection(!showCommissionsSection)}
            className="text-gray-500 hover:text-gray-700"
          >
            {showCommissionsSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        
        {showCommissionsSection && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סוג</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מופנה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {commissions.length > 0 ? (
                  commissions.map((commission) => (
                    <tr key={commission.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(commission.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getCommissionTypeLabel(commission.commission_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {commission.referred_user?.name || commission.referred_user?.email || 'לא ידוע'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(commission.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(commission.status)}`}>
                          {commission.status === 'pending' ? 'ממתין' : 
                           commission.status === 'confirmed' ? 'מאושר' : 
                           commission.status === 'paid' ? 'שולם' : 
                           commission.status === 'cancelled' ? 'בוטל' : commission.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      אין עמלות עדיין
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">תשלומים</h2>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => {/* Open payout request modal */}}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 ml-4"
              disabled={affiliateStats.earnings <= 0}
            >
              בקש תשלום
            </button>
            <button 
              onClick={() => setShowPayoutsSection(!showPayoutsSection)}
              className="text-gray-500 hover:text-gray-700"
            >
              {showPayoutsSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {showPayoutsSection && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שיטה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payouts.length > 0 ? (
                  payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payout.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(payout.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getPayoutMethodLabel(payout.payout_method)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payout.status)}`}>
                          {payout.status === 'pending' ? 'ממתין' : 
                           payout.status === 'processing' ? 'בעיבוד' : 
                           payout.status === 'completed' ? 'הושלם' : 
                           payout.status === 'failed' ? 'נכשל' : payout.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      אין תשלומים עדיין
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sharing Tips Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">טיפים לשיתוף יעיל</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">איך להגדיל את ההמרות שלך</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>שתף את הקישור שלך עם חברים שמתעניינים בתוכן מותאם אישית</li>
              <li>הסבר את הערך הייחודי של סרטוני ברכה מותאמים אישית</li>
              <li>הדגש את האיכות והאותנטיות של היוצרים בפלטפורמה</li>
              <li>שתף חוויות אישיות אם הזמנת בעצמך סרטונים מהפלטפורמה</li>
              <li>כוון את השיתופים שלך לקראת אירועים מיוחדים כמו ימי הולדת, חתונות וחגים</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">פלטפורמות מומלצות לשיתוף</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li><strong>קבוצות וואטסאפ</strong> - שתף עם משפחה וחברים קרובים</li>
              <li><strong>פייסבוק</strong> - מתאים לשיתוף בקבוצות עניין ובפרופיל האישי</li>
              <li><strong>אינסטגרם</strong> - שתף בסטורי עם קישור "החלק למעלה"</li>
              <li><strong>טוויטר/X</strong> - שיתופים קצרים וממוקדים</li>
              <li><strong>אימייל</strong> - לשיתוף אישי יותר עם אנשי קשר מקצועיים</li>
              <li><strong>בלוג אישי</strong> - אם יש לך, שלב את הקישור בתוכן רלוונטי</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">זמנים אופטימליים לשיתוף</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>לפני אירועים מיוחדים וחגים</li>
              <li>בתחילת החודש כשאנשים מקבלים משכורת</li>
              <li>בסופי שבוע כשאנשים גולשים יותר ברשתות חברתיות</li>
              <li>אחרי שיוצר פופולרי מצטרף לפלטפורמה</li>
            </ul>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">שאלות נפוצות</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-1">איך מחושבות העמלות?</h3>
            <p className="text-gray-600">
              אתה מקבל עמלה מכל הזמנה שמבוצעת על ידי מופנים שלך. העמלה תלויה בדרגת השותף שלך:
            </p>
            <ul className="list-disc list-inside mt-2 text-gray-600">
              <li>ברונזה: {getCommissionRate('bronze') * 100}% (₪0 - ₪{tierThresholds.silver - 1})</li>
              <li>כסף: {getCommissionRate('silver') * 100}% (₪{tierThresholds.silver} - ₪{tierThresholds.gold - 1})</li>
              <li>זהב: {getCommissionRate('gold') * 100}% (₪{tierThresholds.gold} - ₪{tierThresholds.platinum - 1})</li>
              <li>פלטינום: {getCommissionRate('platinum') * 100}% (₪{tierThresholds.platinum}+)</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-1">מתי אני מקבל את התשלום?</h3>
            <p className="text-gray-600">
              תשלומים מבוצעים אחת לחודש, בתנאי שהגעת לסף המינימלי של ₪200. אם לא הגעת לסף, הסכום יועבר לחודש הבא.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-1">איך אני מבקש תשלום?</h3>
            <p className="text-gray-600">
              כשיש לך סכום זמין למשיכה, תוכל ללחוץ על כפתור "בקש תשלום" ולבחור את שיטת התשלום המועדפת עליך.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-1">כמה זמן נשמר המופנה שלי?</h3>
            <p className="text-gray-600">
              אנו משתמשים בעוגיות כדי לעקוב אחר המופנים שלך למשך 30 יום. כל הזמנה שהם מבצעים במהלך תקופה זו תזכה אותך בעמלה.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Method Setup Modal */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">הגדרת פרטי תשלום</h2>
              <button
                onClick={() => setShowPaymentMethodModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  שיטת תשלום
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="paypal"
                      checked={paymentMethod === 'paypal'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="ml-2"
                    />
                    PayPal
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="bank_transfer"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="ml-2"
                    />
                    העברה בנקאית
                  </label>
                </div>
              </div>
              
              {paymentMethod === 'paypal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    כתובת אימייל PayPal
                  </label>
                  <input
                    type="email"
                    value={paymentDetails.email}
                    onChange={(e) => setPaymentDetails({ ...paymentDetails, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}
              
              {paymentMethod === 'bank_transfer' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שם בעל החשבון
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.accountHolder}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, accountHolder: e.target.value })}
                      placeholder="שם מלא"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שם הבנק
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.bankName}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, bankName: e.target.value })}
                      placeholder="בנק הפועלים, בנק לאומי וכו'"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      מספר חשבון
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.bankAccount}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, bankAccount: e.target.value })}
                      placeholder="מספר חשבון"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 space-x-reverse mt-6">
              <button
                onClick={savePaymentMethod}
                disabled={savingPaymentMethod || 
                  (paymentMethod === 'paypal' && !paymentDetails.email) ||
                  (paymentMethod === 'bank_transfer' && (!paymentDetails.bankAccount || !paymentDetails.bankName || !paymentDetails.accountHolder))
                }
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ml-3"
              >
                {savingPaymentMethod ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={() => setShowPaymentMethodModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
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