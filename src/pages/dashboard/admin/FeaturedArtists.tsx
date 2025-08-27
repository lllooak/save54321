import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Star, Search, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Creator {
  id: string;
  name: string;
  category: string;
  avatar_url: string | null;
  featured: boolean;
}

export function FeaturedArtists() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreators();
    fetchFeaturedCreators();
  }, []);

  async function fetchCreators() {
    try {
      setLoading(true);
      
      // Fetch all creator profiles
      const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .order('name');

      if (error) throw error;
      
      // Filter out inactive creators and creators from banned users
      const creatorIds = data?.map(creator => creator.id) || [];
      
      if (creatorIds.length === 0) {
        setCreators([]);
        setLoading(false);
        return;
      }
      
      // Get user status for all creators
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, status')
        .in('id', creatorIds);
        
      if (usersError) throw usersError;
      
      // Create a map of user IDs to their status
      const userStatusMap = new Map();
      usersData?.forEach(user => {
        userStatusMap.set(user.id, user.status);
      });
      
      // Filter out creators with banned status and inactive creators
      const activeCreators = (data || []).filter(creator => {
        const status = userStatusMap.get(creator.id);
        return status === 'active' && creator.active !== false;
      });
      
      setCreators(activeCreators);
    } catch (error) {
      console.error('שגיאה בטעינת יוצרים:', error);
      toast.error('שגיאה בטעינת יוצרים');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFeaturedCreators() {
    try {
      const { data: existingConfig, error: fetchError } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'featured_creators')
        .maybeSingle();

      if (fetchError) throw fetchError;

      // If config exists, use it; otherwise use empty array
      const creatorIds = existingConfig?.value?.creator_ids || [];
      setFeaturedCreators(creatorIds);
    } catch (error) {
      console.error('שגיאה בטעינת יוצרים מובילים:', error);
      toast.error('שגיאה בטעינת יוצרים מובילים');
      setFeaturedCreators([]); // Fallback to empty array on error
    }
  }

  async function toggleFeatured(creatorId: string) {
    try {
      const newFeaturedCreators = featuredCreators.includes(creatorId)
        ? featuredCreators.filter(id => id !== creatorId)
        : [...featuredCreators, creatorId];

      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'featured_creators',
          value: { creator_ids: newFeaturedCreators }
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      setFeaturedCreators(newFeaturedCreators);
      toast.success(
        featuredCreators.includes(creatorId)
          ? 'היוצר הוסר מרשימת המובילים'
          : 'היוצר נוסף לרשימת המובילים'
      );
    } catch (error) {
      console.error('שגיאה בעדכון יוצרים מובילים:', error);
      toast.error('שגיאה בעדכון יוצרים מובילים');
    }
  }

  const translateCategory = (category: string) => {
    const translations: Record<string, string> = {
      'musician': 'מוזיקאי',
      'actor': 'שחקן',
      'comedian': 'קומיקאי',
      'influencer': 'משפיען',
      'athlete': 'ספורטאי',
      'artist': 'אמן'
    };
    
    return translations[category] || category;
  };

  const filteredCreators = creators.filter(creator =>
    creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    creator.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">יוצרים מובילים</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש יוצרים..."
              className="pr-10 pl-4 py-2 border rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  יוצר
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  קטגוריה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס מוביל
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCreators.length > 0 ? (
                filteredCreators.map((creator) => (
                  <tr key={creator.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}`}
                          alt={creator.name}
                          className="h-10 w-10 rounded-full"
                        />
                        <div className="mr-3">
                          <div className="text-sm font-medium text-gray-900">
                            {creator.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {translateCategory(creator.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        featuredCreators.includes(creator.id)
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {featuredCreators.includes(creator.id) ? 'מוביל' : 'לא מוביל'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleFeatured(creator.id)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          featuredCreators.includes(creator.id)
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {featuredCreators.includes(creator.id) ? (
                          <>
                            <X className="h-4 w-4 ml-1" />
                            הסר מהמובילים
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 ml-1" />
                            הוסף למובילים
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    לא נמצאו יוצרים התואמים את החיפוש
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
