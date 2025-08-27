import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Calendar, Mail, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  email: string;
  name: string;
  birth_date: string | null;
  avatar_url: string | null;
  bio: string | null;
  metadata: {
    location?: string;
    interests?: string[];
    language?: string;
  };
}

export function FanProfile({ userId }: { userId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    bio: '',
    location: '',
    interests: [] as string[],
    language: 'he',
  });

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      toast.error('נדרש מזהה משתמש');
      return;
    }
    fetchProfile();
  }, [userId]);

  async function fetchProfile() {
    try {
      if (!userId) {
        throw new Error('נדרש מזהה משתמש');
      }

      // First, get the user's auth data to ensure we have the latest information
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      
      // Then get the user's profile data from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError && userError.code !== 'PGRST116') throw userError;

      // Combine auth data with profile data
      const combinedProfile: Profile = {
        id: userId,
        email: authUser?.email || '',
        name: userData?.name || authUser?.user_metadata?.name || '',
        birth_date: userData?.birth_date || authUser?.user_metadata?.birth_date || null,
        avatar_url: userData?.avatar_url || authUser?.user_metadata?.avatar_url || null,
        bio: userData?.bio || authUser?.user_metadata?.bio || null,
        metadata: userData?.metadata || {}
      };
      
      setProfile(combinedProfile);

      setFormData({
        name: combinedProfile.name || '',
        birth_date: combinedProfile.birth_date || '',
        bio: combinedProfile.bio || '',
        location: combinedProfile.metadata?.location || '',
        interests: combinedProfile.metadata?.interests || [],
        language: combinedProfile.metadata?.language || 'he',
      });
    } catch (error) {
      console.error('שגיאה בטעינת פרופיל:', error);
      toast.error('שגיאה בטעינת פרופיל');
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
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
        return;
      }

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${profile?.id}/${fileName}`;

      // Upload the file
      const { error: uploadError, data } = await supabase.storage
        .from('profile-images')
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
        .from('profile-images')
        .getPublicUrl(filePath);

      // Update auth metadata
      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateAuthError) {
        console.error('Error updating auth metadata:', updateAuthError);
      }

      // Update user profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        toast.error(`שגיאה בעדכון הפרופיל: ${updateError.message}`, { id: 'upload' });
        return;
      }

      toast.success('התמונה הועלתה בהצלחה', { id: 'upload' });
      
      // Update local profile state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      
      // Refresh profile data
      fetchProfile();
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(`שגיאה בהעלאת התמונה: ${error.message}`, { id: 'upload' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!userId) {
      toast.error('נדרש מזהה משתמש לעדכון הפרופיל');
      return;
    }

    try {
      // Update auth metadata
      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: {
          name: formData.name,
          birth_date: formData.birth_date,
          bio: formData.bio
        }
      });

      if (updateAuthError) throw updateAuthError;

      // First check if the user exists in the users table
      const { data: userExists, error: userCheckError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .maybeSingle();

      if (userCheckError) {
        throw userCheckError;
      }

      // Get the current user's email from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (!user?.email) {
        throw new Error('נדרש אימייל משתמש');
      }

      if (!userExists) {
        // Create the user record if it doesn't exist
        const { error: createError } = await supabase
          .from('users')
          .insert([{ 
            id: userId,
            email: user.email, // Include email when creating new user
            name: formData.name,
            birth_date: formData.birth_date || null,
            bio: formData.bio || null,
            metadata: {
              location: formData.location || null,
              interests: formData.interests,
              language: formData.language,
            }
          }]);

        if (createError) {
          throw createError;
        }
      } else {
        // Update existing user record
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: formData.name,
            birth_date: formData.birth_date || null,
            bio: formData.bio || null,
            metadata: {
              location: formData.location || null,
              interests: formData.interests,
              language: formData.language,
            }
          })
          .eq('id', userId);

        if (updateError) throw updateError;
      }

      toast.success('הפרופיל עודכן בהצלחה');
      setIsEditing(false);
      await fetchProfile(); // רענן את נתוני הפרופיל
    } catch (error) {
      console.error('שגיאה בעדכון הפרופיל:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('שגיאה בעדכון הפרופיל');
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">נדרש מזהה משתמש</h2>
          <p className="text-gray-600">אנא ודא שאתה מחובר כראוי.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">הפרופיל לא נמצא</h2>
          <p className="text-gray-600">אנא השלם את פרטי הפרופיל שלך להלן.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow" dir="rtl">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">פרטי פרופיל</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          disabled={uploading}
        >
          {isEditing ? 'ביטול' : 'ערוך פרופיל'}
        </button>
      </div>

      <div className="p-6">
        {/* Profile Avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <img
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'User')}&size=150`}
              alt="תמונת פרופיל"
              className="h-32 w-32 rounded-full object-cover border-4 border-white shadow"
            />
            <label className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full cursor-pointer hover:bg-primary-700">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
              <Camera className="h-4 w-4" />
            </label>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">שם</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">תאריך לידה</label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">אודות</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">מיקום</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">שפה</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="he">עברית</option>
                <option value="en">אנגלית</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 ml-3"
                disabled={uploading}
              >
                שמור שינויים
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={uploading}
              >
                ביטול
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center">
              <User className="h-5 w-5 text-gray-400 ml-3" />
              <div>
                <p className="text-sm font-medium text-gray-500">שם</p>
                <p className="text-base text-gray-900">{profile?.name || 'לא הוגדר'}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 ml-3" />
              <div>
                <p className="text-sm font-medium text-gray-500">תאריך לידה</p>
                <p className="text-base text-gray-900">
                  {profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString() : 'לא הוגדר'}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <Mail className="h-5 w-5 text-gray-400 ml-3" />
              <div>
                <p className="text-sm font-medium text-gray-500">אימייל</p>
                <p className="text-base text-gray-900">{profile?.email}</p>
              </div>
            </div>

            {profile?.bio && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm font-medium text-gray-500">אודות</p>
                <p className="mt-1 text-base text-gray-900">{profile.bio}</p>
              </div>
            )}

            {profile?.metadata?.location && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-500">מיקום</p>
                <p className="mt-1 text-base text-gray-900">{profile.metadata.location}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
