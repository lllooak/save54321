import React, { useState, useEffect } from 'react';
import { Save, Globe, AlertTriangle, Loader } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { checkAdminAccess } from '../../../lib/admin';
import { useNavigate } from 'react-router-dom';

interface SiteConfig {
  site_name: string;
  site_name_hebrew: string;
  logo_url: string;
  favicon_url: string;
  meta_description: string;
  meta_keywords: string[];
  og_image: string;
  og_title: string;
  og_description: string;
  google_analytics_id: string;
}

export function SiteConfig() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<SiteConfig>({
    site_name: 'MyStar.co.il',
    site_name_hebrew: 'מיי סטאר',
    logo_url: '',
    favicon_url: '/vite.svg',
    meta_description: 'Get personalized videos from your favorite creators',
    meta_keywords: ['personalized videos', 'creator content', 'custom messages', 'video greetings'],
    og_image: '',
    og_title: 'MyStar.co.il - מיי סטאר',
    og_description: 'Get personalized videos from your favorite creators',
    google_analytics_id: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const hasAccess = await checkAdminAccess();
      setIsAdmin(hasAccess);
      
      if (hasAccess) {
        loadConfig();
      } else {
        setLoading(false);
        toast.error('אין לך הרשאות גישה לדף זה');
        navigate('/dashboard/Joseph998');
      }
    };
    
    checkAccess();
  }, [navigate]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('*')
        .eq('key', 'site_config')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data?.value) {
        setConfig(data.value as SiteConfig);
      }
    } catch (error) {
      console.error('שגיאה בטעינת הגדרות האתר:', error);
      toast.error('שגיאה בטעינת הגדרות האתר');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'site_config',
          value: config,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      
      // Log the update
      await supabase.from('audit_logs').insert({
        action: 'update_site_config',
        entity: 'platform_config',
        entity_id: 'site_config',
        user_id: (await supabase.auth.getUser()).data.user?.id,
        details: {
          updated_at: new Date().toISOString()
        }
      });
      
      toast.success('הגדרות האתר עודכנו בהצלחה');
      
      // Force reload to apply changes
      window.location.reload();
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות האתר:', error);
      toast.error('שגיאה בשמירת הגדרות האתר');
    } finally {
      setSaving(false);
    }
  };

  const handleKeywordsChange = (value: string) => {
    const keywords = value.split(',').map(k => k.trim()).filter(k => k);
    setConfig(prev => ({ ...prev, meta_keywords: keywords }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
        <span className="mr-2 text-gray-600">טוען נתונים...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין הרשאת גישה</h2>
          <p className="text-gray-600">אין לך הרשאות מנהל לצפות בדף זה.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">הגדרות אתר</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">הגדרות בסיסיות</h2>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                שם האתר (אנגלית)
              </label>
              <input
                type="text"
                value={config.site_name}
                onChange={(e) => setConfig(prev => ({ ...prev, site_name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                שם האתר (עברית)
              </label>
              <input
                type="text"
                value={config.site_name_hebrew}
                onChange={(e) => setConfig(prev => ({ ...prev, site_name_hebrew: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                כתובת לוגו
              </label>
              <input
                type="url"
                value={config.logo_url}
                onChange={(e) => setConfig(prev => ({ ...prev, logo_url: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="https://example.com/logo.png"
                dir="ltr"
              />
              {config.logo_url && (
                <div className="mt-2">
                  <img
                    src={config.logo_url}
                    alt="לוגו האתר"
                    className="h-12 object-contain"
                    onError={() => toast.error('שגיאה בטעינת תמונת הלוגו')}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                כתובת אייקון (Favicon)
              </label>
              <input
                type="url"
                value={config.favicon_url}
                onChange={(e) => setConfig(prev => ({ ...prev, favicon_url: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="https://example.com/favicon.ico"
                dir="ltr"
              />
              {config.favicon_url && (
                <div className="mt-2">
                  <img
                    src={config.favicon_url}
                    alt="אייקון האתר"
                    className="h-8 w-8 object-contain"
                    onError={() => toast.error('שגיאה בטעינת אייקון האתר')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEO Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">הגדרות SEO</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                תיאור מטא
              </label>
              <textarea
                value={config.meta_description}
                onChange={(e) => setConfig(prev => ({ ...prev, meta_description: e.target.value }))}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="הזן תיאור עבור מנועי חיפוש..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                מילות מפתח (מופרדות בפסיקים)
              </label>
              <input
                type="text"
                value={config.meta_keywords.join(', ')}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="מילת מפתח1, מילת מפתח2, מילת מפתח3"
              />
            </div>
          </div>
        </div>

        {/* Social Media Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">הגדרות מדיה חברתית</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                כותרת Open Graph
              </label>
              <input
                type="text"
                value={config.og_title}
                onChange={(e) => setConfig(prev => ({ ...prev, og_title: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                תיאור Open Graph
              </label>
              <textarea
                value={config.og_description}
                onChange={(e) => setConfig(prev => ({ ...prev, og_description: e.target.value }))}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                כתובת תמונת Open Graph
              </label>
              <input
                type="url"
                value={config.og_image}
                onChange={(e) => setConfig(prev => ({ ...prev, og_image: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="https://example.com/og-image.jpg"
                dir="ltr"
              />
              {config.og_image && (
                <div className="mt-2">
                  <img
                    src={config.og_image}
                    alt="תמונת Open Graph"
                    className="h-32 object-contain"
                    onError={() => toast.error('שגיאה בטעינת תמונת Open Graph')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Analytics Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">הגדרות אנליטיקס</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              מזהה Google Analytics
            </label>
            <input
              type="text"
              value={config.google_analytics_id}
              onChange={(e) => setConfig(prev => ({ ...prev, google_analytics_id: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="UA-XXXXXXXXX-X או G-XXXXXXXXXX"
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader className="h-4 w-4 ml-2 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 ml-2" />
                שמור שינויים
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
