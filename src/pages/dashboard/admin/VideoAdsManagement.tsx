import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Edit2, Trash2, Eye, EyeOff, Search, Filter, Plus, Save, X, Clock, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkAdminAccess } from '../../../lib/admin';

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
  created_at: string;
  creator: {
    id: string;
    name: string;
    avatar_url: string | null;
    category: string;
  } | null;
}

export function VideoAdsManagement() {
  const navigate = useNavigate();
  const [videoAds, setVideoAds] = useState<VideoAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [editingAd, setEditingAd] = useState<VideoAd | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    duration: '',
    requirements: '',
    active: true
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const checkAccess = async () => {
      const hasAccess = await checkAdminAccess();
      setIsAdmin(hasAccess);
      
      if (hasAccess) {
        fetchVideoAds();
        fetchCategories();
      } else {
        setLoading(false);
        toast.error('אין לך הרשאות גישה לדף זה');
        navigate('/dashboard/Joseph998');
      }
    };
    
    checkAccess();
  }, [navigate, refreshTrigger]);

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
        .map((cat: any) => cat.name);

      // If no categories defined, use default categories
      const defaultCategories = ['מוזיקאי', 'שחקן', 'קומיקאי', 'ספורטאי', 'משפיען', 'אמן'];
      
      // Map Hebrew categories to English for filtering
      const categoryMapping: Record<string, string> = {
        'מוזיקאי': 'musician',
        'שחקן': 'actor',
        'קומיקאי': 'comedian',
        'ספורטאי': 'athlete',
        'משפיען': 'influencer',
        'אמן': 'artist'
      };
      
      const englishCategories = (activeCategories.length > 0 ? activeCategories : defaultCategories)
        .map(cat => categoryMapping[cat] || cat);
      
      setCategories(['all', ...englishCategories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback to default categories
      setCategories(['all', 'musician', 'actor', 'comedian', 'athlete', 'influencer', 'artist']);
    }
  }

  async function fetchVideoAds() {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('video_ads')
        .select(`
          *,
          creator:creator_profiles(
            id,
            name,
            avatar_url,
            category
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideoAds(data || []);
    } catch (error) {
      console.error('Error fetching video ads:', error);
      toast.error('שגיאה בטעינת מודעות וידאו');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    try {
      const { error } = await supabase
        .from('video_ads')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentActive ? 'המודעה הושבתה בהצלחה' : 'המודעה הופעלה בהצלחה');
      
      // Update local state immediately
      setVideoAds(videoAds.map(ad => 
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
      setVideoAds(videoAds.filter(ad => ad.id !== id));
    } catch (error) {
      console.error('Error deleting video ad:', error);
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
      active: ad.active
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAd) return;

    try {
      // Format duration to ensure it's in the correct format
      let formattedDuration = formData.duration;
      if (!isNaN(parseInt(formData.duration))) {
        formattedDuration = `${formData.duration} hours`;
      }

      const { error } = await supabase
        .from('video_ads')
        .update({
          title: formData.title,
          description: formData.description,
          price: formData.price,
          duration: formattedDuration,
          requirements: formData.requirements,
          active: formData.active
        })
        .eq('id', editingAd.id);

      if (error) throw error;

      toast.success('המודעה עודכנה בהצלחה');
      
      // Update local state immediately
      setVideoAds(videoAds.map(ad => 
        ad.id === editingAd.id ? {
          ...ad,
          title: formData.title,
          description: formData.description,
          price: formData.price,
          duration: formattedDuration,
          requirements: formData.requirements,
          active: formData.active
        } : ad
      ));
      
      // Refresh data to ensure we have the latest state
      setRefreshTrigger(prev => prev + 1);
      
      setEditingAd(null);
    } catch (error) {
      console.error('Error updating video ad:', error);
      toast.error('שגיאה בעדכון המודעה');
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

  // Filter video ads based on search query, status filter, and category filter
  const filteredAds = videoAds.filter(ad => {
    const matchesSearch = 
      ad.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ad.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (ad.creator?.name.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && ad.active) || 
      (statusFilter === 'inactive' && !ad.active);
    
    const matchesCategory = 
      categoryFilter === 'all' || 
      ad.creator?.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין הרשאת גישה</h2>
          <p className="text-gray-600">אין לך הרשאות מנהל לצפות בדף זה.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול מודעות וידאו</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש מודעות..."
              className="pr-10 pl-4 py-2 border rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">כל הקטגוריות</option>
            {categories.filter(cat => cat !== 'all').map(category => (
              <option key={category} value={category}>
                {getCategoryNameInHebrew(category)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Edit Form */}
      {editingAd && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">עריכת מודעת וידאו</h2>
            <button
              onClick={() => setEditingAd(null)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">כותרת</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">תיאור</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">דרישות</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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
              >
                <Save className="h-4 w-4 inline-block ml-1" />
                שמור שינויים
              </button>
              <button
                type="button"
                onClick={() => setEditingAd(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Video Ads Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מודעה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">יוצר</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">קטגוריה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מחיר</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">זמן אספקה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAds.length > 0 ? (
                  filteredAds.map((ad) => (
                    <tr key={ad.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {ad.thumbnail_url ? (
                            <img
                              src={ad.thumbnail_url}
                              alt={ad.title}
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500">אין</span>
                            </div>
                          )}
                          <div className="mr-4">
                            <div className="text-sm font-medium text-gray-900">{ad.title}</div>
                            <div className="text-sm text-gray-500 line-clamp-1">{ad.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={ad.creator?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ad.creator?.name || 'Creator')}`}
                            alt={ad.creator?.name || 'Creator'}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <span className="mr-2 text-sm text-gray-900">{ad.creator?.name || 'יוצר לא ידוע'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {getCategoryNameInHebrew(ad.creator?.category || '')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₪{ad.price}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDeliveryTime(ad.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          ad.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {ad.active ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(ad)}
                            className="text-primary-600 hover:text-primary-900 ml-2"
                            title="ערוך"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(ad.id, ad.active)}
                            className={`${
                              ad.active ? 'text-gray-600 hover:text-gray-900' : 'text-green-600 hover:text-green-900'
                            } ml-2`}
                            title={ad.active ? 'השבת' : 'הפעל'}
                          >
                            {ad.active ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                          <button
                            onClick={() => handleDelete(ad.id)}
                            className="text-red-600 hover:text-red-900"
                            title="מחק"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      לא נמצאו מודעות וידאו התואמות את החיפוש
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
