import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface FooterPage {
  slug: string;
  title: string;
}

interface FooterSection {
  title: string;
  links: FooterPage[];
}

export function Footer() {
  const [footerSections, setFooterSections] = useState<FooterSection[]>([
    { title: 'אודות', links: [] },
    { title: 'תמיכה', links: [] },
    { title: 'משפטי', links: [] },
    { title: 'יוצרים', links: [] },
    { title: 'דפים נוספים', links: [] } // Added a new section for miscellaneous pages
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFooterPages();
  }, []);

  async function fetchFooterPages() {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('page_content')
        .select('slug, title')
        .eq('is_published', true)
        .order('title');

      if (error) throw error;
      
      // Get all published pages
      const pages = data || [];
      
      if (pages.length === 0) {
        console.log('No published pages found');
        setLoading(false);
        return;
      }

      console.log('Found pages:', pages);
      
      // Map pages to sections based on their slug keywords
      const aboutKeywords = ['about', 'careers', 'team', 'story', 'מי אנחנו', 'קריירה', 'צוות', 'סיפור'];
      const supportKeywords = ['help', 'faq', 'contact', 'support', 'עזרה', 'שאלות', 'צור קשר', 'תמיכה'];
      const legalKeywords = ['privacy', 'terms', 'legal', 'copyright', 'פרטיות', 'תקנון', 'משפטי', 'זכויות יוצרים'];
      const creatorKeywords = ['creator', 'become-creator', 'guidelines', 'יוצר', 'יצירה', 'הנחיות'];

      const aboutPages = pages.filter(page => 
        aboutKeywords.some(keyword => page.slug.includes(keyword) || page.title.includes(keyword))
      );
      
      const supportPages = pages.filter(page => 
        supportKeywords.some(keyword => page.slug.includes(keyword) || page.title.includes(keyword))
      );
      
      const legalPages = pages.filter(page => 
        legalKeywords.some(keyword => page.slug.includes(keyword) || page.title.includes(keyword))
      );
      
      const creatorPages = pages.filter(page => 
        creatorKeywords.some(keyword => page.slug.includes(keyword) || page.title.includes(keyword))
      );

      // Get any pages that don't fit into the above categories
      const assignedPages = [...aboutPages, ...supportPages, ...legalPages, ...creatorPages];
      const miscPages = pages.filter(page => 
        !assignedPages.some(assigned => assigned.slug === page.slug)
      );
      
      // Update footer sections
      setFooterSections([
        { title: 'אודות', links: aboutPages },
        { title: 'תמיכה', links: supportPages },
        { title: 'משפטי', links: legalPages },
        { title: 'יוצרים', links: creatorPages },
        { title: 'דפים נוספים', links: miscPages }
      ]);
    } catch (err) {
      console.error('Error:', err);
      setError('שגיאה בטעינת התוכן');
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer className="bg-black border-t border-gold-500" dir="rtl">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {footerSections.map((section, index) => (
            section.links.length > 0 && (
              <div key={index}>
                <h3 className="text-sm font-semibold text-gold-400 tracking-wider uppercase">{section.title}</h3>
                <ul className="mt-4 space-y-4">
                  {loading ? (
                    <li className="text-gray-300">טוען...</li>
                  ) : section.links.length > 0 ? (
                    section.links.map((link) => (
                      <li key={link.slug}>
                        <Link to={`/page/${link.slug}`} className="text-base text-gray-300 hover:text-gold-400">
                          {link.title}
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400">אין קישורים</li>
                  )}
                </ul>
              </div>
            )
          ))}
          
          {/* Add direct contact link */}
          <div>
            <h3 className="text-sm font-semibold text-gold-400 tracking-wider uppercase">צור קשר</h3>
            <ul className="mt-4 space-y-4">
              <li>
                <Link to="/contact" className="text-base text-gray-300 hover:text-gold-400">
                  צור קשר
                </Link>
              </li>
              <li>
                <a href="mailto:support@mystar.co.il" className="text-base text-gray-300 hover:text-gold-400">
                  support@mystar.co.il
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 border-t border-gold-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-base text-gray-400 text-center">
              &copy; {new Date().getFullYear()} MyStar - מיי סטאר. כל הזכויות שמורות.
            </p>
            <div className="mt-4 md:mt-0 flex space-x-4 space-x-reverse">
              <Link to="/privacy" className="text-base text-gray-300 hover:text-gold-400">
                מדיניות פרטיות
              </Link>
              <Link to="/terms" className="text-base text-gray-300 hover:text-gold-400">
                תנאי שימוש
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}