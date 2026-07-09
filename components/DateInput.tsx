'use client';

import { useRef } from 'react';

/**
 * DateInput — displays DD/MM/YYYY but stores/returns YYYY-MM-DD
 *
 * Props mirror a normal <input type="date">:
 *   value      – YYYY-MM-DD string (controlled)
 *   onChange   – receives synthetic-like event with target.value as YYYY-MM-DD
 *   required / disabled / min / max / className / style / id / name
 */
interface DateInputProps {
  value: string;                                           // YYYY-MM-DD
  onChange: (e: { target: { value: string } }) => void;   // returns YYYY-MM-DD
  required?: boolean;
  disabled?: boolean;
  min?: string;  // YYYY-MM-DD
  max?: string;  // YYYY-MM-DD
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  name?: string;
  placeholder?: string;
}

/** Convert YYYY-MM-DD → DD/MM/YYYY for display */
function toDDMMYYYY(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Convert DD/MM/YYYY → YYYY-MM-DD for storage */
function toISO(display: string): string {
  if (!display) return '';
  const parts = display.replace(/[.\- ]/g, '/').split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  const yyyy = y.length === 2 ? `20${y}` : y;
  if (isNaN(Date.parse(`${yyyy}-${mm}-${dd}`))) return '';
  return `${yyyy}-${mm}-${dd}`;
}

export default function DateInput({
  value,
  onChange,
  required,
  disabled,
  min,
  max,
  className,
  style,
  id,
  name,
  placeholder = 'DD/MM/YYYY',
}: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  /** User typed in the text field */
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const iso = toISO(raw);
    // Always fire — parent gets YYYY-MM-DD or '' if incomplete
    onChange({ target: { value: iso || raw } });
  };

  /** User picked from native date picker */
  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ target: { value: e.target.value } }); // already YYYY-MM-DD
  };

  /** Click calendar icon → open hidden picker */
  const openPicker = () => {
    if (hiddenRef.current) {
      hiddenRef.current.showPicker?.();
      hiddenRef.current.click();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Visible text input — DD/MM/YYYY */}
      <input
        type="text"
        id={id}
        name={name}
        className={className || 'form-input'}
        style={{ paddingRight: 36, ...style }}
        value={toDDMMYYYY(value)}
        onChange={handleTextChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={10}
        inputMode="numeric"
        autoComplete="off"
      />

      {/* Calendar icon button */}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Open date picker"
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
          color: 'var(--color-text-3)', padding: 4, display: 'flex', alignItems: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>

      {/* Hidden native date input for the picker popup */}
      <input
        ref={hiddenRef}
        type="date"
        tabIndex={-1}
        value={value}
        min={min}
        max={max}
        onChange={handlePickerChange}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          opacity: 0, pointerEvents: 'none', cursor: 'default',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
