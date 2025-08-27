import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Users, DollarSign, Search, Filter, RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle, Edit2, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../utils/currency';
import { checkAdminAccess } from '../../../lib/admin';
import { useNavigate } from 'react-router-dom';

export function AffiliateManagement() {
  const navigate = useNavigate();
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAffiliatesSection, setShowAffiliatesSection] = useState(true);
  const [showCommissionsSection, setShowCommissionsSection] = useState(true);
  const [showPayoutsSection, setShowPayoutsSection] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [editingPayout, setEditingPayout] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    status: '',
    amount: '',
    notes: ''
  });
  const [affiliateStats, setAffiliateStats] = useState({
    totalAffiliates: 0,
    activeAffiliates: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
    totalPayouts: 0,
    pendingPayouts: 0,
    missingPaymentDetails: 0
  });
  const [showTierSettingsModal, setShowTierSettingsModal] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [tierSettings, setTierSettings] = useState({
    bronze: { threshold: 0, rate: 10 },
    silver: { threshold: 500, rate: 12 },
    gold: { threshold: 2000, rate: 15 },
    platinum: { threshold: 5000, rate: 20 }
  });

  async function calculateStats() {
    try {
      console.log('Calculating affiliate stats...', { 
        affiliatesCount: affiliates.length, 
        commissionsCount: commissions.length, 
        payoutsCount: payouts.length 
      });
      
      // Calculate total and active affiliates (all fetched affiliates are active since we filter by is_affiliate=true)
      const totalAffiliates = affiliates.length;
      const activeAffiliates = affiliates.filter(a => 
        a.is_affiliate && 
        (a.affiliate_earnings > 0 || commissions.some(c => c.affiliate_id === a.id))
      ).length;

      // Calculate affiliates missing payment details
      const missingPaymentDetails = affiliates.filter(a => 
        !a.payment_method || 
        !a.payment_details || 
        (typeof a.payment_details === 'object' && Object.keys(a.payment_details).length === 0)
      ).length;

      // Calculate commission stats (confirmed = paid commissions)
      const totalCommissions = commissions.reduce((sum, commission) => 
        sum + (commission.status === 'confirmed' || commission.status === 'paid' ? Number(commission.amount) : 0), 0);
      const pendingCommissions = commissions.reduce((sum, commission) => 
        sum + (commission.status === 'pending' ? Number(commission.amount) : 0), 0);

      // Calculate payout stats
      const totalPayouts = payouts.reduce((sum, payout) => 
        sum + (payout.status === 'completed' ? Number(payout.amount) : 0), 0);
      const pendingPayouts = payouts.reduce((sum, payout) => 
        sum + (payout.status === 'pending' || payout.status === 'processing' ? Number(payout.amount) : 0), 0);

      const newStats = {
        totalAffiliates,
        activeAffiliates,
        totalCommissions,
        pendingCommissions,
        totalPayouts,
        pendingPayouts,
        missingPaymentDetails
      };
      
      console.log('Updated affiliate stats:', newStats);
      setAffiliateStats(newStats);
    } catch (error) {
      console.error('Error calculating stats:', error);
      throw error;
    }
  }

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    
    const checkAccess = async () => {
      const hasAccess = await checkAdminAccess();
      setIsAdmin(hasAccess);
      
      if (hasAccess) {
        await fetchData();
        cleanup = setupRealtimeSubscriptions();
        await fetchTierSettings();
      } else {
        setLoading(false);
        toast.error('אין לך הרשאות גישה לדף זה');
        navigate('/dashboard/Joseph998');
      }
    };
    
    checkAccess();
    
    // Cleanup function
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [navigate]);

  async function fetchTierSettings() {
    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'affiliate_tiers')
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          console.error('Error fetching tier settings:', error);
        }
        // If not found, create default settings
        await saveTierSettings();
        return;
      }

      if (data?.value?.tiers) {
        setTierSettings({
          bronze: { 
            threshold: data.value.tiers.bronze || 0, 
            rate: data.value.rates?.bronze || 10 
          },
          silver: { 
            threshold: data.value.tiers.silver || 500, 
            rate: data.value.rates?.silver || 12 
          },
          gold: { 
            threshold: data.value.tiers.gold || 2000, 
            rate: data.value.rates?.gold || 15 
          },
          platinum: { 
            threshold: data.value.tiers.platinum || 5000, 
            rate: data.value.rates?.platinum || 20 
          }
        });
      }
    } catch (error) {
      console.error('Error fetching tier settings:', error);
    }
  }

  async function saveTierSettings() {
    try {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'affiliate_tiers',
          value: {
            tiers: {
              bronze: tierSettings.bronze.threshold,
              silver: tierSettings.silver.threshold,
              gold: tierSettings.gold.threshold,
              platinum: tierSettings.platinum.threshold
            },
            rates: {
              bronze: tierSettings.bronze.rate,
              silver: tierSettings.silver.rate,
              gold: tierSettings.gold.rate,
              platinum: tierSettings.platinum.rate
            }
          },
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      
      toast.success('הגדרות דרגות שותפים נשמרו בהצלחה');
      setShowTierSettingsModal(false);
    } catch (error) {
      console.error('Error saving tier settings:', error);
      toast.error('שגיאה בשמירת הגדרות דרגות שותפים');
    }
  }

  function setupRealtimeSubscriptions() {
    console.log('Setting up real-time subscriptions for affiliate management');
    
    // Subscribe to affiliate changes
    const affiliatesSubscription = supabase
      .channel('admin_affiliates_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'users',
          filter: 'is_affiliate=eq.true'
        }, 
        async (payload) => {
          console.log('Affiliate change detected:', payload);
          try {
            await fetchAffiliates();
            await calculateStats();
          } catch (error) {
            console.error('Error handling affiliate change:', error);
          }
        }
      )
      .subscribe();

    // Subscribe to commission changes
    const commissionsSubscription = supabase
      .channel('admin_commissions_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'affiliate_commissions'
        }, 
        async (payload) => {
          console.log('Commission change detected:', payload);
          try {
            await fetchCommissions();
            await calculateStats();
          } catch (error) {
            console.error('Error handling commission change:', error);
          }
        }
      )
      .subscribe();

    // Subscribe to payout changes
    const payoutsSubscription = supabase
      .channel('admin_payouts_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'affiliate_payouts'
        }, 
        async (payload) => {
          console.log('Payout change detected:', payload);
          try {
            await fetchPayouts();
            await calculateStats();
          } catch (error) {
            console.error('Error handling payout change:', error);
          }
        }
      )
      .subscribe();

    // Return cleanup function
    return () => {
      console.log('Cleaning up affiliate management subscriptions');
      affiliatesSubscription.unsubscribe();
      commissionsSubscription.unsubscribe();
      payoutsSubscription.unsubscribe();
    };
  }

  async function fetchData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchAffiliates(),
        fetchCommissions(),
        fetchPayouts()
      ]);
      await calculateStats();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchAffiliates() {
    try {
      console.log('Fetching all affiliates...');
      
      // Use service role function to fetch affiliates
      const { data, error } = await supabase.rpc('admin_get_all_affiliates');

      if (error) throw error;
      
      console.log('Fetched affiliates:', data?.length || 0);
      setAffiliates(data || []);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      throw error;
    }
  }

  async function fetchCommissions() {
    try {
      // Use service role function to fetch commissions with user details
      const { data, error } = await supabase.rpc('admin_get_all_commissions');

      if (error) throw error;

      // Transform data to match expected structure
      const commissionsWithDetails = (data || []).map((commission: any) => ({
        ...commission,
        affiliate: {
          id: commission.affiliate_id,
          name: commission.affiliate_name || 'Unknown',
          email: commission.affiliate_email || 'Unknown'
        },
        referred_user: commission.referred_user_id ? {
          id: commission.referred_user_id,
          name: commission.referred_user_name || 'Unknown',
          email: commission.referred_user_email || 'Unknown'
        } : null
      }));

      setCommissions(commissionsWithDetails);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      throw error;
    }
  }

  async function fetchPayouts() {
    try {
      // Use service role function to fetch payouts with affiliate details
      const { data, error } = await supabase.rpc('admin_get_all_payouts');

      if (error) throw error;

      // Transform data to match expected structure
      const payoutsWithDetails = (data || []).map((payout: any) => ({
        ...payout,
        affiliate: {
          id: payout.affiliate_id,
          name: payout.affiliate_name || 'Unknown',
          email: payout.affiliate_email || 'Unknown'
        }
      }));

      setPayouts(payoutsWithDetails);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      throw error;
    }
  }

  const refreshData = async () => {
    setRefreshing(true);
    toast.success('הנתונים עודכנו בהצלחה');
  };

  const handleUpdateCommissionStatus = async (id: string, newStatus: string) => {
    try {
      console.log(`[Commission Payment] Attempting to update commission ${id} to status: ${newStatus}`);
      
      const { error } = await supabase
        .from('affiliate_commissions')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'paid' ? { paid_at: new Date().toISOString() } : {})
        })
        .eq('id', id);

      if (error) {
        console.error(`[Commission Payment] Database error updating commission ${id}:`, error);
        throw error;
      }
      
      console.log(`[Commission Payment] Successfully updated commission ${id} to ${newStatus}`);
      
      toast.success(`סטטוס העמלה עודכן ל${
        newStatus === 'confirmed' ? 'מאושר' : 
        newStatus === 'paid' ? 'שולם' : 
        newStatus === 'cancelled' ? 'בוטל' : newStatus
      }`);
      
      await fetchCommissions();
      await calculateStats();
    } catch (error: any) {
      console.error('[Commission Payment] Error updating commission status:', error);
      const errorMessage = error?.message || error?.toString() || 'שגיאה לא ידועה';
      toast.error(`שגיאה בעדכון סטטוס העמלה: ${errorMessage}`);
    }
  };

  const handleUpdatePayoutStatus = async (id: string, newStatus: string) => {
    try {
      console.log(`[Payout Payment] Attempting to update payout ${id} to status: ${newStatus}`);
      
      // If marking as completed, we need to reset the affiliate's earnings
      if (newStatus === 'completed') {
        console.log(`[Payout Payment] Processing completion for payout ${id}`);
        
        // First, get the payout record to find the affiliate_id
        const { data: payout, error: payoutError } = await supabase
          .from('affiliate_payouts')
          .select('affiliate_id, amount')
          .eq('id', id)
          .single();

        if (payoutError) {
          console.error(`[Payout Payment] Error fetching payout ${id}:`, payoutError);
          throw new Error(`Failed to fetch payout details: ${payoutError.message}`);
        }

        if (!payout?.affiliate_id) {
          console.error(`[Payout Payment] No affiliate_id found for payout ${id}`);
          throw new Error('Payout record is missing affiliate information');
        }

        console.log(`[Payout Payment] Found payout for affiliate ${payout.affiliate_id}, amount: ${payout.amount}`);

        // Update payout status
        const { error: statusError } = await supabase
          .from('affiliate_payouts')
          .update({ 
            status: newStatus,
            processed_at: new Date().toISOString()
          })
          .eq('id', id);

        if (statusError) {
          console.error(`[Payout Payment] Error updating payout status for ${id}:`, statusError);
          throw new Error(`Failed to update payout status: ${statusError.message}`);
        }

        console.log(`[Payout Payment] Successfully updated payout ${id} status to completed`);

        // Reset affiliate earnings to 0 using service role function
        console.log(`[Payout Payment] Resetting affiliate earnings for ${payout.affiliate_id}`);
        const { error: earningsError } = await supabase.rpc('admin_reset_affiliate_earnings', {
          p_affiliate_id: payout.affiliate_id
        });

        if (earningsError) {
          console.error(`[Payout Payment] Error resetting affiliate earnings for ${payout.affiliate_id}:`, earningsError);
          // Don't throw here - payout status was already updated successfully
          toast.error('התשלום הושלם אך יש בעיה באיפוס הרווחים. אנא בדוק ידנית.');
        } else {
          console.log(`[Payout Payment] Successfully reset earnings for affiliate ${payout.affiliate_id}`);
        }

        toast.success('התשלום הושלם בהצלחה');
      } else {
        // For other status updates, just update the payout record
        console.log(`[Payout Payment] Updating payout ${id} to status: ${newStatus}`);
        
        const { error } = await supabase
          .from('affiliate_payouts')
          .update({ 
            status: newStatus,
            ...(newStatus === 'failed' ? { processed_at: new Date().toISOString() } : {})
          })
          .eq('id', id);

        if (error) {
          console.error(`[Payout Payment] Error updating payout ${id} to ${newStatus}:`, error);
          throw new Error(`Failed to update payout status: ${error.message}`);
        }
        
        console.log(`[Payout Payment] Successfully updated payout ${id} to ${newStatus}`);
        
        toast.success(`סטטוס התשלום עודכן ל${
          newStatus === 'processing' ? 'בעיבוד' : 
          newStatus === 'failed' ? 'נכשל' : newStatus
        }`);
      }
      
      console.log(`[Payout Payment] Refreshing data after payout ${id} update`);
      await fetchPayouts();
      await calculateStats();
    } catch (error: any) {
      console.error('[Payout Payment] Error updating payout status:', error);
      const errorMessage = error?.message || error?.toString() || 'שגיאה לא ידועה';
      toast.error(`שגיאה בעדכון סטטוס התשלום: ${errorMessage}`);
    }
  };

  const markAffiliatePaymentAsPaid = async (affiliateId: string, currentEarnings: number) => {
    try {
      setProcessingPayment(true);
      
      // Create a new payout record
      const { error: payoutError } = await supabase
        .from('affiliate_payouts')
        .insert({
          affiliate_id: affiliateId,
          amount: currentEarnings,
          payout_method: selectedAffiliate.payment_method || 'manual',
          payout_details: selectedAffiliate.payment_details || {},
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      // Reset the affiliate's earnings to 0 using service role function
      const { error: resetError } = await supabase.rpc('admin_reset_affiliate_earnings', {
        p_affiliate_id: affiliateId
      });

      if (resetError) throw resetError;

      // Refresh data
      await fetchAffiliates();
      await fetchPayouts();
      await calculateStats();
      
      toast.success('התשלום סומן כמשולם וההכנסות אופסו');
      
      // Close modal
      setShowPaymentDetailsModal(false);
      setSelectedAffiliate(null);
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      toast.error('שגיאה בסימון התשלום כמשולם');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleEditCommission = (commission: any) => {
    setEditingCommission(commission.id);
    setEditFormData({
      status: commission.status,
      amount: commission.amount.toString(),
      notes: commission.notes || ''
    });
  };

  const handleEditPayout = (payout: any) => {
    setEditingPayout(payout.id);
    setEditFormData({
      status: payout.status,
      amount: payout.amount.toString(),
      notes: payout.notes || ''
    });
  };

  const handleSaveCommissionEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_commissions')
        .update({ 
          status: editFormData.status,
          amount: parseFloat(editFormData.amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('העמלה עודכנה בהצלחה');
      setEditingCommission(null);
      
      await fetchCommissions();
      await calculateStats();
    } catch (error) {
      console.error('Error updating commission:', error);
      toast.error('שגיאה בעדכון העמלה');
    }
  };

  const handleSavePayoutEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliate_payouts')
        .update({ 
          status: editFormData.status,
          amount: parseFloat(editFormData.amount),
          notes: editFormData.notes
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('התשלום עודכן בהצלחה');
      setEditingPayout(null);
      
      await fetchPayouts();
      await calculateStats();
    } catch (error) {
      console.error('Error updating payout:', error);
      toast.error('שגיאה בעדכון התשלום');
    }
  };

  const handleDeleteCommission = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק עמלה זו?')) return;
    
    try {
      const { error } = await supabase
        .from('affiliate_commissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('העמלה נמחקה בהצלחה');
      
      await fetchCommissions();
      await calculateStats();
    } catch (error) {
      console.error('Error deleting commission:', error);
      toast.error('שגיאה במחיקת העמלה');
    }
  };

  const handleDeletePayout = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) return;
    
    try {
      const { error } = await supabase
        .from('affiliate_payouts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('התשלום נמחק בהצלחה');
      
      await fetchPayouts();
      await calculateStats();
    } catch (error) {
      console.error('Error deleting payout:', error);
      toast.error('שגיאה במחיקת התשלום');
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

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-amber-100 text-amber-800';
      case 'silver': return 'bg-gray-100 text-gray-800';
      case 'gold': return 'bg-yellow-100 text-yellow-800';
      case 'platinum': return 'bg-blue-100 text-blue-800';
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

  // Filter affiliates based on search query
  const filteredAffiliates = affiliates.filter(affiliate => {
    return (
      affiliate.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      affiliate.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      affiliate.affiliate_code?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Filter commissions based on search query and status filter
  const filteredCommissions = commissions.filter(commission => {
    const matchesSearch = (
      commission.affiliate?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      commission.affiliate?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      commission.referred_user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      commission.referred_user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const matchesStatus = statusFilter === 'all' || commission.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filter payouts based on search query and status filter
  const filteredPayouts = payouts.filter(payout => {
    const matchesSearch = (
      payout.affiliate?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.affiliate?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const matchesStatus = statusFilter === 'all' || payout.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין הרשאת גישה</h2>
          <p className="text-gray-600">אין לך הרשאות מנהל לצפות בדף זה.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול שותפים</h1>
        <div className="flex space-x-4">
          <button 
            onClick={() => setShowTierSettingsModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 ml-4"
          >
            הגדרות דרגות
          </button>
          <button 
            onClick={refreshData}
            className="flex items-center px-4 py-2 text-gray-600 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
            רענן נתונים
          </button>
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
              <p className="text-sm font-medium text-gray-500">שותפים פעילים</p>
              <p className="text-2xl font-semibold text-gray-900">{affiliateStats.activeAffiliates}</p>
              <p className="text-sm text-gray-500">מתוך {affiliateStats.totalAffiliates} שותפים</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">עמלות מאושרות</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(affiliateStats.totalCommissions)}</p>
              <p className="text-sm text-gray-500">ממתינות: {formatCurrency(affiliateStats.pendingCommissions)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">תשלומים שהושלמו</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(affiliateStats.totalPayouts)}</p>
              <p className="text-sm text-gray-500">ממתינים: {formatCurrency(affiliateStats.pendingPayouts)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 text-orange-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-500">אין פרטי תשלום</p>
              <p className="text-2xl font-semibold text-gray-900">{affiliateStats.missingPaymentDetails || 0}</p>
              <p className="text-sm text-gray-500">דורשים עדכון</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, אימייל או קוד הפניה..."
            className="w-full pr-10 pl-4 py-2 border rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-4 py-2"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="pending">ממתין</option>
          <option value="confirmed">מאושר</option>
          <option value="paid">שולם</option>
          <option value="cancelled">בוטל</option>
          <option value="processing">בעיבוד</option>
          <option value="completed">הושלם</option>
          <option value="failed">נכשל</option>
        </select>
      </div>

      {/* Affiliates Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-primary-600 ml-2" />
            <h2 className="text-lg font-medium text-gray-900">שותפים</h2>
          </div>
          <button 
            onClick={() => setShowAffiliatesSection(!showAffiliatesSection)}
            className="text-gray-500 hover:text-gray-700"
          >
            {showAffiliatesSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        
        {showAffiliatesSection && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שם</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">אימייל</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">קוד הפניה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">דרגה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">הכנסות</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">הצטרף</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAffiliates.length > 0 ? (
                  filteredAffiliates.map((affiliate) => (
                    <tr key={affiliate.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {affiliate.name || 'לא צוין'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {affiliate.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {affiliate.affiliate_code || 'לא צוין'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTierColor(affiliate.affiliate_tier)}`}>
                          {affiliate.affiliate_tier || 'bronze'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => {
                            setSelectedAffiliate(affiliate);
                            setShowPaymentDetailsModal(true);
                          }}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          {affiliate.raw_user_meta_data?.paymentMethod ? 'צפה בפרטי תשלום' : 'אין פרטי תשלום'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(affiliate.affiliate_earnings || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {affiliate.affiliate_joined_at ? new Date(affiliate.affiliate_joined_at).toLocaleDateString('he-IL') : 'לא ידוע'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      לא נמצאו שותפים
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שותף</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מופנה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סוג</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCommissions.length > 0 ? (
                  filteredCommissions.map((commission) => (
                    <tr key={commission.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {commission.affiliate?.name || commission.affiliate?.email || 'לא ידוע'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {commission.referred_user?.name || commission.referred_user?.email || 'לא ידוע'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getCommissionTypeLabel(commission.commission_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editingCommission === commission.id ? (
                          <input
                            type="number"
                            value={editFormData.amount}
                            onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                            className="w-24 px-2 py-1 border rounded-md"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          formatCurrency(commission.amount)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingCommission === commission.id ? (
                          <select
                            value={editFormData.status}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                            className="px-2 py-1 border rounded-md"
                          >
                            <option value="pending">ממתין</option>
                            <option value="confirmed">מאושר</option>
                            <option value="paid">שולם</option>
                            <option value="cancelled">בוטל</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(commission.status)}`}>
                            {commission.status === 'pending' ? 'ממתין' : 
                             commission.status === 'confirmed' ? 'מאושר' : 
                             commission.status === 'paid' ? 'שולם' : 
                             commission.status === 'cancelled' ? 'בוטל' : commission.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(commission.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingCommission === commission.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSaveCommissionEdit(commission.id)}
                              className="text-green-600 hover:text-green-900 ml-2"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setEditingCommission(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            {commission.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateCommissionStatus(commission.id, 'confirmed')}
                                className="text-green-600 hover:text-green-900 ml-2"
                                title="אשר"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                            )}
                            {commission.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateCommissionStatus(commission.id, 'cancelled')}
                                className="text-red-600 hover:text-red-900 ml-2"
                                title="בטל"
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            )}
                            {commission.status === 'confirmed' && (
                              <button
                                onClick={() => handleUpdateCommissionStatus(commission.id, 'paid')}
                                className="text-blue-600 hover:text-blue-900 ml-2"
                                title="סמן כשולם"
                              >
                                <DollarSign className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditCommission(commission)}
                              className="text-primary-600 hover:text-primary-900 ml-2"
                              title="ערוך"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCommission(commission.id)}
                              className="text-red-600 hover:text-red-900"
                              title="מחק"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      לא נמצאו עמלות
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
          <button 
            onClick={() => setShowPayoutsSection(!showPayoutsSection)}
            className="text-gray-500 hover:text-gray-700"
          >
            {showPayoutsSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        
        {showPayoutsSection && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שותף</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שיטה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך בקשה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך עיבוד</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayouts.length > 0 ? (
                  filteredPayouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payout.affiliate?.name || payout.affiliate?.email || 'לא ידוע'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editingPayout === payout.id ? (
                          <input
                            type="number"
                            value={editFormData.amount}
                            onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                            className="w-24 px-2 py-1 border rounded-md"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          formatCurrency(payout.amount)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getPayoutMethodLabel(payout.payout_method)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingPayout === payout.id ? (
                          <select
                            value={editFormData.status}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                            className="px-2 py-1 border rounded-md"
                          >
                            <option value="pending">ממתין</option>
                            <option value="processing">בעיבוד</option>
                            <option value="completed">הושלם</option>
                            <option value="failed">נכשל</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payout.status)}`}>
                            {payout.status === 'pending' ? 'ממתין' : 
                             payout.status === 'processing' ? 'בעיבוד' : 
                             payout.status === 'completed' ? 'הושלם' : 
                             payout.status === 'failed' ? 'נכשל' : payout.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(payout.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payout.processed_at ? new Date(payout.processed_at).toLocaleDateString('he-IL') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingPayout === payout.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSavePayoutEdit(payout.id)}
                              className="text-green-600 hover:text-green-900 ml-2"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setEditingPayout(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            {payout.status === 'pending' && (
                              <button
                                onClick={() => handleUpdatePayoutStatus(payout.id, 'processing')}
                                className="text-purple-600 hover:text-purple-900 ml-2"
                                title="סמן כבעיבוד"
                              >
                                <RefreshCw className="h-5 w-5" />
                              </button>
                            )}
                            {(payout.status === 'pending' || payout.status === 'processing') && (
                              <button
                                onClick={() => handleUpdatePayoutStatus(payout.id, 'completed')}
                                className="text-green-600 hover:text-green-900 ml-2"
                                title="סמן כהושלם"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                            )}
                            {(payout.status === 'pending' || payout.status === 'processing') && (
                              <button
                                onClick={() => handleUpdatePayoutStatus(payout.id, 'failed')}
                                className="text-red-600 hover:text-red-900 ml-2"
                                title="סמן כנכשל"
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditPayout(payout)}
                              className="text-primary-600 hover:text-primary-900 ml-2"
                              title="ערוך"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayout(payout.id)}
                              className="text-red-600 hover:text-red-900"
                              title="מחק"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      לא נמצאו תשלומים
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tier Settings Modal */}
      {showTierSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">הגדרות דרגות שותפים</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">דרגת ברונזה</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סף הכנסות (₪)</label>
                    <input
                      type="number"
                      value={tierSettings.bronze.threshold}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        bronze: { ...tierSettings.bronze, threshold: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min="0"
                      disabled={true} // Bronze threshold is always 0
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">אחוז עמלה (%)</label>
                    <input
                      type="number"
                      value={tierSettings.bronze.rate}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        bronze: { ...tierSettings.bronze, rate: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">דרגת כסף</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סף הכנסות (₪)</label>
                    <input
                      type="number"
                      value={tierSettings.silver.threshold}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        silver: { ...tierSettings.silver, threshold: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">אחוז עמלה (%)</label>
                    <input
                      type="number"
                      value={tierSettings.silver.rate}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        silver: { ...tierSettings.silver, rate: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">דרגת זהב</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סף הכנסות (₪)</label>
                    <input
                      type="number"
                      value={tierSettings.gold.threshold}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        gold: { ...tierSettings.gold, threshold: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min={tierSettings.silver.threshold + 1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">אחוז עמלה (%)</label>
                    <input
                      type="number"
                      value={tierSettings.gold.rate}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        gold: { ...tierSettings.gold, rate: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">דרגת פלטינום</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סף הכנסות (₪)</label>
                    <input
                      type="number"
                      value={tierSettings.platinum.threshold}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        platinum: { ...tierSettings.platinum, threshold: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min={tierSettings.gold.threshold + 1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">אחוז עמלה (%)</label>
                    <input
                      type="number"
                      value={tierSettings.platinum.rate}
                      onChange={(e) => setTierSettings({
                        ...tierSettings,
                        platinum: { ...tierSettings.platinum, rate: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-md"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 space-x-reverse mt-6">
              <button
                onClick={saveTierSettings}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 ml-3"
              >
                שמור הגדרות
              </button>
              <button
                onClick={() => setShowTierSettingsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Payment Details Modal */}
      {showPaymentDetailsModal && selectedAffiliate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">פרטי תשלום - {selectedAffiliate.name || selectedAffiliate.email}</h3>
                <button
                  onClick={() => {
                    setShowPaymentDetailsModal(false);
                    setSelectedAffiliate(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {selectedAffiliate.payment_method ? (
                  <div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">שיטת תשלום</label>
                      <div className="text-sm text-gray-900">
                        {selectedAffiliate.payment_method === 'paypal' ? 'PayPal' : 'העברה בנקאית'}
                      </div>
                    </div>
                    
                    {selectedAffiliate.payment_method === 'paypal' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">כתובת אימייל PayPal</label>
                        <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                          {selectedAffiliate.payment_details?.email || 'לא צוין'}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">שם הבנק</label>
                          <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                            {selectedAffiliate.payment_details?.bankName || 'לא צוין'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מספר חשבון</label>
                          <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md font-mono">
                            {selectedAffiliate.payment_details?.bankAccount || 'לא צוין'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">בעל החשבון</label>
                          <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                            {selectedAffiliate.payment_details?.accountHolder || 'לא צוין'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">מספר סניף</label>
                          <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                            {selectedAffiliate.payment_details?.branchNumber || 'לא צוין'}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">הכנסות נוכחיות:</span> {formatCurrency(selectedAffiliate.affiliate_earnings || 0)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-sm">השותף עדיין לא הגדיר פרטי תשלום</div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between mt-6">
                {selectedAffiliate.payment_method && selectedAffiliate.affiliate_earnings > 0 && (
                  <button
                    onClick={() => markAffiliatePaymentAsPaid(selectedAffiliate.id, selectedAffiliate.affiliate_earnings)}
                    disabled={processingPayment}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {processingPayment ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        מעבד...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        סמן כמשולם ({formatCurrency(selectedAffiliate.affiliate_earnings)})
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowPaymentDetailsModal(false);
                    setSelectedAffiliate(null);
                  }}
                  disabled={processingPayment}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}