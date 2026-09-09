'use client';

import React, { useId } from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function AppLogo({ size = 44, className, style }: AppLogoProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `appLogo_bg_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#38BDF8" />
          <stop offset="45%"  stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={`url(#${gradId})`} />
      <circle cx="50" cy="62" r="30" fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="5.5" />
      <circle cx="50" cy="62" r="6.5" fill="rgba(255,255,255,0.9)" />
      <line x1="50" y1="55.5" x2="50" y2="36" stroke="rgba(255,255,255,0.88)" strokeWidth="5" strokeLinecap="round" />
      <line x1="44.4" y1="67.2" x2="24" y2="78" stroke="rgba(255,255,255,0.88)" strokeWidth="5" strokeLinecap="round" />
      <line x1="55.6" y1="67.2" x2="76" y2="78" stroke="rgba(255,255,255,0.88)" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="50" cy="22" rx="4" ry="3.5" fill="white" />
      <path d="M35,44 C35,27 65,27 65,44 L65,47 L35,47 Z" fill="white" />
      <rect x="32" y="47" width="36" height="5.5" rx="2.75" fill="white" />
      <path d="M70,23 L72,15 L74,23 L82,25 L74,27 L72,35 L70,27 L62,25 Z" fill="white" opacity="0.92" />
      <path d="M76.5,37 L78,32 L79.5,37 L84.5,38.5 L79.5,40 L78,45 L76.5,40 L71.5,38.5 Z" fill="white" opacity="0.72" />
    </svg>
  );
}
