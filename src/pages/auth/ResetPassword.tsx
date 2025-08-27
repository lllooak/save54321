import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, handleAuthCallback } from '../../lib/supabase';
import { Key, Loader, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasResetToken, setHasResetToken] = useState(false);

  useEffect(() => {
    const checkResetToken = async () => {
      try {
        setCheckingSession(true);
        
        // Handle hash fragment directly
        if (location.hash && location.hash.includes('access_token')) {
          console.log('Processing hash fragment with tokens');
          
          // Extract tokens from hash
          const hashParams = new URLSearchParams(location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const tokenType = hashParams.get('type');
          
          if (accessToken && refreshToken && tokenType === 'recovery') {
            console.log('Found recovery tokens in hash, setting session');
            
            try {
              // Set the session with the tokens
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (error) {
                console.error('Error setting session from hash tokens:', error);
                setError('שגיאה באימות הקישור לאיפוס הסיסמה');
                setHasResetToken(false);
              } else {
                console.log('Session set successfully from hash tokens');
                setHasResetToken(true);
                
                // Clean up the URL by removing the hash
                window.history.replaceState(null, '', location.pathname);
              }
            } catch (sessionError) {
              console.error('Exception setting session:', sessionError);
              setError('שגיאה בעיבוד נתוני האימות');
              setHasResetToken(false);
            }
            
            setCheckingSession(false);
            return;
          }
        }
        
        // If no hash with tokens, check for a valid session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('User has an active session');
          setHasResetToken(true);
          setCheckingSession(false);
          return;
        }
        
        // If we get here, we don't have a valid token or session
        console.log('No valid token or session found');
        setError('הקישור לאיפוס הסיסמה אינו תקף או שפג תוקפו');
        setHasResetToken(false);
        setCheckingSession(false);
      } catch (error) {
        console.error('Error checking reset token:', error);
        setError('שגיאה בבדיקת טוקן איפוס הסיסמה');
        setHasResetToken(false);
        setCheckingSession(false);
      }
    };
    
    checkResetToken();
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        console.error('Error updating password:', error);
        throw error;
      }
      
      // Mark as success immediately to prevent further token checks
      setSuccess(true);
      toast.success('הסיסמה עודכנה בהצלחה!');
      
      // Sign out the user to force a new login with the new password
      await supabase.auth.signOut();
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setError(error.message || 'שגיאה באיפוס הסיסמה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <Loader className="h-16 w-16 text-primary-600 mx-auto animate-spin" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">טוען...</h2>
            <p className="mt-2 text-gray-600">אנא המתן בזמן שאנו מעבדים את הבקשה שלך.</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">הסיסמה עודכנה בהצלחה!</h2>
            <p className="mt-2 text-gray-600">הסיסמה שלך עודכנה בהצלחה. אתה מועבר לדף ההתחברות...</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                חזרה לדף ההתחברות
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasResetToken && !success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">קישור לא תקף</h2>
            <p className="mt-2 text-gray-600">{error || 'הקישור לאיפוס הסיסמה אינו תקף או שפג תוקפו.'}</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                חזרה לדף ההתחברות
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Key className="h-12 w-12 text-primary-600 mx-auto" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">איפוס סיסמה</h2>
          <p className="mt-2 text-gray-600">אנא הזן את הסיסמה החדשה שלך</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              סיסמה חדשה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              required
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              אימות סיסמה
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              required
              disabled={loading}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center">
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                מעבד...
              </span>
            ) : (
              'עדכן סיסמה'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}