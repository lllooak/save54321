import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './i18n';
import './index.css';

// Create a custom meta tag for the charset
const charsetMeta = document.createElement('meta');
charsetMeta.setAttribute('charset', 'UTF-8');
document.head.appendChild(charsetMeta);

// Create a custom meta tag for the viewport
const viewportMeta = document.createElement('meta');
viewportMeta.setAttribute('name', 'viewport');
viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
document.head.appendChild(viewportMeta);

// Set the title
document.title = 'מיי סטאר- רכישת ברכות מותאמות אישית מיוצרים אמנים וסלבריטאים לכל אירוע';

// Add meta description
const metaDescription = document.createElement('meta');
metaDescription.setAttribute('name', 'description');
metaDescription.setAttribute('content', 'קבל ברכה מותאמת אישית לכל אירוע מאמנים יוצרים וסלבריטאים');
document.head.appendChild(metaDescription);

// Add meta keywords
const metaKeywords = document.createElement('meta');
metaKeywords.setAttribute('name', 'keywords');
metaKeywords.setAttribute('content', 'מיי סטאר, ברכות מאמנים, ברכות לכל אירוע, ברכות מיוצרים, ברכות מסלב, mystar');
document.head.appendChild(metaKeywords);

// Add base tag to ensure all relative URLs resolve correctly
const baseTag = document.createElement('base');
baseTag.setAttribute('href', '/');
document.head.appendChild(baseTag);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="top-center" />
  </StrictMode>
);
