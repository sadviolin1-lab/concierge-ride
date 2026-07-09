'use client';

import { useLang } from '@/lib/use-lang';

const USFlag = () => (
  <svg width="18" height="13" viewBox="0 0 20 14" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
    <rect width="20" height="14" fill="#B22234"/>
    <rect y="1.08" width="20" height="1.08" fill="#FFF"/>
    <rect y="3.23" width="20" height="1.08" fill="#FFF"/>
    <rect y="5.38" width="20" height="1.08" fill="#FFF"/>
    <rect y="7.54" width="20" height="1.08" fill="#FFF"/>
    <rect y="9.69" width="20" height="1.08" fill="#FFF"/>
    <rect y="11.85" width="20" height="1.08" fill="#FFF"/>
    <rect width="10" height="7.54" fill="#3C3B6E"/>
    <circle cx="2" cy="1.8" r="0.4" fill="#FFF"/>
    <circle cx="5" cy="1.8" r="0.4" fill="#FFF"/>
    <circle cx="8" cy="1.8" r="0.4" fill="#FFF"/>
    <circle cx="3.5" cy="3.7" r="0.4" fill="#FFF"/>
    <circle cx="6.5" cy="3.7" r="0.4" fill="#FFF"/>
    <circle cx="2" cy="5.6" r="0.4" fill="#FFF"/>
    <circle cx="5" cy="5.6" r="0.4" fill="#FFF"/>
    <circle cx="8" cy="5.6" r="0.4" fill="#FFF"/>
  </svg>
);

const THFlag = () => (
  <svg width="18" height="13" viewBox="0 0 20 14" style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
    <rect width="20" height="14" fill="#A51931"/>
    <rect y="2.33" width="20" height="9.33" fill="#F4F5F8"/>
    <rect y="4.67" width="20" height="4.67" fill="#2D2A4A"/>
  </svg>
);

export default function LangToggle({ light = false }: { light?: boolean }) {
  const { lang, setLang } = useLang();

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '4px', 
      background: light ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg-2)', 
      padding: '3px', 
      borderRadius: '8px',
      border: light ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--color-border)',
      height: '32px',
      alignSelf: 'center'
    }}>
      <button
        onClick={() => setLang('en')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          border: 'none',
          background: lang === 'en' ? (light ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-bg-3)') : 'transparent',
          color: light ? '#fff' : 'var(--color-text-1)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: lang === 'en' ? 700 : 500,
          transition: 'all 0.2s ease',
          opacity: lang === 'en' ? 1 : 0.7,
          height: '24px',
          outline: 'none'
        }}
        title="English"
      >
        <USFlag />
        <span>EN</span>
      </button>
      <button
        onClick={() => setLang('th')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          border: 'none',
          background: lang === 'th' ? (light ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-bg-3)') : 'transparent',
          color: light ? '#fff' : 'var(--color-text-1)',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: lang === 'th' ? 700 : 500,
          transition: 'all 0.2s ease',
          opacity: lang === 'th' ? 1 : 0.7,
          height: '24px',
          outline: 'none'
        }}
        title="ภาษาไทย"
      >
        <THFlag />
        <span>TH</span>
      </button>
    </div>
  );
}
