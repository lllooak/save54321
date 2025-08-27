import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit2, Trash2, Plus, Save, X, Eye, EyeOff, FileText, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkAdminAccess } from '../../../lib/admin';
import { useNavigate } from 'react-router-dom';

interface PageContent {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export function PageContentManagement() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageContent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    content: '',
    is_published: true
  });

  useEffect(() => {
    const checkAccess = async () => {
      const hasAccess = await checkAdminAccess();
      
      if (hasAccess) {
        fetchPages();
      } else {
        setLoading(false);
        toast.error('אין לך הרשאות גישה לדף זה');
        navigate('/dashboard/Joseph998');
      }
    };
    
    checkAccess();
  }, [navigate]);

  async function fetchPages() {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('page_content')
        .select('*')
        .order('title');

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error('שגיאה בטעינת דפים:', error);
      toast.error('שגיאה בטעינת דפים');
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (page: PageContent) => {
    setCurrentPage(page);
    setFormData({
      slug: page.slug,
      title: page.title,
      content: page.content,
      is_published: page.is_published
    });
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setCurrentPage(null);
    setFormData({
      slug: '',
      title: '',
      content: '',
      is_published: true
    });
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setCurrentPage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate slug format
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(formData.slug)) {
        toast.error('שם העמוד (slug) יכול להכיל רק אותיות אנגליות קטנות, מספרים ומקפים');
        setLoading(false);
        return;
      }
      
      if (isEditing && currentPage) {
        // Update existing page
        const { error } = await supabase
          .from('page_content')
          .update({
            title: formData.title,
            content: formData.content,
            is_published: formData.is_published,
            updated_at: new Date().toISOString(),
            updated_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq('id', currentPage.id);

        if (error) throw error;
        toast.success('הדף עודכן בהצלחה');
      } else if (isCreating) {
        // Create new page
        const { error } = await supabase
          .from('page_content')
          .insert({
            slug: formData.slug,
            title: formData.title,
            content: formData.content,
            is_published: formData.is_published,
            updated_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (error) {
          if (error.code === '23505') { // Unique violation
            toast.error('שם העמוד (slug) כבר קיים במערכת');
            setLoading(false);
            return;
          }
          throw error;
        }
        toast.success('הדף נוצר בהצלחה');
      }
      
      // Reset form and fetch updated pages
      setIsEditing(false);
      setIsCreating(false);
      setCurrentPage(null);
      fetchPages();
    } catch (error) {
      console.error('שגיאה בשמירת הדף:', error);
      toast.error('שגיאה בשמירת הדף');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק דף זה?')) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('page_content')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('הדף נמחק בהצלחה');
      fetchPages();
    } catch (error) {
      console.error('שגיאה במחיקת הדף:', error);
      toast.error('שגיאה במחיקת הדף');
    } finally {
      setLoading(false);
    }
  };

  const togglePublishStatus = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('page_content')
        .update({
          is_published: !currentStatus,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(currentStatus ? 'הדף הוסר מפרסום' : 'הדף פורסם בהצלחה');
      fetchPages();
    } catch (error) {
      console.error('שגיאה בעדכון סטטוס פרסום:', error);
      toast.error('שגיאה בעדכון סטטוס פרסום');
    } finally {
      setLoading(false);
    }
  };

  const filteredPages = pages.filter(page => {
    if (!searchQuery) return true;
    
    return (
      page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול תוכן דפים</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש דפים..."
              className="pr-10 pl-4 py-2 border rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            disabled={isEditing || isCreating}
          >
            <Plus className="h-5 w-5 ml-2" />
            צור דף חדש
          </button>
        </div>
      </div>

      {(isEditing || isCreating) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {isEditing ? 'עריכת דף' : 'יצירת דף חדש'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">שם העמוד (Slug)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
                disabled={isEditing} // Can't change slug for existing pages
                placeholder="about-us"
                dir="ltr"
              />
              <p className="mt-1 text-sm text-gray-500">
                שם העמוד בכתובת האתר, לדוגמה: about-us (רק אותיות אנגליות קטנות, מספרים ומקפים)
              </p>
            </div>

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
              <label className="block text-sm font-medium text-gray-700">תוכן</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
                dir="rtl"
              />
              <p className="mt-1 text-sm text-gray-500">
                ניתן להשתמש בתגיות HTML בסיסיות כמו &lt;h1&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;a&gt; וכו'
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 ml-2"
                />
                <span className="text-sm text-gray-700">פרסם דף זה</span>
              </label>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 ml-4"
                disabled={loading}
              >
                {loading ? 'שומר...' : isEditing ? 'עדכן דף' : 'צור דף'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">דפים</h2>
        </div>
        {loading && !isEditing && !isCreating ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredPages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">כותרת</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שם העמוד (Slug)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">עודכן</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 ml-2" />
                        <span className="text-sm font-medium text-gray-900">{page.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono" dir="ltr">
                      {page.slug}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        page.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {page.is_published ? 'מפורסם' : 'טיוטה'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(page.updated_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(page)}
                          className="text-primary-600 hover:text-primary-900 ml-2"
                          title="ערוך"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => togglePublishStatus(page.id, page.is_published)}
                          className={`${
                            page.is_published ? 'text-gray-600 hover:text-gray-900' : 'text-green-600 hover:text-green-900'
                          } ml-2`}
                          title={page.is_published ? 'הסר מפרסום' : 'פרסם'}
                        >
                          {page.is_published ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(page.id)}
                          className="text-red-600 hover:text-red-900"
                          title="מחק"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">לא נמצאו דפים</p>
          </div>
        )}
      </div>
    </div>
  );
}
