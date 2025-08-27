import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Facebook, Globe, Twitter, Instagram, Youtube, Key } from 'lucide-react';
import { useCreatorStore } from '../../../stores/creatorStore';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { ChangePasswordForm } from '../../../components/ChangePasswordForm';

interface SocialLinks {
  website?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, fetchProfile, updateProfile } = useCreatorStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    bio: '',
    price: 0,
    social_links: {
      website: '',
      facebook: '',
      twitter: '',
      instagram: '',
      youtube: '',
    } as SocialLinks,
  });
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<{id: string, name: string, icon: string}[]>([]);

  useEffect(() => {
    checkAuth();
    loadProfile();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        category: profile.category || '',
        bio: profile.bio || '',
        price: profile.price || 0,
        social_links: {
          website: profile.social_links?.website || '',
          facebook: profile.social_links?.facebook || '',
          twitter: profile.social_links?.twitter || '',
          instagram: profile.social_links?.instagram || '',
          youtube: profile.social_links?.youtube || '',
        },
      });
    }
  }, [profile]);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('אנא התחבר כדי לגשת לפרופיל שלך');
      navigate('/login');
      return;
    }
  }

  async function loadProfile() {
    try {
      await fetchProfile();
    } catch (error) {
      console.error('שגיאה בטעינת הפרופיל:', error);
      toast.error('שגיאה בטעינת הפרופיל. אנא נסה שוב.');
    }
  }

  async function fetchCategories() {
    try {
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
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updatedFormData = {
        ...formData,
        price: Number(formData.price) || 0,
        social_links: {
          ...formData.social_links,
          facebook: formData.social_links.facebook?.trim() || '',
        },
      };
      await updateProfile(updatedFormData);
      toast.success('הפרופיל עודכן בהצלחה');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message || 'שגיאה בעדכון הפרופיל');
      if (error.message.includes('Please log in')) {
        navigate('/login');
      }
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      toast.loading('מעלה תמונה...', { id: 'upload' });

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('גודל הקובץ חייב להיות קטן מ-2MB');
        return;
      }

      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        toast.error('סוג הקובץ חייב להיות JPEG, PNG, WEBP או GIF');
        return;
      }

      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('אנא התחבר מחדש');
        navigate('/login');
        return;
      }

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${profile?.id}/${fileName}`;

      // Upload the file
      const { error: uploadError, data } = await supabase.storage
        .from('creator-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        toast.error(`שגיאה בהעלאת התמונה: ${uploadError.message}`, { id: 'upload' });
        return;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('creator-images')
        .getPublicUrl(filePath);

      // Update profile with the new image URL
      const updateData = type === 'avatar' 
        ? { avatar_url: publicUrl }
        : { banner_url: publicUrl };

      await updateProfile(updateData);
      toast.success(`ה${type === 'avatar' ? 'תמונה' : 'באנר'} עודכן בהצלחה`, { id: 'upload' });
      
      // Refresh profile to show the new image
      await fetchProfile();
    } catch (error: any) {
      console.error(`שגיאה בהעלאת ${type}:`, error);
      toast.error(`שגיאה בהעלאת ${type === 'avatar' ? 'תמונה' : 'באנר'}: ${error.message}`, { id: 'upload' });
    } finally {
      setUploading(false);
    }
  }

  const renderSocialLinkInput = (platform: keyof SocialLinks, icon: React.ReactNode, placeholder: string) => (
    <div className="flex items-center space-x-2">
      <div className="flex-shrink-0">
        {icon}
      </div>
      <input
        type="url"
        value={formData.social_links[platform] || ''}
        onChange={(e) => setFormData({
          ...formData,
          social_links: {
            ...formData.social_links,
            [platform]: e.target.value
          }
        })}
        disabled={!isEditing}
        placeholder={placeholder}
        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
        dir="ltr"
      />
    </div>
  );

  if (!profile && !isEditing) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">צור את הפרופיל שלך</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 mb-4">
            השלם את פרטי הפרופיל שלך כדי להתחיל לקבל בקשות ממעריצים.
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            צור פרופיל
          </button>
        </div>
      </div>
    );
  }

  if (showPasswordForm) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">שינוי סיסמה</h1>
          <button
            onClick={() => setShowPasswordForm(false)}
            className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            חזרה לפרופיל
          </button>
        </div>
        <ChangePasswordForm />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">הגדרות פרופיל</h1>
        <div className="flex space-x-4 space-x-reverse">
          <button
            onClick={() => setShowPasswordForm(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 ml-2"
            disabled={uploading}
          >
            <Key className="h-5 w-5 inline-block ml-1" />
            שינוי סיסמה
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            disabled={uploading}
          >
            {isEditing ? 'ביטול' : 'ערוך פרופיל'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}`}
                alt="תמונת פרופיל"
                className="h-32 w-32 rounded-lg object-cover"
              />
              {isEditing && (
                <label className="absolute bottom-0 right-0 cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'avatar')}
                    disabled={uploading}
                  />
                  <div className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50">
                    <Camera className="h-4 w-4" />
                  </div>
                </label>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {formData.name || 'השם שלך'}
              </h2>
              <p className="text-gray-500">{formData.category || 'בחר קטגוריה'}</p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">שם</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">קטגוריה</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">בחר קטגוריה</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name.toLowerCase() === 'מוזיקאי' ? 'musician' : 
                                                   category.name.toLowerCase() === 'שחקן' ? 'actor' : 
                                                   category.name.toLowerCase() === 'קומיקאי' ? 'comedian' : 
                                                   category.name.toLowerCase() === 'ספורטאי' ? 'athlete' : 
                                                   category.name.toLowerCase() === 'משפיען' ? 'influencer' : 
                                                   category.name.toLowerCase() === 'אמן' ? 'artist' : 
                                                   category.name.toLowerCase()}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">מחיר לבקשה</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₪</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  disabled={!isEditing}
                  className="pr-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">אודות</label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">קישורים חברתיים</h3>
              <div className="space-y-4">
                {renderSocialLinkInput('website', <Globe className="h-5 w-5 text-gray-400" />, 'קישור לאתר אינטרנט')}
                {renderSocialLinkInput('facebook', <Facebook className="h-5 w-5 text-blue-600" />, 'קישור לפייסבוק')}
                {renderSocialLinkInput('twitter', <Twitter className="h-5 w-5 text-blue-400" />, 'קישור לטוויטר')}
                {renderSocialLinkInput('instagram', <Instagram className="h-5 w-5 text-pink-600" />, 'קישור לאינסטגרם')}
                {renderSocialLinkInput('youtube', <Youtube className="h-5 w-5 text-red-600" />, 'קישור ליוטיוב')}
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  disabled={uploading}
                >
                  {uploading ? 'מעלה...' : 'שמור שינויים'}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
