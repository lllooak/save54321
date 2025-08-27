import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { SignupSuccessMessage } from '../../components/SignupSuccessMessage';
import { trackAffiliateSignup } from '../../utils/affiliate';
import toast from 'react-hot-toast';

export function FanSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // Register the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.name,
            role: 'fan',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (authError) {
        throw authError;
      }

      // Check if email confirmation is required
      if (authData.user && !authData.user.confirmed_at) {
        // Show success message with verification instructions
        setSignupComplete(true);
        toast.success('Registration successful! Please check your email to verify your account.');
      } else {
        // If email confirmation is not required, create user record
        await createUserRecord(authData.user?.id);
        toast.success('Signup successful');
        navigate('/dashboard/fan');
      }
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const createUserRecord = async (userId: string | undefined) => {
    if (!userId) return;
    
    try {
      // Create user record if it doesn't exist
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: form.email,
          name: form.name,
          role: 'user'
        });
        
      if (userError) {
        console.error('Error creating user record:', userError);
        return;
      }

      // Track affiliate signup if user came from referral link
      try {
        console.log('[SIGNUP DEBUG] Attempting to track affiliate signup for user:', userId);
        const affiliateResult = await trackAffiliateSignup(userId);
        console.log('[SIGNUP DEBUG] Affiliate tracking result:', affiliateResult);
      } catch (affiliateError) {
        console.error('[SIGNUP DEBUG] Error tracking affiliate signup:', affiliateError);
        // Don't throw error as this shouldn't block user registration
      }
    } catch (error) {
      console.error('Error in createUserRecord:', error);
    }
  };

  if (signupComplete) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">הרשמה הושלמה</h2>
          </div>
          
          <SignupSuccessMessage email={form.email} />
          
          <div className="text-center">
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              חזור לדף ההתחברות
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">הרשמה כמעריץ</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            כבר יש לך חשבון?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              התחבר
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                שם מלא
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-right text-gray-900"
                value={form.name}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                כתובת אימייל
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-right text-gray-900"
                value={form.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                סיסמה
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-right text-gray-900"
                value={form.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                אימות סיסמה
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-right text-gray-900"
                value={form.confirm}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'נרשם...' : 'הרשמה כמעריץ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}