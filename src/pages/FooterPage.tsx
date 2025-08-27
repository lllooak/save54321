import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader } from 'lucide-react';

export function FooterPage() {
  const { slug } = useParams<{ slug: string }>();
  const [pageContent, setPageContent] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPageContent = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!slug) {
          setError('דף לא נמצא');
          return;
        }

        const { data, error } = await supabase
          .from('page_content')
          .select('title, content')
          .eq('slug', slug)
          .eq('is_published', true)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            setError('דף לא נמצא');
          } else {
            console.error('Error fetching page content:', error);
            setError('שגיאה בטעינת התוכן');
          }
          return;
        }

        setPageContent(data);
      } catch (err) {
        console.error('Error:', err);
        setError('שגיאה בטעינת התוכן');
      } finally {
        setLoading(false);
      }
    };

    fetchPageContent();
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[60vh]">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !pageContent) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl" dir="rtl">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-6 text-gray-900">שגיאה</h1>
          <p className="text-gray-600 mb-6">{error || 'תוכן הדף לא נמצא'}</p>
          <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl" dir="rtl">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">{pageContent.title}</h1>
        <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: pageContent.content }} />
      </div>
    </div>
  );
}
