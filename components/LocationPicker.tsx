'use client';

import { useEffect, useRef, useState } from 'react';

interface LocationPickerProps {
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  onSelect: (address: string, lat: number, lng: number) => void;
  onClose: () => void;
}

export default function LocationPicker({ initialAddress, initialLat, initialLng, onSelect, onClose }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [pinPos, setPinPos] = useState<{ lat: number; lng: number }>({
    lat: initialLat || 7.8804,
    lng: initialLng || 98.3923,
  });

  // Map instances
  const leafletMap = useRef<any>(null);
  const leafletMarker = useRef<any>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Leaflet CSS and JS
  useEffect(() => {
    // Load CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load JS
    if ((window as any).L) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError('Failed to load map library.');
    document.head.appendChild(script);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!loaded || !mapRef.current || leafletMap.current) return;

    const L = (window as any).L;
    const defaultPos: [number, number] = [pinPos.lat, pinPos.lng];

    leafletMap.current = L.map(mapRef.current, {
      center: defaultPos,
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(leafletMap.current);

    // Custom icon
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        background:linear-gradient(135deg,#0284c7,#06b6d4);
        border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);
        transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    leafletMarker.current = L.marker(defaultPos, { draggable: true, icon }).addTo(leafletMap.current);

    leafletMarker.current.on('dragend', () => {
      const pos = leafletMarker.current.getLatLng();
      setPinPos({ lat: pos.lat, lng: pos.lng });
    });

    leafletMap.current.on('click', (e: any) => {
      leafletMarker.current.setLatLng(e.latlng);
      setPinPos({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

  }, [loaded]);

  // Sync marker when pinPos changes programmatically
  useEffect(() => {
    if (leafletMarker.current) {
      leafletMarker.current.setLatLng([pinPos.lat, pinPos.lng]);
    }
  }, [pinPos]);

  // Nominatim search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q || q.length < 3) { setSearchResults([]); return; }

    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=th`,
          { headers: { 'Accept-Language': 'th,en' } }
        );
        const data = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setPinPos({ lat, lng });
    leafletMap.current?.setView([lat, lng], 17);
    setSearchResults([]);
    if (inputRef.current) inputRef.current.value = result.display_name;
  };

  const handleConfirm = () => {
    const address = inputRef.current?.value || `${pinPos.lat.toFixed(5)}, ${pinPos.lng.toFixed(5)}`;
    onSelect(address, pinPos.lat, pinPos.lng);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 640, height: '82vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: 'var(--shadow-xl)', animation: 'slideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-1)' }}>📍 Select Location</h3>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
        </div>

        {error ? (
          <div style={{ padding: 24, color: 'var(--color-warning)', textAlign: 'center' }}>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div style={{ padding: '12px 16px', background: 'var(--color-bg-2)', position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                className="form-input"
                placeholder="ค้นหาสถานที่... (e.g. สนามบินสุวรรณภูมิ)"
                defaultValue={initialAddress}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--color-text-1)',
                  paddingLeft: 16
                }}
              />
              {searching && (
                <div style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-text-3)' }}>
                  กำลังค้นหา...
                </div>
              )}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 16, right: 16, zIndex: 1000,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 8, boxShadow: 'var(--shadow-lg)', maxHeight: 220, overflowY: 'auto'
                }}>
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectResult(r)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', background: 'none', border: 'none',
                        borderBottom: i < searchResults.length - 1 ? '1px solid var(--color-border)' : 'none',
                        color: 'var(--color-text-1)', cursor: 'pointer', fontSize: 13,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', marginTop: 6, marginBottom: 0 }}>
                💡 ค้นหาหรือคลิกบนแผนที่เพื่อปักหมุด · ลากหมุดได้
              </p>
            </div>

            {/* Map */}
            <div ref={mapRef} style={{ flex: 1, width: '100%' }} />

            {/* Coordinate display */}
            <div style={{
              padding: '8px 16px', background: 'var(--color-bg-2)',
              fontSize: 12, color: 'var(--color-text-3)', textAlign: 'center',
              borderTop: '1px solid var(--color-border)'
            }}>
              📌 {pinPos.lat.toFixed(6)}, {pinPos.lng.toFixed(6)}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <button onClick={handleConfirm} className="btn-gradient">✓ Confirm Location</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
