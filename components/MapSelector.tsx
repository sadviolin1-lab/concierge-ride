'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Destination } from '@/lib/types';
import { useLang } from '@/lib/use-lang';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './map-selector.module.css';

// ─── Phuket bounding box ───────────────────────────────────
// Covers: Phuket only
const SEARCH_VIEWBOX = '98.2,8.25,98.45,7.75'; // west,north,east,south (lon,lat format for Nominatim)
const SEARCH_BOUNDED = '1'; // strictly within viewbox

function SortableStopItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: isDragging ? ('relative' as const) : ('static' as const),
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', color: 'var(--color-text-2)' }}
          title="Drag to reorder"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

const LANG = {
  en: {
    placeName: 'Place name (for driver)',
    placeNameHint: 'e.g. Central Festival, Phuket Airport',
    searchAddress: 'Search address / coordinates',
    searchHint: 'Type to search in Phuket area…',
    coordsLabel: 'Coordinates',
    descPlaceholder: 'Task description (e.g. Deposit checks)',
    hasPassengers: 'Has passengers?',
    count: 'Count',
    addStop: '+ Add Stop',
    searching: 'Searching…',
    noResults: 'No results found in Phuket area',
    pinned: 'Pinned from map',
    clearCoords: 'Clear location',
  },
  th: {
    placeName: 'ชื่อสถานที่ (สำหรับคนขับ)',
    placeNameHint: 'เช่น เซ็นทรัล ภูเก็ต, สนามบินภูเก็ต',
    searchAddress: 'ค้นหาที่อยู่ / พิกัด',
    searchHint: 'พิมพ์เพื่อค้นหาในพื้นที่ภูเก็ต…',
    coordsLabel: 'พิกัด',
    descPlaceholder: 'รายละเอียดงาน (เช่น ฝากเช็ค)',
    hasPassengers: 'มีผู้โดยสาร?',
    count: 'จำนวนคน',
    addStop: '+ เพิ่มจุดแวะ',
    searching: 'กำลังค้นหา…',
    noResults: 'ไม่พบสถานที่ในพื้นที่ภูเก็ต',
    pinned: 'ปักหมุดจากแผนที่',
    clearCoords: 'ล้างตำแหน่ง',
  },
};

export const DESTINATION_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

interface MapSelectorProps {
  destinations: Destination[];
  onDestinationsChange: (dests: Destination[]) => void;
  maxStops?: number;
}

// ─── Leaflet Map ───────────────────────────────────────────────────────────────
function LeafletMap({
  destinations,
  onMarkerDragEnd,
}: {
  destinations: Destination[];
  onMarkerDragEnd: (index: number, lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if ((window as any).L) { setLeafletLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstance.current) return;
    const L = (window as any).L;
    mapInstance.current = L.map(mapRef.current, { center: [7.8804, 98.3923], zoom: 10, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstance.current);
  }, [leafletLoaded]);

  const onMapClick = useCallback((e: any) => {
    // Find first destination without coords, or default to last
    const targetIndex = destinations.findIndex(d => !d.latLng);
    const indexToUpdate = targetIndex !== -1 ? targetIndex : destinations.length - 1;
    if (indexToUpdate >= 0) {
      onMarkerDragEnd(indexToUpdate, e.latlng.lat, e.latlng.lng);
    }
  }, [destinations, onMarkerDragEnd]);

  useEffect(() => {
    if (!mapInstance.current || !(window as any).L) return;
    mapInstance.current.off('click');
    mapInstance.current.on('click', onMapClick);
  }, [onMapClick]);

  useEffect(() => {
    if (!mapInstance.current || !(window as any).L) return;
    const L = (window as any).L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const bounds: [number, number][] = [];

    destinations.forEach((dest, index) => {
      if (!dest.latLng) return;
      const color = DESTINATION_COLORS[index % DESTINATION_COLORS.length];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;font-family:sans-serif;">${index + 1}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([dest.latLng!.lat, dest.latLng!.lng], { draggable: true, icon }).addTo(mapInstance.current);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onMarkerDragEnd(index, pos.lat, pos.lng);
      });

      // Tooltip with place name
      if (dest.title) {
        marker.bindTooltip(`<b>${dest.title}</b>`, { permanent: false, direction: 'top', offset: [0, -18] });
      }

      markersRef.current.push(marker);
      bounds.push([dest.latLng!.lat, dest.latLng!.lng]);
    });

    if (bounds.length > 0) {
      try { mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 }); }
      catch { /* ignore */ }
    }
  }, [destinations, leafletLoaded, onMarkerDragEnd]);

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: '320px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }} />
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--color-text-3)', textAlign: 'center' }}>
        💡 ลากหมุด หรือ คลิกที่แผนที่ เพื่อปรับตำแหน่ง — ชื่อสถานที่จะยังคงเดิม
      </p>
    </div>
  );
}

// ─── Nominatim Search (Phuket-area restricted) ────────────────────────────────
function AddressSearch({
  placeholder,
  hint,
  onSelectResult,
  noResultsText,
  searchingText,
}: {
  placeholder: string;
  hint: string;
  onSelectResult: (display: string, lat: number, lng: number) => void;
  noResultsText: string;
  searchingText: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q || q.length < 2) { setResults([]); setShowDropdown(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Search biased/bounded to Phuket area (viewbox: west,north,east,south)
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', q);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '6');
        url.searchParams.set('countrycodes', 'th');
        url.searchParams.set('viewbox', SEARCH_VIEWBOX);
        url.searchParams.set('bounded', SEARCH_BOUNDED);
        url.searchParams.set('addressdetails', '1');
        const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'th,en' } });
        const data = await res.json();
        setResults(data);
        setShowDropdown(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 450);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    search(e.target.value);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (r: any) => {
    onSelectResult(r.display_name, parseFloat(r.lat), parseFloat(r.lon));
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder={placeholder}
          className="form-input"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          style={{ width: '100%', paddingRight: 36, fontSize: '0.88rem', background: 'rgba(255,255,255,0.04)' }}
          autoComplete="off"
        />
        {loading && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16 }}>
            <svg viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite', width: 16, height: 16 }} fill="none" stroke="var(--color-text-3)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </span>
        )}
      </div>
      <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-text-3)' }}>{hint}</p>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          maxHeight: 240, overflowY: 'auto', marginTop: 4,
        }}>
          {results.length === 0 && !loading ? (
            <div style={{ padding: '12px 14px', color: 'var(--color-text-3)', fontSize: 13 }}>{noResultsText}</div>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(r)}
                style={{
                  display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left',
                  padding: '10px 14px', background: 'none', border: 'none',
                  borderBottom: i < results.length - 1 ? '1px solid var(--color-border)' : 'none',
                  color: 'var(--color-text-1)', cursor: 'pointer', gap: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {/* Show short name + province */}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                  {r.address?.tourism || r.address?.amenity || r.address?.building || r.address?.road || r.name || r.display_name.split(',')[0]}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {r.display_name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main MapSelector ──────────────────────────────────────────────────────────
export default function MapSelector({ destinations, onDestinationsChange, maxStops = 5 }: MapSelectorProps) {
  const { lang } = useLang();
  const t = LANG[lang] || LANG.en;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = destinations.findIndex((d, i) => (d.id || `stop-${i}`) === active.id);
      const newIndex = destinations.findIndex((d, i) => (d.id || `stop-${i}`) === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onDestinationsChange(arrayMove(destinations, oldIndex, newIndex));
      }
    }
  };

  // When marker dragged: keep title, update latLng only (reverse-geocode for address field)
  const handleMarkerDragEnd = useCallback((index: number, lat: number, lng: number) => {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'th,en' },
    })
      .then(r => r.json())
      .then(data => {
        const newDests = [...destinations];
        newDests[index] = {
          ...newDests[index],
          latLng: { lat, lng },
          address: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          // title remains unchanged — driver name is preserved
        };
        onDestinationsChange(newDests);
      })
      .catch(() => {
        const newDests = [...destinations];
        newDests[index] = { ...newDests[index], latLng: { lat, lng }, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
        onDestinationsChange(newDests);
      });
  }, [destinations, onDestinationsChange]);

  // When place selected from search: autofill address+coords, keep title (or suggest)
  const handleSelectAddress = useCallback((index: number, display: string, lat: number, lng: number) => {
    const newDests = [...destinations];
    const shortName = display.split(',')[0].trim();
    newDests[index] = {
      ...newDests[index],
      address: display,
      latLng: { lat, lng },
      // Auto-suggest title only if still empty
      title: newDests[index].title && newDests[index].title!.trim() ? newDests[index].title : shortName,
    };
    onDestinationsChange(newDests);
  }, [destinations, onDestinationsChange]);

  const updateField = useCallback(<K extends keyof Destination>(index: number, field: K, value: Destination[K]) => {
    const newDests = [...destinations];
    newDests[index] = { ...newDests[index], [field]: value };
    onDestinationsChange(newDests);
  }, [destinations, onDestinationsChange]);

  const addDestination = () => {
    if (destinations.length < maxStops) {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      onDestinationsChange([...destinations, { id: newId, title: '', address: '', latLng: null }]);
    }
  };

  const removeDestination = (index: number) => {
    onDestinationsChange(destinations.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      {/* ── Stop List ── */}
      <div className={styles.stopsList}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        >
          <SortableContext
            items={destinations.map((d, i) => d.id || `stop-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            {destinations.map((dest, index) => {
              const id = dest.id || `stop-${index}`;
              const color = DESTINATION_COLORS[index % DESTINATION_COLORS.length];
              const hasCoords = !!dest.latLng;

              return (
                <SortableStopItem key={id} id={id}>
                  <div className={styles.stopRow}>
                    {/* Number badge */}
                    <div className={styles.stopIcon} style={{ backgroundColor: color }}>
                      {String(index + 1)}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>

                      {/* ① Place Name — Primary field for driver */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
                          📍 {t.placeName} <span style={{ color: 'var(--color-error)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder={t.placeNameHint}
                          className="form-input"
                          value={dest.title || ''}
                          onChange={e => updateField(index, 'title', e.target.value)}
                          required
                          style={{ fontWeight: 600, fontSize: '0.95rem' }}
                        />
                      </div>

                      {/* ② Address search → fills coordinates */}
                      <div style={{ background: 'var(--color-bg-2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--color-border)' }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 6, display: 'block' }}>
                          🔍 {t.searchAddress}
                        </label>
                        <AddressSearch
                          placeholder={t.searchHint}
                          hint=""
                          onSelectResult={(display, lat, lng) => handleSelectAddress(index, display, lat, lng)}
                          noResultsText={t.noResults}
                          searchingText={t.searching}
                        />

                        {/* Coordinates display */}
                        {hasCoords ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <div style={{
                              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                              background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2,132,199,0.2)',
                              borderRadius: 8, padding: '6px 10px', fontSize: 12,
                            }}>
                              <span style={{ color: color, fontSize: 14 }}>📌</span>
                              <span style={{ color: 'var(--color-text-2)', fontFamily: 'monospace' }}>
                                {dest.latLng!.lat.toFixed(5)}, {dest.latLng!.lng.toFixed(5)}
                              </span>
                              <span style={{ color: 'var(--color-text-3)', fontSize: 10, marginLeft: 4, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                — {dest.address}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newDests = [...destinations];
                                newDests[index] = { ...newDests[index], latLng: null, address: '' };
                                onDestinationsChange(newDests);
                              }}
                              title={t.clearCoords}
                              style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: 4, opacity: 0.7 }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                            ยังไม่มีพิกัด — ค้นหาสถานที่หรือลากหมุดบนแผนที่
                          </div>
                        )}
                      </div>

                      {/* ③ Task description */}
                      <input
                        type="text"
                        placeholder={t.descPlaceholder}
                        className="form-input"
                        style={{ fontSize: '0.88rem', background: 'rgba(255,255,255,0.03)' }}
                        value={dest.description || ''}
                        onChange={e => updateField(index, 'description', e.target.value)}
                      />

                      {/* ④ Passengers */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--color-text-2)', fontSize: '0.9rem' }}>
                        <input
                          type="checkbox"
                          checked={dest.hasPassengers || false}
                          onChange={e => updateField(index, 'hasPassengers', e.target.checked)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        {t.hasPassengers}
                      </label>
                      {dest.hasPassengers && (
                        <input
                          type="number"
                          placeholder={t.count}
                          className="form-input"
                          style={{ width: 130, fontSize: '0.9rem', padding: '6px' }}
                          value={dest.passengerCount || ''}
                          onChange={e => updateField(index, 'passengerCount', parseInt(e.target.value) || 0)}
                          min={1}
                          required
                        />
                      )}
                    </div>

                    {/* Remove button */}
                    {destinations.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeDestination(index)}
                        title="Remove stop"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </SortableStopItem>
              );
            })}
          </SortableContext>
        </DndContext>

        {destinations.length < maxStops && (
          <button type="button" className="btn-ghost" onClick={addDestination} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            {t.addStop}
          </button>
        )}
      </div>

      {/* ── Interactive Map ── */}
      <div className={styles.mapWrapper}>
        <LeafletMap destinations={destinations} onMarkerDragEnd={handleMarkerDragEnd} />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
