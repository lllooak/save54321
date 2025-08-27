import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  order: number;
  active: boolean;
}

// Predefined category icons with Hebrew names
const CATEGORY_ICONS = [
  '🎵', // מוזיקה
  '🎭', // תיאטרון/משחק
  '😂', // קומדיה
  '⚽', // ספורט
  '📱', // רשתות חברתיות/משפיענים
  '🎨', // אמנות
  '📺', // טלוויזיה
  '🎬', // קולנוע
  '📚', // ספרים/סופרים
  '🎤', // זמרים
  '🎮', // גיימינג
  '🏋️', // כושר
  '👨‍🍳', // בישול
  '🧘', // יוגה/בריאות
  '💃', // ריקוד
  '🎸', // גיטרה/כלי נגינה
  '🎯', // מוטיבציה
  '📷', // צילום
  '🎪', // קרקס/הופעות
  '🏆', // פרסים/הישגים
  '🎓', // חינוך
  '🎙️', // פודקאסט/רדיו
  '🤣', // בידור
  '🎧', // די.ג׳יי/הפקת מוזיקה
  '🎹', // פסנתר/קלידים
];

const defaultCategories = [
  { id: '1', name: 'מוזיקאי', icon: '🎵', description: 'אמנים ומבצעים מוזיקליים', order: 1, active: true },
  { id: '2', name: 'שחקן', icon: '🎭', description: 'שחקני קולנוע, טלוויזיה ותיאטרון', order: 2, active: true },
  { id: '3', name: 'קומיקאי', icon: '😂', description: 'סטנדאפיסטים ובדרנים', order: 3, active: true },
  { id: '4', name: 'ספורטאי', icon: '⚽', description: 'ספורטאים מקצועיים', order: 4, active: true },
  { id: '5', name: 'משפיען', icon: '📱', description: 'יוצרי תוכן ברשתות חברתיות', order: 5, active: true },
  { id: '6', name: 'אמן', icon: '🎨', description: 'אמנים ויוצרים', order: 6, active: true },
];

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    description: '',
    order: 0,
    active: true,
  });
  const [editMode, setEditMode] = useState<'inline' | 'form'>('form');
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setLoading(true);
      const { data: configData, error: configError } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'categories')
        .maybeSingle();

      if (configError) throw configError;

      if (configData) {
        setCategories(configData.value.categories || []);
      } else {
        // Initialize with default categories if none exist
        const initialCategories = await initializeCategories();
        setCategories(initialCategories);
      }
    } catch (error) {
      console.error('שגיאה בטעינת קטגוריות:', error);
      toast.error('שגיאה בטעינת קטגוריות');
    } finally {
      setLoading(false);
    }
  }

  async function initializeCategories() {
    try {
      const { error } = await supabase
        .from('platform_config')
        .insert({
          key: 'categories',
          value: { categories: defaultCategories },
        });

      if (error) throw error;
      return defaultCategories;
    } catch (error) {
      console.error('שגיאה באתחול קטגוריות:', error);
      throw error;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Validate form data
      if (!formData.name.trim()) {
        toast.error('שם הקטגוריה הוא שדה חובה');
        return;
      }
      
      if (!formData.icon) {
        toast.error('אנא בחר אייקון לקטגוריה');
        return;
      }
      
      // Check for duplicate category name
      const isDuplicate = categories.some(cat => 
        cat.name.toLowerCase() === formData.name.toLowerCase() && 
        (!editingCategory || cat.id !== editingCategory.id)
      );
      
      if (isDuplicate) {
        toast.error('קטגוריה עם שם זה כבר קיימת');
        return;
      }

      let updatedCategories;
      
      if (editingCategory) {
        // Update existing category
        updatedCategories = categories.map(cat =>
          cat.id === editingCategory.id
            ? { ...formData, id: editingCategory.id }
            : cat
        );
      } else {
        // Create new category
        const newCategory = {
          ...formData,
          id: crypto.randomUUID(),
          order: categories.length + 1,
        };
        updatedCategories = [...categories, newCategory];
      }

      // Sort categories by order
      updatedCategories.sort((a, b) => a.order - b.order);

      // Save to database
      const { error } = await supabase
        .from('platform_config')
        .update({
          value: { categories: updatedCategories },
        })
        .eq('key', 'categories');

      if (error) throw error;

      setCategories(updatedCategories);
      setEditingCategory(null);
      setIsCreating(false);
      setFormData({
        name: '',
        icon: '',
        description: '',
        order: 0,
        active: true,
      });

      toast.success(editingCategory ? 'הקטגוריה עודכנה בהצלחה' : 'הקטגוריה נוצרה בהצלחה');
    } catch (error) {
      console.error('שגיאה בשמירת קטגוריה:', error);
      toast.error('שגיאה בשמירת קטגוריה');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו?')) return;

    try {
      // Find the category to delete
      const categoryToDelete = categories.find(cat => cat.id === categoryId);
      if (!categoryToDelete) {
        toast.error('הקטגוריה לא נמצאה');
        return;
      }

      // Remove the category from the array
      const updatedCategories = categories.filter(cat => cat.id !== categoryId);
      
      // Update the order of remaining categories
      const reorderedCategories = updatedCategories.map((cat, index) => ({
        ...cat,
        order: index + 1
      }));

      // Save to database
      const { error } = await supabase
        .from('platform_config')
        .update({
          value: { categories: reorderedCategories },
        })
        .eq('key', 'categories');

      if (error) throw error;

      setCategories(reorderedCategories);
      toast.success('הקטגוריה נמחקה בהצלחה');
    } catch (error) {
      console.error('שגיאה במחיקת קטגוריה:', error);
      toast.error('שגיאה במחיקת קטגוריה');
    }
  }

  async function handleReorder(categoryId: string, direction: 'up' | 'down') {
    try {
      const currentIndex = categories.findIndex(cat => cat.id === categoryId);
      if (
        (direction === 'up' && currentIndex === 0) ||
        (direction === 'down' && currentIndex === categories.length - 1)
      ) {
        return;
      }

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const reorderedCategories = [...categories];
      const [movedCategory] = reorderedCategories.splice(currentIndex, 1);
      reorderedCategories.splice(newIndex, 0, movedCategory);

      // Update order numbers
      const updatedCategories = reorderedCategories.map((cat, index) => ({
        ...cat,
        order: index + 1,
      }));

      // Save to database
      const { error } = await supabase
        .from('platform_config')
        .update({
          value: { categories: updatedCategories },
        })
        .eq('key', 'categories');

      if (error) throw error;

      setCategories(updatedCategories);
      toast.success('סדר הקטגוריות עודכן בהצלחה');
    } catch (error) {
      console.error('שגיאה בסידור מחדש של קטגוריות:', error);
      toast.error('שגיאה בסידור מחדש של קטגוריות');
    }
  }

  async function handleInlineEdit(categoryId: string, field: string, value: any) {
    try {
      const updatedCategories = categories.map(cat => 
        cat.id === categoryId ? { ...cat, [field]: value } : cat
      );
      
      // Save to database
      const { error } = await supabase
        .from('platform_config')
        .update({
          value: { categories: updatedCategories },
        })
        .eq('key', 'categories');

      if (error) throw error;

      setCategories(updatedCategories);
      toast.success('הקטגוריה עודכנה בהצלחה');
    } catch (error) {
      console.error('שגיאה בעדכון קטגוריה:', error);
      toast.error('שגיאה בעדכון קטגוריה');
    }
  }

  const handleSelectIcon = (icon: string) => {
    if (editingCategory && editMode === 'inline') {
      handleInlineEdit(editingCategory.id, 'icon', icon);
    } else {
      setFormData({ ...formData, icon });
    }
    setShowIconSelector(false);
  };

  const filteredIcons = CATEGORY_ICONS.filter(icon => 
    !iconSearchQuery || icon.includes(iconSearchQuery)
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">ניהול קטגוריות</h1>
        <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">מצב עריכה:</span>
            <select 
              value={editMode}
              onChange={(e) => setEditMode(e.target.value as 'inline' | 'form')}
              className="text-sm border rounded-md px-2 py-1"
            >
              <option value="form">טופס</option>
              <option value="inline">מהיר</option>
            </select>
          </div>
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingCategory(null);
              setFormData({
                name: '',
                icon: '',
                description: '',
                order: categories.length + 1,
                active: true,
              });
            }}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            disabled={isCreating || editingCategory !== null}
          >
            <Plus className="h-5 w-5 ml-2" />
            הוסף קטגוריה
          </button>
        </div>
      </div>

      {/* Form for creating/editing categories */}
      {(isCreating || editingCategory) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingCategory ? 'עריכת קטגוריה' : 'יצירת קטגוריה חדשה'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">שם</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">אייקון</label>
              <div className="mt-1 flex">
                <div 
                  className="flex items-center justify-center w-12 h-12 border border-gray-300 rounded-md text-2xl cursor-pointer hover:bg-gray-50"
                  onClick={() => setShowIconSelector(true)}
                >
                  {formData.icon || '🔍'}
                </div>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="mr-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="בחר אייקון או הזן אימוג'י"
                  required
                />
              </div>
              
              {showIconSelector && (
                <div className="mt-2 p-4 border border-gray-200 rounded-lg bg-white shadow-md">
                  <div className="flex items-center mb-3">
                    <Search className="h-4 w-4 text-gray-400 ml-2" />
                    <input
                      type="text"
                      placeholder="חיפוש אייקונים..."
                      value={iconSearchQuery}
                      onChange={(e) => setIconSearchQuery(e.target.value)}
                      className="w-full border-none focus:ring-0 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIconSelector(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto">
                    {filteredIcons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => handleSelectIcon(icon)}
                        className="text-2xl p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                disabled={saving}
              >
                {saving ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    שומר...
                  </span>
                ) : (
                  editingCategory ? 'עדכן קטגוריה' : 'צור קטגוריה'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingCategory(null);
                  setFormData({
                    name: '',
                    icon: '',
                    description: '',
                    order: 0,
                    active: true,
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סדר</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">אייקון</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">שם</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תיאור</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categories.map((category, index) => (
              <tr key={category.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReorder(category.id, 'up')}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-50 ml-2"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleReorder(category.id, 'down')}
                      disabled={index === categories.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-50 ml-2"
                    >
                      ↓
                    </button>
                    <span>{category.order}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-2xl">
                  {editMode === 'inline' && editingCategory?.id === category.id ? (
                    <div className="flex items-center">
                      <div 
                        className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded-md text-2xl cursor-pointer hover:bg-gray-50"
                        onClick={() => setShowIconSelector(true)}
                      >
                        {category.icon || '🔍'}
                      </div>
                    </div>
                  ) : (
                    category.icon
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {editMode === 'inline' && editingCategory?.id === category.id ? (
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) => handleInlineEdit(category.id, 'name', e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  ) : (
                    category.name
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {editMode === 'inline' && editingCategory?.id === category.id ? (
                    <textarea
                      value={category.description}
                      onChange={(e) => handleInlineEdit(category.id, 'description', e.target.value)}
                      rows={2}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  ) : (
                    category.description
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editMode === 'inline' && editingCategory?.id === category.id ? (
                    <select
                      value={category.active ? 'true' : 'false'}
                      onChange={(e) => handleInlineEdit(category.id, 'active', e.target.value === 'true')}
                      className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                      <option value="true">פעיל</option>
                      <option value="false">לא פעיל</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      category.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {category.active ? 'פעיל' : 'לא פעיל'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    {editMode === 'inline' && editingCategory?.id === category.id ? (
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="text-primary-600 hover:text-primary-900 ml-2"
                      >
                        <Save className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (editMode === 'inline') {
                            setEditingCategory(category);
                          } else {
                            setEditingCategory(category);
                            setFormData({
                              name: category.name,
                              icon: category.icon,
                              description: category.description,
                              order: category.order,
                              active: category.active,
                            });
                          }
                        }}
                        className="text-primary-600 hover:text-primary-900 ml-2"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                    )}
                    <button
                       onClick={() => handleDelete(category.id)}
                       className="text-red-600 hover:text-red-900"
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
    </div>
  );
}
