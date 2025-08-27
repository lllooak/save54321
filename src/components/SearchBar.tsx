import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useDebounce } from '../hooks/useDebounce';

interface SearchResult {
  id: string;
  name: string;
  category: string;
  avatar_url: string | null;
}

export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search for creators when query changes
  useEffect(() => {
    const searchCreators = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('creator_profiles')
          .select('id, name, category, avatar_url')
          .or(`name.ilike.%${debouncedQuery}%,category.ilike.%${debouncedQuery}%`)
          .eq('active', true)
          .limit(5);

        if (error) throw error;

        // Filter out creators from banned users
        const creatorIds = data?.map(creator => creator.id) || [];
        if (creatorIds.length === 0) {
          setResults([]);
          setIsLoading(false);
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
        const activeCreators = (data || []).filter(creator => {
          const status = userStatusMap.get(creator.id);
          return status === 'active'; // Only keep active users
        });

        setResults(activeCreators);
      } catch (error) {
        console.error('Error searching creators:', error);
      } finally {
        setIsLoading(false);
      }
    };

    searchCreators();
  }, [debouncedQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/explore?search=${encodeURIComponent(query)}`);
      setShowResults(false);
    }
  };

  const handleResultClick = (creatorId: string) => {
    navigate(`/creator/${creatorId}`);
    setQuery('');
    setShowResults(false);
  };

  const handleInputFocus = () => {
    if (query.length >= 2) {
      setShowResults(true);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
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
    
    return hebrewNames[category.toLowerCase()] || category;
  };

  return (
    <div className="relative" ref={searchRef}>
      <form onSubmit={handleSearch}>
        <div className="relative">
          <input
            type="text"
            placeholder="חיפוש יוצרים..."
            className="w-64 px-4 py-2 pr-10 rounded-full border border-gold-500 bg-black focus:ring-2 focus:ring-gold-500 focus:border-transparent text-right"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setShowResults(true);
              } else {
                setShowResults(false);
              }
            }}
            onFocus={handleInputFocus}
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gold-400 hover:text-gold-500"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gold-400" />
          )}
        </div>
      </form>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute z-10 mt-2 w-full bg-black border border-gold-500 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin h-5 w-5 border-2 border-gold-500 rounded-full border-t-transparent mx-auto"></div>
              <p className="mt-2 text-sm text-gray-300">מחפש...</p>
            </div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((creator) => (
                <li 
                  key={creator.id}
                  className="border-b border-gold-700 last:border-b-0 hover:bg-black-800 cursor-pointer"
                  onClick={() => handleResultClick(creator.id)}
                >
                  <div className="p-3 flex items-center">
                    <img 
                      src={creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=random`}
                      alt={creator.name}
                      className="h-10 w-10 rounded-full object-cover border border-gold-500"
                    />
                    <div className="mr-3">
                      <p className="text-white font-medium">{creator.name}</p>
                      <p className="text-sm text-gray-400">{getCategoryNameInHebrew(creator.category)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-gray-300">
              לא נמצאו יוצרים
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}