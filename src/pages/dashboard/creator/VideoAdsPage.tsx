import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Plus, Edit2, Trash2, Eye, EyeOff, Upload, User, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface VideoAd {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  thumbnail_url: string | null;
  sample_video_url: string | null;
  requirements: string | null;
  active: boolean;
  creator: {
    id: string;
    name: string;
    avatar_url: string | null;
    category: string;
  } | null;
}

export function VideoAdsPage() {
  const navigate = useNavigate();
  const [ads, setAds] = useState<VideoAd[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAd, setEditingAd] = useState<VideoAd | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [useProfileImage, setUseProfileImage] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRequirementsGuidelines, setShowRequirementsGuidelines] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    duration: '24',
    thumbnail_url: '',
    sample_video_url: '',
    requirements: '',
    active: true,
  });

  useEffect(() => {
    fetchAds();
    fetchCreatorProfile();
  }, [refreshTrigger]);

  // Set up a refresh interval to periodically check for updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 60000); // Refresh every minute
    
    return () => clearInterval(intervalId);
  }, []);

  // Update isEditing state when editingAd changes
  useEffect(() => {
    setIsEditing(editingAd !== null);
  }, [editingAd]);

  useEffect(() => {
    // When useProfileImage changes, update the thumbnail URL
    if (useProfileImage && creatorProfile?.avatar_url) {
      setFormData(prev => ({
        ...prev,
        thumbnail_url: creatorProfile.avatar_url
      }));
      setThumbnailPreview(creatorProfile.avatar_url);
    } else if (!useProfileImage && !thumbnailFile) {
      // If not using profile image and no file is selected, clear the preview
      setThumbnailPreview(formData.thumbnail_url || null);
    }
  }, [useProfileImage, creatorProfile]);

  async function fetchCreatorProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setCreatorProfile(data);
      
      // Set profile image as default when creating new ad and profile image exists
      if (data?.avatar_url && (isCreating || !editingAd) && !useProfileImage && !thumbnailFile) {
        setUseProfileImage(true);
        setFormData(prev => ({
          ...prev,
          thumbnail_url: data.avatar_url
        }));
        setThumbnailPreview(data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching creator profile:', error);
    }
  }

  async function fetchAds() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAds([]); // Clear existing ads
        toast.error('לא מחובר');
        navigate('/login');
        return; // Stop execution if not logged in
      }

      const { data, error } = await supabase
        .from('video_ads')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (error) {
      console.error('שגיאה בטעינת מודעות:', error);
      toast.error('שגיאה בטעינת מודעות');
    } finally {
      setLoading(false);
    }
  }

  async function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset useProfileImage when a file is selected
    setUseProfileImage(false);
    setThumbnailFile(file);
    
    // Create a preview URL
    const previewUrl = URL.createObjectURL(file);
    setThumbnailPreview(previewUrl);
  }

  async function uploadThumbnail() {
    if (!thumbnailFile) return null;
    
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = thumbnailFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('video-thumbnails')
        .upload(filePath, thumbnailFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('video-thumbnails')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      toast.error('שגיאה בהעלאת תמונה ממוזערת');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('לא מחובר');
        return;
      }

      // Handle thumbnail upload if needed
      let thumbnailUrl = formData.thumbnail_url;
      if (thumbnailFile && !useProfileImage) {
        const uploadedUrl = await uploadThumbnail();
        if (uploadedUrl) {
          thumbnailUrl = uploadedUrl;
        } else {
          return; // Exit if thumbnail upload failed
        }
      } else if (useProfileImage && creatorProfile?.avatar_url) {
        thumbnailUrl = creatorProfile.avatar_url;
      }

      // Format duration to ensure it's in the correct format
      let formattedDuration = formData.duration;
      if (!isNaN(parseInt(formData.duration))) {
        formattedDuration = `${formData.duration} hours`;
      }

      if (editingAd) {
        // Update existing ad
        const { error } = await supabase
          .from('video_ads')
          .update({
            title: formData.title,
            description: formData.description,
            price: formData.price,
            duration: formattedDuration,
            thumbnail_url: thumbnailUrl,
            sample_video_url: formData.sample_video_url,
            requirements: formData.requirements,
            active: formData.active
          })
          .eq('id', editingAd.id);

        if (error) throw error;

        toast.success('המודעה עודכנה בהצלחה');
        
        // Update local state immediately
        setAds(ads.map(ad => 
          ad.id === editingAd.id ? {
            ...ad,
            title: formData.title,
            description: formData.description,
            price: formData.price,
            duration: formattedDuration,
            thumbnail_url: thumbnailUrl,
            sample_video_url: formData.sample_video_url,
            requirements: formData.requirements,
            active: formData.active
          } : ad
        ));
        
        setEditingAd(null);
      } else {
        // Create new ad
        const { data, error } = await supabase
          .from('video_ads')
          .insert({
            creator_id: user.id,
            title: formData.title,
            description: formData.description,
            price: formData.price,
            duration: formattedDuration,
            thumbnail_url: thumbnailUrl,
            sample_video_url: formData.sample_video_url,
            requirements: formData.requirements,
            active: formData.active
          })
          .select()
          .single();

        if (error) throw error;

        toast.success('המודעה נוצרה בהצלחה');
        
        // Add new ad to local state
        setAds(prevAds => [data, ...prevAds]);
        
        setIsCreating(false);
      }
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        price: 0,
        duration: '24',
        thumbnail_url: '',
        sample_video_url: '',
        requirements: '',
        active: true,
      });
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setUseProfileImage(false);
      setShowRequirementsGuidelines(false);
      
      // Refresh data to ensure we have the latest state
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error('Error with video ad:', error);
      toast.error(editingAd ? 'שגיאה בעדכון המודעה' : 'שגיאה ביצירת המודעה');
    } finally {
      setLoading(false);
    }
  }

  // Function to format delivery time to show only hours
  const formatDeliveryTime = (duration: string) => {
    if (!duration) return '';
    
    // If it's already in the format "X hours", extract the hours
    if (duration.includes('hours')) {
      const hours = duration.split(' ')[0];
      return `${hours} שעות`;
    }
    
    // If it's in the format "HH:MM:SS", extract the hours
    if (duration.includes(':')) {
      const hours = parseInt(duration.split(':')[0], 10);
      return `${hours} שעות`;
    }
    
    // If it's just a number, assume it's hours
    if (!isNaN(parseInt(duration, 10))) {
      return `${parseInt(duration, 10)} שעות`;
    }
    
    return duration;
  };

  const toggleRequirementsGuidelines = () => {
    setShowRequirementsGuidelines(!showRequirementsGuidelines);
  };

  // Get category name in Hebrew
  const getCategoryNameInHebrew = (category: string) => {
    const hebrewNames: Record<string, string> = {
      'musician': 'מוזיקאי',
      'actor': 'שחקן',
      'comedian': 'קומיקאי',
      'influencer': 'משפיען',
      'athlete': 'ספורטאי',
      'artist': 'אמן'
    };
    
    return hebrewNames[category] || category;
  };

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const { error } = await supabase
        .from('video_ads')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentActive ? 'המודעה הושבתה בהצלחה' : 'המודעה הופעלה בהצלחה');
      
      // Update local state immediately
      setAds(ads.map(ad => 
        ad.id === id ? { ...ad, active: !currentActive } : ad
      ));
      
      // Refresh data to ensure we have the latest state
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error toggling video ad status:', error);
      toast.error('שגיאה בעדכון סטטוס המודעה');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק מודעה זו?')) return;

    try {
      const { error } = await supabase
        .from('video_ads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('המודעה נמחקה בהצלחה');
      setAds(ads.filter(ad => ad.id !== id));
    } catch (error) {
      console.error('שגיאה במחיקת המודעה:', error);
      toast.error('שגיאה במחיקת המודעה');
    }
  }

  function handleEdit(ad: VideoAd) {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || '',
      price: ad.price,
      duration: ad.duration.includes('hours') ? ad.duration.split(' ')[0] : ad.duration,
      requirements: ad.requirements || '',
      thumbnail_url: ad.thumbnail_url || '',
      sample_video_url: ad.sample_video_url || '',
      active: ad.active
    });
    setThumbnailPreview(ad.thumbnail_url);
    setUseProfileImage(ad.thumbnail_url === creatorProfile?.avatar_url);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול מודעות וידאו</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          disabled={isEditing || isCreating}
        >
          <Plus className="h-5 w-5 ml-2" />
          יצירת מודעה חדשה
        </button>
      </div>

      {/* Form for creating/editing categories */}
      {(isCreating || editingAd) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingAd ? 'עריכת מודעה' : 'יצירת מודעה חדשה'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4" onReset={() => {
            // Set profile image as default when creating new ad
            if (!editingAd && creatorProfile?.avatar_url) {
              setUseProfileImage(true);
              setFormData(prev => ({
                ...prev,
                thumbnail_url: creatorProfile.avatar_url
              }));
              setThumbnailPreview(creatorProfile.avatar_url);
            }
          }}>
            <div>
              <label className="block text-sm font-medium text-gray-700">כותרת</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">תיאור</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">מחיר (₪)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  required
                  min="1"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">זמן אספקה (שעות)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  required
                  min="1"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">תמונה ממוזערת</label>
              <div className="space-y-4">
                {/* Option to use profile image with button */}
                {creatorProfile?.avatar_url && (
                  <div className="flex flex-col space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUseProfileImage(true);
                        setThumbnailFile(null);
                      }}
                      className={`flex items-center p-3 border rounded-lg ${useProfileImage ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:bg-gray-50'}`}
                      disabled={loading}
                    >
                      <img 
                        src={creatorProfile.avatar_url} 
                        alt="תמונת פרופיל" 
                        className="h-12 w-12 rounded-full object-cover ml-3"
                      />
                      <span className="text-sm font-medium">השתמש בתמונת הפרופיל שלי</span>
                    </button>
                  </div>
                )}

                {/* Option to upload custom image */}
                <div className={`${useProfileImage ? 'opacity-50' : ''}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    העלה תמונה ממוזערת
                  </label>
                  <div className="flex items-center">
                    <label className="cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                      <Upload className="h-4 w-4 inline-block ml-1" />
                      בחר קובץ
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        disabled={loading || useProfileImage}
                      />
                    </label>
                    <span className="mr-3 text-sm text-gray-500">
                      {thumbnailFile ? thumbnailFile.name : 'לא נבחר קובץ'}
                    </span>
                  </div>
                </div>

                {/* Preview */}
                {thumbnailPreview && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">תצוגה מקדימה:</p>
                    <img
                      src={thumbnailPreview}
                      alt="תצוגה מקדימה"
                      className="h-32 w-auto object-cover rounded-md"
                      onError={() => {
                        toast.error('שגיאה בטעינת התמונה');
                        setThumbnailPreview(null);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">דרישות</label>
                <button 
                  type="button" 
                  className="text-primary-600 text-sm flex items-center"
                  onClick={toggleRequirementsGuidelines}
                >
                  {showRequirementsGuidelines ? (
                    <>
                      <ChevronUp className="h-4 w-4 ml-1" />
                      הסתר הנחיות
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 ml-1" />
                      הנחיות לדרישות
                    </>
                  )}
                </button>
              </div>
              
              {showRequirementsGuidelines && (
                <div className="mb-2 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">הנחיות למילוי דרישות</h3>
                  <p>מומלץ לציין את הפרטים הבאים כדי שהמעריצים יידעו מה עליהם לכתוב בבקשה:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>שם מקבל הברכה</li>
                    <li>סיבת הברכה (יום הולדת, אירוע מיוחד וכו')</li>
                    <li>פרטים אישיים שיעזרו להפוך את הברכה למותאמת אישית</li>
                    <li>הטון המבוקש (מרגש, מצחיק, קליל, וכו')</li>
                    <li>פרטים על שולח הברכה</li>
                  </ul>
                  <p className="mt-2">דוגמה לדרישות שמעריצים נדרשים לספק:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>שם מלא של מקבל/ת הברכה</li>
                    <li>גיל (אם רלוונטי)</li> 
                    <li>האירוע (יום הולדת, חתונה, גיוס, וכו')</li>
                    <li>תחומי עניין/תחביבים של מקבל/ת הברכה</li>
                    <li>עובדות מיוחדות או משפטים שתרצו שיוזכרו בברכה</li>
                    <li>הטון המבוקש (מרגש, מצחיק, קליל, וכו')</li>
                  </ol>
                </div>
              )}
              
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={6}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="כתוב כאן את הדרישות והמידע שהמעריצים צריכים לספק כדי שתוכל להכין ברכה מותאמת אישית..."
                disabled={loading}
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 ml-2"
                />
                <span className="text-sm text-gray-700">פעיל</span>
              </label>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 ml-4"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {editingAd ? 'מעדכן...' : 'יוצר...'}
                  </span>
                ) : (
                  editingAd ? 'עדכן מודעה' : 'צור מודעה'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingAd(null);
                  setThumbnailFile(null);
                  setThumbnailPreview(null);
                  setUseProfileImage(false);
                  setShowRequirementsGuidelines(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : ads.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-lg shadow text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">אין מודעות וידאו</h3>
            <p className="text-gray-500 mb-4">עדיין לא יצרת מודעות וידאו. התחל ליצור מודעות כדי להציע את השירותים שלך.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="h-5 w-5 ml-2" />
              יצירת מודעה חדשה
            </button>
          </div>
        ) : (
          ads.map((ad) => (
            <div key={ad.id} className="bg-white rounded-lg shadow">
              {ad.thumbnail_url && (
                <img
                  src={ad.thumbnail_url}
                  alt={ad.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
              )}
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-900">{ad.title}</h3>
                  <span className="text-lg font-semibold text-primary-600">₪{ad.price}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{ad.description}</p>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <span>זמן אספקה: {formatDeliveryTime(ad.duration)}</span>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingAd(ad);
                        setFormData({
                          title: ad.title,
                          description: ad.description || '',
                          price: ad.price,
                          duration: ad.duration.split(' ')[0],
                          thumbnail_url: ad.thumbnail_url || '',
                          sample_video_url: ad.sample_video_url || '',
                          requirements: ad.requirements || '',
                          active: ad.active,
                        });
                        setThumbnailPreview(ad.thumbnail_url);
                        setUseProfileImage(ad.thumbnail_url === creatorProfile?.avatar_url);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-500"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(ad.id)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => toggleActive(ad.id, ad.active)}
                    className={`flex items-center px-3 py-1 rounded-full text-sm ${
                      ad.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {ad.active ? (
                      <>
                        <Eye className="h-4 w-4 ml-1" />
                        פעיל
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 ml-1" />
                        לא פעיל
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
