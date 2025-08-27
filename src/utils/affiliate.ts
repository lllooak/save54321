import { supabase } from '../lib/supabase';

// Function to track affiliate visit
export async function trackAffiliateVisit(affiliateCode: string) {
  try {
    // Generate a visitor ID if one doesn't exist
    let visitorId = localStorage.getItem('visitor_id');
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem('visitor_id', visitorId);
    }

    // Call the edge function to track the visit
    const { data, error } = await supabase.functions.invoke('track-affiliate-visit', {
      body: {
        affiliateCode,
        visitorId,
        ipAddress: '', // This will be determined server-side
        userAgent: navigator.userAgent,
        referralUrl: document.referrer
      }
    });

    if (error) {
      console.error('Error tracking affiliate visit:', error);
      return false;
    }

    // Store the affiliate code in localStorage for attribution
    localStorage.setItem('affiliate_code', affiliateCode);
    localStorage.setItem('affiliate_timestamp', Date.now().toString());

    return true;
  } catch (error) {
    console.error('Error tracking affiliate visit:', error);
    return false;
  }
}

// Function to check if there's a stored affiliate code
function getStoredAffiliateCode(): string | null {
  const code = localStorage.getItem('affiliate_code');
  const timestamp = localStorage.getItem('affiliate_timestamp');
  
  // Check if the code exists and is not expired (30 days)
  if (code && timestamp) {
    const expirationTime = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const currentTime = Date.now();
    const storedTime = parseInt(timestamp, 10);
    
    if (currentTime - storedTime < expirationTime) {
      return code;
    } else {
      // Clear expired code
      localStorage.removeItem('affiliate_code');
      localStorage.removeItem('affiliate_timestamp');
    }
  }
  
  return null;
}

// Function to track signup through affiliate
export async function trackAffiliateSignup(userId: string) {
  console.log('[AFFILIATE DEBUG] Starting trackAffiliateSignup for user:', userId);
  const affiliateCode = getStoredAffiliateCode();
  console.log('[AFFILIATE DEBUG] Retrieved affiliate code:', affiliateCode);
  if (!affiliateCode) {
    console.log('[AFFILIATE DEBUG] No affiliate code found, skipping tracking');
    return false;
  }
  
  try {
    // Get affiliate ID from code
    const { data: affiliateData, error: affiliateError } = await supabase
      .from('affiliate_links')
      .select('user_id')
      .eq('code', affiliateCode)
      .eq('is_active', true)
      .single();
    
    if (affiliateError) {
      console.error('[AFFILIATE DEBUG] Error finding affiliate:', affiliateError);
      return false;
    }
    
    console.log('[AFFILIATE DEBUG] Found affiliate:', affiliateData);
    
    // Update user with referrer ID
    const { error: userError } = await supabase
      .from('users')
      .update({ referrer_id: affiliateData.user_id })
      .eq('id', userId);
    
    if (userError) {
      console.error('[AFFILIATE DEBUG] Error updating user referrer:', userError);
      return false;
    }
    
    console.log('[AFFILIATE DEBUG] Successfully updated user referrer_id');
    
    // Record the signup event
    const { error: trackingError } = await supabase
      .from('affiliate_tracking')
      .insert({
        affiliate_id: affiliateData.user_id,
        event_type: 'signup',
        visitor_id: localStorage.getItem('visitor_id'),
        metadata: {
          user_id: userId,
          timestamp: new Date().toISOString()
        }
      });
    
    if (trackingError) {
      console.error('[AFFILIATE DEBUG] Error recording signup:', trackingError);
      return false;
    }
    
    console.log('[AFFILIATE DEBUG] Successfully recorded signup event');
    
    // Create commission for signup (pending approval)
    const { error: commissionError } = await supabase
      .from('affiliate_commissions')
      .insert({
        affiliate_id: affiliateData.user_id,
        referred_user_id: userId,
        amount: 0, // Will be updated when approved
        status: 'pending',
        commission_type: 'signup'
      });
    
    if (commissionError) {
      console.error('Error creating commission:', commissionError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking affiliate signup:', error);
    return false;
  }
}

// Function to track booking through affiliate
export async function trackAffiliateBooking(userId: string, requestId: string, amount: number) {
  try {
    // First, get the user's referrer_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('referrer_id')
      .eq('id', userId)
      .single();
    
    if (userError || !userData?.referrer_id) {
      return false;
    }
    
    // Then, get the referrer's affiliate_tier
    const { data: referrerData, error: referrerError } = await supabase
      .from('users')
      .select('affiliate_tier')
      .eq('id', userData.referrer_id)
      .single();
    
    if (referrerError) {
      console.error('Error fetching referrer data:', referrerError);
      return false;
    }
    
    // Record the booking event
    const { error: trackingError } = await supabase
      .from('affiliate_tracking')
      .insert({
        affiliate_id: userData.referrer_id,
        event_type: 'booking',
        visitor_id: localStorage.getItem('visitor_id'),
        metadata: {
          user_id: userId,
          request_id: requestId,
          amount: amount,
          timestamp: new Date().toISOString()
        }
      });
    
    if (trackingError) {
      console.error('Error recording booking:', trackingError);
      return false;
    }
    
    // Get commission rate based on affiliate tier
    const commissionRate = getCommissionRate(referrerData?.affiliate_tier || 'bronze');
    
    // Calculate commission amount based on tier
    const commissionAmount = amount * commissionRate;
    
    // Create commission for booking
    const { error: commissionError } = await supabase
      .from('affiliate_commissions')
      .insert({
        affiliate_id: userData.referrer_id,
        referred_user_id: userId,
        request_id: requestId,
        amount: commissionAmount,
        status: 'pending',
        commission_type: 'booking'
      });
    
    if (commissionError) {
      console.error('Error creating commission:', commissionError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking affiliate booking:', error);
    return false;
  }
}

// Function to get commission rate based on tier
export function getCommissionRate(tier: string): number {
  switch (tier.toLowerCase()) {
    case 'platinum':
      return 0.2; // 20%
    case 'gold':
      return 0.15; // 15%
    case 'silver':
      return 0.12; // 12%
    case 'bronze':
    default:
      return 0.1; // 10%
  }
}

// Function to get tier thresholds
export function getTierThresholds(): { [key: string]: number } {
  return {
    bronze: 0,
    silver: 500,
    gold: 2000,
    platinum: 5000
  };
}

// Function to get tier based on earnings
function getTierForEarnings(earnings: number): string {
  const thresholds = getTierThresholds();
  
  if (earnings >= thresholds.platinum) {
    return 'platinum';
  } else if (earnings >= thresholds.gold) {
    return 'gold';
  } else if (earnings >= thresholds.silver) {
    return 'silver';
  } else {
    return 'bronze';
  }
}