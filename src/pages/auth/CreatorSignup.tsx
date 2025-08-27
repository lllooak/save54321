import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { SignupSuccessMessage } from '../../components/SignupSuccessMessage';
import { trackAffiliateSignup } from '../../utils/affiliate';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  icon: string;
}

export function CreatorSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      
      // Fetch categories from platform_config
      const { data: configData, error: configError } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'categories')
        .maybeSingle();

      if (configError) throw configError;

      // Get admin categories or use default if none exist
      const adminCategories = configData?.value?.categories || [];
      
      // Only use active categories
      const activeCategories = adminCategories
        .filter((cat: any) => cat.active)
        .sort((a: any, b: any) => a.order - b.order);

      // If no categories defined, use default categories
      const defaultCategories = [
        { id: '1', name: 'מוזיקאי', icon: '🎵' },
        { id: '2', name: 'שחקן', icon: '🎭' },
        { id: '3', name: 'קומיקאי', icon: '😂' },
        { id: '4', name: 'ספורטאי', icon: '⚽' },
        { id: '5', name: 'משפיען', icon: '📱' },
        { id: '6', name: 'אמן', icon: '🎨' }
      ];

      setCategories(activeCategories.length > 0 
        ? activeCategories.map((cat: any) => ({ id: cat.id, name: cat.name, icon: cat.icon }))
        : defaultCategories);
    } catch (error) {
      console.error('שגיאה בטעינת קטגוריות:', error);
      // Fallback to default categories
      setCategories([
        { id: '1', name: 'מוזיקאי', icon: '🎵' },
        { id: '2', name: 'שחקן', icon: '🎭' },
        { id: '3', name: 'קומיקאי', icon: '😂' },
        { id: '4', name: 'ספורטאי', icon: '⚽' },
        { id: '5', name: 'משפיען', icon: '📱' },
        { id: '6', name: 'אמן', icon: '🎨' }
      ]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            role: 'creator',
            category: getCategoryValue(form.category),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (authError) {
        throw authError;
      }

      // Create creator profile (user record will be created automatically by trigger)
      if (authData.user) {
        await createCreatorProfile(authData.user.id);
      }

      // Check if email confirmation is required
      if (authData.user && !authData.user.confirmed_at) {
        // Show success message with verification instructions
        setSignupComplete(true);
        toast.success('Registration successful! Please check your email to verify your account.');
      } else {
        // If email confirmation is not required, sign in the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        
        if (signInError) {
          throw signInError;
        }
        
        toast.success('Signup successful');
        navigate('/dashboard/creator');
      }
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };



  const createCreatorProfile = async (userId: string) => {
    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('creator_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      if (existingProfile) {
        console.log('Creator profile already exists');
        return;
      }
      
      // Create creator profile
      const { error: profileError } = await supabase
        .from('creator_profiles')
        .insert({
          id: userId,
          name: form.name,
          category: getCategoryValue(form.category),
          bio: '',
          price: 100, // Default price
          active: true
        });
        
      if (profileError) {
        console.error('Error creating creator profile:', profileError);
        throw profileError;
      }

      // Track affiliate signup if user came from referral link
      try {
        await trackAffiliateSignup(userId);
      } catch (affiliateError) {
        console.error('Error tracking affiliate signup:', affiliateError);
        // Don't throw error as this shouldn't block user registration
      }
    } catch (error) {
      console.error('Error in createCreatorProfile:', error);
    }
  };

  // Map Hebrew categories to English for database matching
  const getCategoryValue = (hebrewName: string): string => {
    const categoryMapping: Record<string, string> = {
      'מוזיקאי': 'musician',
      'שחקן': 'actor',
      'קומיקאי': 'comedian',
      'ספורטאי': 'athlete',
      'משפיען': 'influencer',
      'אמן': 'artist'
    };
    
    return categoryMapping[hebrewName] || hebrewName.toLowerCase();
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
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">הרשמה כיוצר</h2>
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
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                קטגוריה
              </label>
              {loadingCategories ? (
                <div className="mt-1 flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 ml-2"></div>
                  <span className="text-sm text-gray-500">טוען קטגוריות...</span>
                </div>
              ) : (
                <select
                  id="category"
                  name="category"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-right text-gray-900"
                  value={form.category}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">בחר קטגוריה</option>
                  {categories.map((category) => (
                    <option 
                      key={category.id} 
                      value={category.name}
                    >
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              )}
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
              disabled={loading || loadingCategories}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'נרשם...' : 'הרשמה כיוצר'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}