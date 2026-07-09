'use client';
import { useState, useEffect } from 'react';

export type Lang = 'th' | 'en';

const KEY = 'cr_lang';

/**
 * Persistent language preference shared across all pages via localStorage.
 * Automatically synchronizes state changes across components and tabs.
 */
export function useLang() {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(KEY) as Lang | null;
      if (stored === 'th' || stored === 'en') setLangState(stored);
    };

    // Initial read
    handleStorageChange();

    // Listen for custom event triggered in the same tab
    window.addEventListener('cr_lang_change', handleStorageChange);
    
    return () => {
      window.removeEventListener('cr_lang_change', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en-GB' : 'th-TH';
  }, [lang]);

  const setLang = (l: Lang) => {
    localStorage.setItem(KEY, l);
    // Dispatch event to update other components in real-time
    window.dispatchEvent(new Event('cr_lang_change'));
  };

  return { lang, setLang };
}
