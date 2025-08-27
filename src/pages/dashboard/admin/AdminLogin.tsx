import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { LogIn, Shield, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { logAdminLoginAttempt } from '../../../lib/admin';

interface AdminLoginProps {
  onLoginSuccess?: () => void;
}

const MAX_RETRIES = 5; // Increased from 3 to 5 for more retry attempts
const INITIAL_RETRY_DELAY = 1000; // Reduced from 2000ms to 1000ms for faster initial retry
const MAX_RETRY_DELAY = 8000; // Reduced from 10000ms to 8000ms for faster recovery
const BACKOFF_MULTIPLIER = 1.5;
const NETWORK_CHECK_TIMEOUT = 5000;

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    setIsOnline(navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const checkNetworkConnectivity = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), NETWORK_CHECK_TIMEOUT);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      return response.ok || response.status === 401;
    } catch (error) {
      console.error('Network connectivity check failed:', error);
      return false;
    }
  };

  const isSchemaError = (error: any): boolean => {
    if (!error) return false;
    
    const errorMessage = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    const errorDetails = typeof error.details === 'string' ? error.details.toLowerCase() : '';
    const errorCode = typeof error.code === 'string' ? error.code.toLowerCase() : '';
    
    const schemaErrorPatterns = [
      'schema',
      'database error',
      'unexpected_failure',
      'querying schema',
      'confirmation_token',
      'email_change',
      'converting null to string',
      'database connection',
      'connection refused',
      'timeout',
      'scan error on column'
    ];
    
    return schemaErrorPatterns.some(pattern => 
      errorMessage.includes(pattern) || 
      errorDetails.includes(pattern) || 
      errorCode.includes(pattern)
    );
  };

  const calculateRetryDelay = (attempt: number): number => {
    const delay = INITIAL_RETRY_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt);
    return Math.min(delay, MAX_RETRY_DELAY);
  };

  const attemptLogin = async (attempt: number = 0): Promise<any> => {
    try {
      if (attempt > 0) {
        const isConnected = await checkNetworkConnectivity();
        if (!isConnected) {
          throw new Error('network_error');
        }
        
        // Add a small delay before retrying to prevent rapid-fire requests
        await sleep(100);
      }

      console.log(`Login attempt ${attempt + 1}`);
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.error(`Login attempt ${attempt + 1} failed:`, signInError);

        if (isSchemaError(signInError) && attempt < MAX_RETRIES) {
          const delay = calculateRetryDelay(attempt);
          console.log(`Database error detected. Retrying in ${delay}ms (attempt ${attempt + 1} of ${MAX_RETRIES})`);
          
          setRetryCount(attempt + 1);
          await sleep(delay);
          return attemptLogin(attempt + 1);
        }

        if (signInError.message?.includes('Invalid login credentials')) {
          throw new Error('invalid_credentials');
        }

        throw signInError;
      }

      return data;
    } catch (error: any) {
      if (error.message === 'network_error') {
        throw new Error('אין חיבור לאינטרנט. אנא בדוק את החיבור שלך ונסה שוב.');
      }
      if (isSchemaError(error)) {
        throw new Error('שגיאת מסד נתונים. אנא נסה שוב מאוחר יותר.');
      }
      if (error.message === 'invalid_credentials') {
        throw new Error('פרטי התחברות שגויים. אנא בדוק את האימייל והסיסמה ונסה שוב.');
      }
      throw error;
    }
  };

  const verifyAdminStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return false;
      }
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, is_super_admin')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('Error checking admin status:', userError);
        return false;
      }

      return userData?.role === 'admin' || userData?.is_super_admin === true;
    } catch (error) {
      console.error('Admin verification error:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      setError('אין חיבור לאינטרנט. אנא בדוק את החיבור שלך ונסה שוב.');
      toast.error('אין חיבור לאינטרנט');
      return;
    }
    
    setLoading(true);
    setError(null);
    setRetryCount(0);

    try {
      const authData = await attemptLogin();

      if (!authData?.user) {
        throw new Error('לא התקבלו נתוני משתמש מהאימות');
      }

      const isAdmin = await verifyAdminStatus(authData.user.id);

      if (!isAdmin) {
        await logAdminLoginAttempt(email, false, 'User is not an admin');
        throw new Error('אין גישה: המשתמש אינו מנהל');
      }

      await logAdminLoginAttempt(email, true);

      toast.success('התחברת בהצלחה כמנהל');
      
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        navigate('/dashboard/Joseph999');
      }
    } catch (error: any) {
      console.error('Login process failed:', error);
      
      await logAdminLoginAttempt(email, false, error.message);
      
      let errorMessage = 'שגיאה בהתחברות';
      
      if (error.message.includes('אין חיבור לאינטרנט')) {
        errorMessage = error.message;
      } else if (isSchemaError(error)) {
        errorMessage = 'שגיאת מסד נתונים. אנא נסה שוב מאוחר יותר.';
      } else if (error.message.includes('Invalid login credentials') || error.message.includes('פרטי התחברות שגויים')) {
        errorMessage = 'פרטי התחברות שגויים. אנא בדוק את האימייל והסיסמה ונסה שוב.';
      } else if (error.message.includes('אין גישה')) {
        errorMessage = 'אין לך הרשאות מנהל לגשת לדף זה.';
      } else {
        errorMessage = 'שגיאה בהתחברות. אנא נסה שוב מאוחר יותר.';
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="text-center mb-6">
          <div className="bg-primary-100 p-3 rounded-full inline-flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">כניסת מנהל</h1>
          <p className="mt-1 text-gray-600">התחבר כדי לגשת ללוח הבקרה</p>
        </div>

        {!isOnline && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <p>אין חיבור לאינטרנט. אנא בדוק את החיבור שלך ונסה שוב.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {retryCount > 0 && retryCount < MAX_RETRIES && (
                <p className="text-sm mt-1">
                  ניסיון {retryCount} מתוך {MAX_RETRIES}
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              אימייל
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              required
              disabled={loading || !isOnline}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              required
              disabled={loading || !isOnline}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isOnline}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {retryCount > 0 ? `מנסה שוב... (${retryCount}/${MAX_RETRIES})` : 'מתחבר...'}
              </span>
            ) : (
              'התחבר'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
