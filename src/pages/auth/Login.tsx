import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { sendPasswordResetEmail } from '../../lib/emailService';
import { SignupSuccessMessage } from '../../components/SignupSuccessMessage';

export function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [cooldownTime, setCooldownTime] = useState(0);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });
  const [resetPasswordStatus, setResetPasswordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Check for query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const needsVerification = params.get('verification');
    const email = params.get('email');
    
    if (needsVerification === 'true' && email) {
      setShowVerificationMessage(true);
      setVerificationEmail(email);
      setFormData(prev => ({ ...prev, email }));
    }
  }, []);

  // Countdown timer for cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldownTime > 0) {
      timer = setInterval(() => {
        setCooldownTime(time => time - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldownTime]);

  const validateForm = () => {
    const newErrors = {
      email: '',
      password: '',
    };
    let isValid = true;

    if (!formData.email) {
      newErrors.email = 'אימייל הוא שדה חובה';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'אנא הזן כתובת אימייל תקינה';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'סיסמה היא שדה חובה';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const validateEmailForReset = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.\S+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'אנא הזן כתובת אימייל תקינה' };
    }

    // Check for invalid domains
    const invalidDomains = ['example.com', 'test.com', 'demo.com', 'sample.com', 'fake.com', 'invalid.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (invalidDomains.includes(domain)) {
      return { 
        isValid: false, 
        message: 'אנא השתמש בכתובת אימייל אמיתית (לא כתובת דמה או לדוגמה)' 
      };
    }

    return { isValid: true, message: '' };
  };

  const handlePasswordReset = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if we're in cooldown period
    if (cooldownTime > 0) {
      toast.error(`אנא המתן ${cooldownTime} שניות לפני נסיון נוסף`);
      return;
    }
    
    if (!formData.email) {
      setErrors({ ...errors, email: 'אנא הכנס כתובת אימייל לאיפוס סיסמה' });
      return;
    }

    // Validate email for password reset
    const emailValidation = validateEmailForReset(formData.email);
    if (!emailValidation.isValid) {
      setErrors({ ...errors, email: emailValidation.message });
      return;
    }

    setIsLoading(true);
    setResetPasswordStatus('loading');
    setResetPasswordError(null);
    
    // Set a minimum cooldown to prevent rapid requests
    setCooldownTime(30); // 30 seconds initial cooldown
    
    try {
      console.log('Sending password reset email to:', formData.email);
      
      // Try using the edge function
      const result = await sendPasswordResetEmail(formData.email);
      
      if (result.success) {
        setResetPasswordStatus('success');
        toast.success('נשלח אימייל עם הוראות לאיפוס סיסמה. אנא בדוק את תיבת הדואר שלך (כולל תיקיית הספאם).', { duration: 8000 });
        setIsResettingPassword(false);
        // Reset cooldown on success
        setCooldownTime(0);
      } else {
        setResetPasswordStatus('error');
        setResetPasswordError(result.error?.message || 'שגיאה בשליחת אימייל איפוס סיסמה');
        
        // Set extended cooldown for any error
        setCooldownTime(300); // 5 minutes
        
        if (result.error?.isRateLimit) {
          toast.error('יותר מדי בקשות. אנא המתן 5 דקות ונסה שוב.');
        } else if (result.error?.isTimeoutError) {
          toast.error('בקשת איפוס הסיסמה נכשלה בשל זמן תגובה ארוך. אנא נסה שוב מאוחר יותר.');
        } else if (result.error?.isServiceError) {
          toast.error('שירות האימייל אינו זמין כרגע. אנא נסה שוב מאוחר יותר.');
        } else if (result.error?.isValidationError) {
          toast.error(result.error.message || 'כתובת אימייל לא תקינה');
        } else {
          toast.error('שגיאת רשת או שירות. אנא בדוק את החיבור לאינטרנט ונסה שוב מאוחר יותר.');
        }
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      setResetPasswordStatus('error');
      setResetPasswordError(error.message || 'שגיאה בלתי צפויה');
      toast.error(error.message || 'שגיאה בלתי צפויה');
      
      // Set cooldown if it's a rate limit error
      if (error.message && (error.message.includes('rate limit') || error.message.includes('security purposes') || error.message.includes('המתן'))) {
        setCooldownTime(300);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if we're in cooldown period
    if (cooldownTime > 0) {
      toast.error(`אנא המתן ${cooldownTime} שניות לפני נסיון נוסף`);
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (signInError) {
        if (signInError.message.includes('schema')) {
          throw new Error('שגיאת מערכת. אנא נסה שוב מאוחר יותר');
        }
        
        // Check if it's a rate limit error
        if (signInError.message.includes('rate limit') || signInError.message.includes('security purposes')) {
          setCooldownTime(30); // Set 30 second cooldown
          throw new Error('נא להמתין 30 שניות לפני נסיון נוסף');
        }
        
        handleAuthError(signInError);
        setIsLoading(false);
        return;
      }

      if (!user) {
        toast.error('לא ניתן להתחבר כרגע. אנא נסה שוב מאוחר יותר.');
        setIsLoading(false);
        return;
      }

      try {
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id, role, status, login_count, name')
          .eq('id', user.id)
          .maybeSingle();

        if (userCheckError) {
          if (userCheckError.message.includes('schema')) {
            throw new Error('שגיאת מערכת. אנא נסה שוב מאוחר יותר');
          }
          console.error('Error checking user:', userCheckError);
          toast.error('שגיאה באימות משתמש. אנא נסה שוב.');
          setIsLoading(false);
          return;
        }

        if (!existingUser) {
          // Create the user record if it doesn't exist
          const userRole = user.user_metadata?.role || 'user';
          const { error: createError } = await supabase
            .from('users')
            .insert([{ 
              id: user.id,
              email: user.email,
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              role: userRole,
              status: 'active',
              wallet_balance: 0,
              login_count: 1,
              failed_login_attempts: 0,
              metadata: {}
            }]);

          if (createError) {
            if (createError.message.includes('schema')) {
              throw new Error('שגיאת מערכת. אנא נסה שוב מאוחר יותר');
            }
            console.error('Error creating user record:', createError);
            toast.error('שגיאה ביצירת פרופיל משתמש. אנא נסה שוב.');
            
            // Sign out the user since we couldn't create their profile
            await supabase.auth.signOut();
            setIsLoading(false);
            return;
          }
          
          // Redirect to the appropriate dashboard based on the user role
          toast.success('התחברת בהצלחה');
          if (userRole === 'creator') {
            // Create creator profile if it doesn't exist
            const { error: createProfileError } = await supabase
              .from('creator_profiles')
              .insert({
                id: user.id,
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'Creator',
                category: user.user_metadata?.category || 'artist',
                bio: '',
                price: 100, // Default price
                active: true
              });
              
            if (createProfileError) {
              console.error('Error creating creator profile:', createProfileError);
              navigate('/dashboard/fan');
            } else {
              navigate('/dashboard/creator');
            }
          } else if (userRole === 'admin') {
            navigate('/dashboard/Joseph999');
          } else {
            navigate('/dashboard/fan');
          }
          return;
        }

        // Update login stats
        const { error: updateError } = await supabase
          .from('users')
          .update({
            last_sign_in_at: new Date().toISOString(),
            login_count: (existingUser?.login_count || 0) + 1,
            failed_login_attempts: 0 // Reset failed attempts on successful login
          })
          .eq('id', user.id);

        if (updateError && !updateError.message.includes('schema')) {
          console.error('Error updating user login info:', updateError);
        }

        // Use metadata role as the authoritative source, fallback to database role
        const metadataRole = user.user_metadata?.role;
        const databaseRole = existingUser?.role;
        const userRole = metadataRole || databaseRole || 'user';
        
        console.log('Using role:', userRole, '(metadata:', metadataRole, ', database:', databaseRole, ')');
        
        toast.success('התחברת בהצלחה');
        
        if (userRole === 'admin') {
          navigate('/dashboard/Joseph999');
        } else if (userRole === 'creator') {
          // Check if the user has a creator profile
          const { data: creatorProfile, error: creatorError } = await supabase
            .from('creator_profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (creatorError) {
            console.error('Error checking creator profile:', creatorError);
          }

          // If they have a creator profile, send them to creator dashboard, otherwise to fan dashboard
          if (creatorProfile) {
            navigate('/dashboard/creator');
          } else {
            // Create a creator profile if it doesn't exist
            const { error: createProfileError } = await supabase
              .from('creator_profiles')
              .insert({
                id: user.id,
                name: user.user_metadata?.name || existingUser.name || 'Creator',
                category: user.user_metadata?.category || 'artist',
                bio: '',
                price: 100, // Default price
                active: true
              });
              
            if (createProfileError) {
              console.error('Error creating creator profile:', createProfileError);
              navigate('/dashboard/fan');
            } else {
              navigate('/dashboard/creator');
            }
          }
        } else {
          navigate('/dashboard/fan');
        }
      } catch (error: any) {
        console.error('Database operation error:', error);
        toast.error(error.message || 'שגיאת מערכת. אנא נסה שוב מאוחר יותר');
        
        // Sign out the user if there was an error
        await supabase.auth.signOut();
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'אירעה שגיאה בלתי צפויה. אנא נסה שוב מאוחר יותר.');
      
      // Set cooldown if it's a rate limit error
      if (error.message && (error.message.includes('rate limit') || error.message.includes('security purposes') || error.message.includes('המתן'))) {
        setCooldownTime(30);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthError = (error: any) => {
    if (error.message.includes('Invalid login credentials')) {
      toast.error('פרטי ההתחברות שגויים. אנא בדוק את האימייל והסיסמה שלך.');
      setErrors({
        email: 'פרטי ההתחברות שגויים',
        password: 'פרטי ההתחברות שגויים'
      });
    } else if (error.message.includes('Email not confirmed')) {
      toast.error('כתובת האימייל שלך טרם אומתה. אנא בדוק את תיבת הדואר שלך לקבלת הוראות אימות.');
      setShowVerificationMessage(true);
      setVerificationEmail(formData.email);
    } else if (error.message.includes('Too many requests')) {
      toast.error('יותר מדי ניסיונות התחברות. אנא המתן מספר דקות ונסה שוב.');
    } else {
      toast.error('שגיאה בהתחברות. אנא נסה שוב.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: '' });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
            <LogIn className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isResettingPassword ? 'איפוס סיסמה' : 'התחבר לחשבון שלך'}
          </h2>
          {!isResettingPassword && (
            <p className="mt-2 text-center text-sm text-gray-600">
              או{' '}
              <Link to="/signup/fan" className="font-medium text-primary-600 hover:text-primary-500">
                הרשמה כמעריץ
              </Link>
              {' '}או{' '}
              <Link to="/signup/creator" className="font-medium text-primary-600 hover:text-primary-500">
                הרשמה כיוצר
              </Link>
            </p>
          )}
        </div>
        
        {showVerificationMessage && (
          <SignupSuccessMessage email={verificationEmail} />
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                כתובת אימייל
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm text-right`}
                placeholder="כתובת אימייל"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading || cooldownTime > 0}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>
            {!isResettingPassword && (
              <div>
                <label htmlFor="password" className="sr-only">
                  סיסמה
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm text-right`}
                  placeholder="סיסמה"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading || cooldownTime > 0}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>
            )}
          </div>

          {!isResettingPassword && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ml-2"
                />
                <label htmlFor="remember-me" className="block text-sm text-gray-900">
                  זכור אותי
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setIsResettingPassword(true)}
                  className="font-medium text-primary-600 hover:text-primary-500"
                >
                  שכחת סיסמה?
                </button>
              </div>
            </div>
          )}

          <div>
            {isResettingPassword ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  <p>הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.</p>
                  <p className="mt-2 text-xs text-gray-500">
                    הקפד להשתמש בכתובת אימייל אמיתית (לא כתובת דמה או לדוגמה).
                  </p>
                </div>
                
                {resetPasswordStatus === 'error' && resetPasswordError && (
                  <div className="bg-red-50 text-red-700 p-4 rounded-md">
                    <p>{resetPasswordError}</p>
                  </div>
                )}
                
                {resetPasswordStatus === 'success' && (
                  <div className="bg-green-50 text-green-700 p-4 rounded-md">
                    <p>נשלח אימייל עם הוראות לאיפוס סיסמה. אנא בדוק את תיבת הדואר שלך (כולל תיקיית הספאם).</p>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={isLoading || cooldownTime > 0 || resetPasswordStatus === 'loading'}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading || resetPasswordStatus === 'loading' ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white\" xmlns="http://www.w3.org/2000/svg\" fill="none\" viewBox="0 0 24 24">
                        <circle className="opacity-25\" cx="12\" cy="12\" r="10\" stroke="currentColor\" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      שולח...
                    </span>
                  ) : cooldownTime > 0 ? (
                    `אנא המתן ${Math.floor(cooldownTime / 60)}:${(cooldownTime % 60).toString().padStart(2, '0')}`
                  ) : (
                    'שלח קישור לאיפוס סיסמה'
                  )}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResettingPassword(false);
                      setErrors({ email: '', password: '' });
                      setResetPasswordStatus('idle');
                      setResetPasswordError(null);
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    חזור להתחברות
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isLoading || cooldownTime > 0}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white\" xmlns="http://www.w3.org/2000/svg\" fill="none\" viewBox="0 0 24 24">
                      <circle className="opacity-25\" cx="12\" cy="12\" r="10\" stroke="currentColor\" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    מתחבר...
                  </span>
                ) : cooldownTime > 0 ? (
                  `אנא המתן ${cooldownTime} שניות`
                ) : (
                  'התחבר'
                )}
              </button>
            )}
          </div>

          <div className="text-center space-y-2">
            <div className="text-sm text-gray-500 pt-4 border-t border-gray-200 mt-4">
              <Link to="/dashboard/Joseph998" className="font-medium text-primary-600 hover:text-primary-500">
                כניסת מנהל מערכת
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}