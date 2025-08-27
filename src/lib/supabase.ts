import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not configured properly');
  console.warn('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.warn('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Enable automatic detection of auth tokens in URL
    flowType: 'pkce', // Use PKCE flow for better security
    // Set the site URL to the production domain
    site: 'https://mystar.co.il'
  },
  global: {
    headers: {
      'X-Client-Info': 'mystar-app'
    },
    fetch: (url, options = {}) => {
      // Add timeout to all fetch requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      return fetch(url, {
        ...options,
        signal: controller.signal
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Handle auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
    // Clear any cached data
    localStorage.removeItem('paypal_transaction_id');
    localStorage.removeItem('paypal_order_id');
    
    if (event === 'SIGNED_OUT') {
      // Force reload on sign out to clear any stale state
      window.location.reload();
    }
  }
  
  // Log auth events for debugging
  console.log('Auth event:', event);
});

// Helper function to test Supabase connection
export async function testSupabaseConnection() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        error: 'Supabase environment variables not configured'
      };
    }

    // Test with a simple query and timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('count')
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timeout - please check your internet connection'
        };
      }
      
      return {
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Network error'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to extract hash parameters
function extractHashParams() {
  const hash = window.location.hash.replace('#', '');
  const params = new URLSearchParams(hash);
  
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
    expiresIn: params.get('expires_in')
  };
}

// Helper function to handle auth callback
export async function handleAuthCallback() {
  try {
    // Check if we have hash parameters
    const { accessToken, refreshToken, type } = extractHashParams();
    
    if (accessToken && refreshToken) {
      // Set the session with the tokens
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (error) {
        console.error('Error setting session:', error);
        return { success: false, error, type };
      }
      
      return { success: true, data, type };
    }
    
    // Check for error in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const errorDescription = urlParams.get('error_description');
    
    if (errorDescription) {
      return { 
        success: false, 
        error: { message: errorDescription },
        type: 'error'
      };
    }
    
    // Check if this is a password reset or email confirmation
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return { success: false, error, type: null };
    }
    
    if (data.session) {
      // We have a valid session
      return { success: true, data, type: 'session' };
    }
    
    // Check for password reset token in URL
    const token = urlParams.get('token');
    const authType = urlParams.get('type');
    
    if (token && authType) {
      // This is a password reset or email confirmation
      try {
        if (authType === 'recovery') {
          // For password reset, we need to verify the token
          // Don't verify the token here, just return success so we can redirect to reset password page
          return { success: true, data: null, type: 'recovery' };
        } else if (authType === 'signup') {
          // For email confirmation
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });
          
          if (error) {
            console.error('Error verifying signup token:', error);
            return { success: false, error, type: 'signup' };
          }
          
          // Token is valid, return success
          return { success: true, data, type: 'signup' };
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        return { success: false, error, type: authType };
      }
    }
    
    return { success: false, error: { message: 'No auth tokens found' }, type: null };
  } catch (error) {
    console.error('Error handling auth callback:', error);
    return { success: false, error, type: null };
  }
}