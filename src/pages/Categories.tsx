import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Star, Video } from 'lucide-react';

interface Creator {
  id: string;
  name: string;
  category: string;
  bio: string;
  price: number;
  avatar_url: string | null;
  active: boolean;
  video_ads: {
    id: string;
    title: string;
  }[];
}

interface AdminCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  order: number;
  active: boolean;
}

export function Categories() {
  const [categories, setCategories] = useState<{
    name: string;
    icon: string;
    creators: Creator[];
  }[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch categories from platform_config - this works for both authenticated and unauthenticated users
      const { data: configData, error: configError } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'categories')
        .maybeSingle();

      if (configError) throw configError;

      // Get admin categories or use default if none exist
      const adminCategories = configData?.value?.categories || [];
      
      // Only use active categories
      const activeAdminCategories = adminCategories
        .filter((cat: AdminCategory) => cat.active)
        .sort((a: AdminCategory, b: AdminCategory) => a.order - b.order);

      // Define default categories if no admin categories exist
      const defaultCategories = [
        { id: '1', name: 'מוזיקאי', icon: '🎵', description: 'אמנים ומבצעים מוזיקליים', order: 1, active: true },
        { id: '2', name: 'שחקן', icon: '🎭', description: 'שחקני קולנוע, טלוויזיה ותיאטרון', order: 2, active: true },
        { id: '3', name: 'קומיקאי', icon: '😂', description: 'סטנדאפיסטים ובדרנים', order: 3, active: true },
        { id: '4', name: 'ספורטאי', icon: '⚽', description: 'ספורטאים מקצועיים', order: 4, active: true },
        { id: '5', name: 'משפיען', icon: '📱', description: 'יוצרי תוכן ברשתות חברתיות', order: 5, active: true },
        { id: '6', name: 'אמן', icon: '🎨', description: 'אמנים ויוצרים', order: 6, active: true }
      ];

      // Define categoriesToUse - use admin categories if available, otherwise use defaults
      const categoriesToUse = activeAdminCategories.length > 0 ? activeAdminCategories : defaultCategories;

      // Map Hebrew categories to English for database matching
      const categoryMapping: Record<string, string> = {
        'מוזיקאי': 'musician',
        'שחקן': 'actor',
        'קומיקאי': 'comedian',
        'ספורטאי': 'athlete',
        'משפיען': 'influencer',
        'אמן': 'artist'
      };
      
      // Create reverse mapping for display
      const reverseCategoryMapping: Record<string, string> = {};
      Object.entries(categoryMapping).forEach(([hebrew, english]) => {
        reverseCategoryMapping[english] = hebrew;
      });

      // Fetch all active creators
      const { data: creators, error: creatorsError } = await supabase
        .from('creator_profiles')
        .select(`
          *,
          video_ads (
            id,
            title
          )
        `)
        .eq('active', true);

      if (creatorsError) throw creatorsError;

      // Filter out creators from banned users
      const creatorIds = creators?.map(c => c.id) || [];
      
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

      // Filter out creators with banned status
      const activeCreators = (creators || []).filter(creator => {
        const status = userStatusMap.get(creator.id);
        return status === 'active'; // Only keep active users
      });

      console.log('Active creators:', activeCreators.length);
      console.log('Creator categories:', activeCreators.map(c => c.category));

      // Fetch featured creators
      const { data: featuredConfig, error: featuredError } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'featured_creators')
        .maybeSingle();

      if (featuredError) throw featuredError;

      const featuredIds = featuredConfig?.value?.creator_ids || [];
      
      // Filter featured creators
      const featured = activeCreators.filter(creator => 
        featuredIds.includes(creator.id)
      );
      
      setFeaturedCreators(featured);

      // Group creators by category
      const categoriesWithCreators = categoriesToUse.map(category => {
        // Get the English category name for database matching
        const englishCategory = categoryMapping[category.name] || category.name.toLowerCase();
        
        const matchingCreators = activeCreators.filter(creator => {
          // Try to match by exact category name or by mapping
          const creatorCategory = creator.category?.toLowerCase() || '';
          const englishCategoryLower = englishCategory.toLowerCase();
          const categoryNameLower = category.name.toLowerCase();
          
          // Check for direct match or match via mapping
          return creatorCategory === englishCategoryLower || 
                 creatorCategory === categoryNameLower ||
                 // Check if the creator's category matches any of the reverse mappings
                 (reverseCategoryMapping[creatorCategory] && 
                  reverseCategoryMapping[creatorCategory].toLowerCase() === categoryNameLower);
        });
        
        console.log(`Category ${category.name} (${englishCategory}) has ${matchingCreators.length} creators`);
        
        return {
          name: category.name,
          icon: category.icon,
          creators: matchingCreators
        };
      });

      setCategories(categoriesWithCreators);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('שגיאה בטעינת הנתונים. אנא נסה שוב מאוחר יותר.');
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8" dir="rtl">
        <div className="text-center py-8 bg-red-50 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      {/* Featured Creators Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">יוצרים מובילים</h2>
          <Star className="h-6 w-6 text-yellow-400 fill-current" />
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : featuredCreators.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCreators.map((creator) => (
              <Link
                key={creator.id}
                to={`/creator/${creator.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
              >
                <img
                  src={creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=random`}
                  alt={creator.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600">{creator.name}</h3>
                  <div className="flex items-center mt-1">
                    <p className="text-sm text-gray-600">{creator.category}</p>
                    <span className="mr-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {creator.category}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-primary-600 font-semibold">₪{creator.price}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      מומלץ
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">אין יוצרים מובילים כרגע</p>
          </div>
        )}
      </section>

      {/* Categories with Creators */}
      {categories.map((category) => (
        <section key={category.name} className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2 space-x-reverse">
              <span className="text-3xl mr-3">{category.icon}</span>
              <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
            </div>
            <Link
              to={`/explore?category=${encodeURIComponent(category.name)}`}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium mr-2"
            >
              צפה בכל היוצרים
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : category.creators.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {category.creators.slice(0, 4).map((creator) => (
                <Link
                  key={creator.id}
                  to={`/creator/${creator.id}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
                >
                  <img
                    src={creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=random`}
                    alt={creator.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600">{creator.name}</h3>
                    <div className="flex items-center mt-1">
                      <p className="text-sm text-gray-600 line-clamp-2">{creator.bio}</p>
                      <span className="mr-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {category.name}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-primary-600 font-semibold">₪{creator.price}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">אין יוצרים בקטגוריה זו כרגע</p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
