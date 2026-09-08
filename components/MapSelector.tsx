'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Destination, LatLng } from '@/lib/types';
import { useLang } from '@/lib/use-lang';
import { useAuth } from '@/lib/auth-context';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './map-selector.module.css';

export interface FavoritePlace {
  id: string;
  name: string;
  address: string;
  latLng: LatLng;
  icon?: string;
}

// Default initial suggestions for Phuket if user has no saved favorites yet
const DEFAULT_PHUKET_PLACES: FavoritePlace[] = [
  { id: 'fav-hkt', name: '✈️ สนามบินภูเก็ต (HKT)', address: 'Mai Khao, Thalang District, Phuket 83110', latLng: { lat: 8.1132, lng: 98.3169 }, icon: '✈️' },
  { id: 'fav-central', name: '🛍️ เซ็นทรัล ภูเก็ต', address: 'Vichitsongkram Rd, Wichit, Mueang Phuket 83000', latLng: { lat: 7.8916, lng: 98.3678 }, icon: '🛍️' },
  { id: 'fav-bkk-hosp', name: '🏥 รพ.กรุงเทพ ภูเก็ต', address: 'Hongyok Utis Rd, Sam Kong, Phuket 83000', latLng: { lat: 7.9042, lng: 98.3756 }, icon: '🏥' },
  { id: 'fav-gov', name: '🏢 ศาลากลางภูเก็ต', address: 'Narison Rd, Talat Yai, Phuket 83000', latLng: { lat: 7.8845, lng: 98.3905 }, icon: '🏢' },
  { id: 'fav-bank', name: '🏦 ธนาคารกสิกรไทย (ภูเก็ต)', address: 'Phangnga Rd, Talat Yai, Phuket 83000', latLng: { lat: 7.8839, lng: 98.3888 }, icon: '🏦' },
];

function SortableStopItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: isDragging ? ('relative' as const) : ('static' as const),
    opacity: isDragging ? 0.8 : 1,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div
          {...attributes}
          {...listeners}
          className={styles.dragHandle}
          title="Drag to reorder stop"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>{children}</div>
      </div>
    </div>
  );
}

const LANG = {
  en: {
    favoritesTitle: '⭐ Frequent & Favorite Places',
    favoritesHint: 'Click to auto-fill into stop. Use ⭐ on any stop to pin new favorites.',
    placeName: 'Place name (for driver)',
    placeNameHint: 'e.g. Central Festival, Phuket Airport',
    searchAddress: 'Search location / Google Places',
    searchHint: 'Type to search in Phuket area…',
    descPlaceholder: '📝 Driver task (e.g. deliver invoice, pickup box)',
    hasPassengers: 'Passengers?',
    count: 'Count',
    addStop: '+ Add Stop',
    roundTrip: '🔄 Add Return Trip (Round Trip)',
    searching: 'Searching Google Places…',
    noResults: 'No places found in Phuket area',
    clearCoords: 'Clear location',
    saveFav: 'Save to Favorites',
    savedFav: 'Saved to favorites!',
    favSavedStatus: 'Saved',
    saveFavPrompt: 'Please search or select a location first',
    removeStop: 'Remove stop',
    stopLabel: 'Stop',
    originLabel: 'Origin',
    estDistance: 'Est. Distance',
    estDuration: 'Est. Drive Time',
    totalStops: 'Total Stops',
  },
  th: {
    favoritesTitle: '⭐ สถานที่ใช้บ่อย & รายการโปรด',
    favoritesHint: 'กดเพื่อเลือกจุดหมายทันที · กด ⭐ ที่จุดแวะเพื่อบันทึกสถานที่โปรดของคุณ',
    placeName: 'ชื่อสถานที่ (สำหรับคนขับ)',
    placeNameHint: 'เช่น เซ็นทรัล ภูเก็ต, สนามบินภูเก็ต',
    searchAddress: 'ค้นหาสถานที่ / Google Places',
    searchHint: 'พิมพ์ค้นหาสถานที่ในภูเก็ต…',
    descPlaceholder: '📝 รายละเอียดงานที่จุดนี้ (เช่น ฝากเช็ค, ยื่นเอกสารช่อง 3)',
    hasPassengers: 'มีผู้โดยสาร?',
    count: 'จำนวน',
    addStop: '+ เพิ่มจุดแวะ',
    roundTrip: '🔄 เพิ่มขากลับ (ไป-กลับ)',
    searching: 'กำลังค้นหา Google Places…',
    noResults: 'ไม่พบสถานที่ในพื้นที่ภูเก็ต',
    clearCoords: 'ล้างพิกัด',
    saveFav: 'บันทึกโปรด',
    savedFav: 'บันทึกแล้ว!',
    favSavedStatus: 'บันทึกแล้ว',
    saveFavPrompt: 'กรุณาค้นหาสถานที่หรือปักหมุดบนแผนที่ก่อนบันทึก',
    removeStop: 'ลบจุดแวะ',
    stopLabel: 'จุดที่',
    originLabel: 'ต้นทาง',
    estDistance: 'ระยะทางประมาณ',
    estDuration: 'เวลาเดินทางประมาณ',
    totalStops: 'จำนวนจุดแวะ',
  },
};

export const DESTINATION_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

interface MapSelectorProps {
  destinations: Destination[];
  onDestinationsChange: (dests: Destination[]) => void;
  maxStops?: number;
}

// ─── Google Maps Script Loader ─────────────────────────────────────────────
let googleMapsLoadingPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps) return Promise.resolve();

  if (!googleMapsLoadingPromise) {
    googleMapsLoadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  return googleMapsLoadingPromise;
}

// ─── Google Maps Component ──────────────────────────────────────────────────
function GoogleMapComponent({
  destinations,
  onMarkerDragEnd,
  onRouteStatsChange,
}: {
  destinations: Destination[];
  onMarkerDragEnd: (index: number, lat: number, lng: number) => void;
  onRouteStatsChange?: (stats: { distanceText: string; durationText: string; totalMeters: number; totalSeconds: number } | null) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const directionsRendererRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setLoaded(true))
      .catch((err) => console.error('Failed to load Google Maps script', err));
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return;
    
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 7.8804, lng: 98.3923 },
      zoom: 11,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });
    mapInstance.current = map;

    const directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#0EA5E9',
        strokeOpacity: 0.85,
        strokeWeight: 5,
      },
    });
    directionsRendererRef.current = directionsRenderer;
  }, [loaded]);

  // Click handler to pin location
  useEffect(() => {
    if (!mapInstance.current) return;

    const google = (window as any).google;
    const clickListener = mapInstance.current.addListener('click', (e: any) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      
      const targetIndex = destinations.findIndex(d => !d.latLng);
      const indexToUpdate = targetIndex !== -1 ? targetIndex : destinations.length - 1;
      if (indexToUpdate >= 0) {
        onMarkerDragEnd(indexToUpdate, lat, lng);
      }
    });

    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [destinations, onMarkerDragEnd]);

  // Sync Markers and Route Path
  useEffect(() => {
    if (!mapInstance.current || !loaded) return;

    const google = (window as any).google;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    const validDests = destinations.filter(d => d.latLng);

    // Create markers
    destinations.forEach((dest, index) => {
      if (!dest.latLng) return;
      
      const color = DESTINATION_COLORS[index % DESTINATION_COLORS.length];
      const marker = new google.maps.Marker({
        position: { lat: dest.latLng.lat, lng: dest.latLng.lng },
        map: mapInstance.current,
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5,
          scale: 14,
          anchor: new google.maps.Point(0, 0),
          labelOrigin: new google.maps.Point(0, 0),
        },
        label: {
          text: String(index + 1),
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: '13px',
        },
        title: dest.title || dest.address || '',
      });

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          onMarkerDragEnd(index, pos.lat(), pos.lng());
        }
      });

      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    });

    // Handle polyline/routing route
    if (directionsRendererRef.current) {
      if (validDests.length >= 2) {
        directionsRendererRef.current.setMap(mapInstance.current);
        const origin = validDests[0].latLng!;
        const destination = validDests[validDests.length - 1].latLng!;
        const waypoints = validDests.slice(1, -1).map(d => ({
          location: new google.maps.LatLng(d.latLng!.lat, d.latLng!.lng),
          stopover: true,
        }));

        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: new google.maps.LatLng(origin.lat, origin.lng),
            destination: new google.maps.LatLng(destination.lat, destination.lng),
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (response: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK && response && directionsRendererRef.current) {
              directionsRendererRef.current.setDirections(response);
              
              // Calculate total distance & duration
              if (response.routes && response.routes[0] && response.routes[0].legs) {
                let totalMeters = 0;
                let totalSeconds = 0;
                response.routes[0].legs.forEach((leg: any) => {
                  totalMeters += leg.distance?.value || 0;
                  totalSeconds += leg.duration?.value || 0;
                });
                const km = (totalMeters / 1000).toFixed(1);
                const mins = Math.ceil(totalSeconds / 60);
                const durationText = mins > 60 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} น.` : `${mins} นาที`;
                if (onRouteStatsChange) {
                  onRouteStatsChange({
                    distanceText: `${km} กม.`,
                    durationText,
                    totalMeters,
                    totalSeconds,
                  });
                }
              }
            } else {
              directionsRendererRef.current?.setMap(null);
              if (onRouteStatsChange) onRouteStatsChange(null);
            }
          }
        );
      } else {
        // Clear route
        directionsRendererRef.current.setMap(null);
        if (onRouteStatsChange) onRouteStatsChange(null);
        
        if (validDests.length === 1) {
          mapInstance.current.setCenter(new google.maps.LatLng(validDests[0].latLng!.lat, validDests[0].latLng!.lng));
          mapInstance.current.setZoom(14);
        }
      }
    }

    // Fit bounds to show all markers
    if (validDests.length > 0 && validDests.length < 2) {
      mapInstance.current.fitBounds(bounds);
      const listener = google.maps.event.addListener(mapInstance.current, 'bounds_changed', () => {
        if (mapInstance.current && mapInstance.current.getZoom()! > 15) {
          mapInstance.current.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, [destinations, loaded, onMarkerDragEnd, onRouteStatsChange]);

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: '320px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }} />
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--color-text-3)', textAlign: 'center' }}>
        💡 ลากหมุด หรือ คลิกบนแผนที่ เพื่อปรับตำแหน่ง · พิกัดจะอัพเดตอัตโนมัติ
      </p>
    </div>
  );
}

// ─── Google Places Address Search ───────────────────────────────────────────
function AddressSearch({
  placeholder,
  hint,
  onSelectResult,
  noResultsText,
  searchingText,
}: {
  placeholder: string;
  hint: string;
  onSelectResult: (display: string, lat: number, lng: number, placeName?: string) => void;
  noResultsText: string;
  searchingText: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setMapsLoaded(true))
      .catch((err) => console.error('Failed to load Google Maps script for AddressSearch', err));
  }, []);

  const search = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q || q.length < 2 || !mapsLoaded) { setResults([]); setShowDropdown(false); return; }

    debounce.current = setTimeout(() => {
      setLoading(true);
      const google = (window as any).google;
      const service = new google.maps.places.AutocompleteService();
      
      const phuketBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(7.4, 98.1),
        new google.maps.LatLng(8.3, 98.6)
      );

      service.getPlacePredictions({
        input: q,
        componentRestrictions: { country: 'th' },
        locationBias: phuketBounds,
      }, (predictions: any, status: any) => {
        setLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setResults(predictions);
          setShowDropdown(true);
        } else {
          setResults([]);
          setShowDropdown(q.length >= 2);
        }
      });
    }, 400);
  }, [mapsLoaded]);

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
    const google = (window as any).google;
    const dummyDiv = document.createElement('div');
    const placesService = new google.maps.places.PlacesService(dummyDiv);
    placesService.getDetails({
      placeId: r.place_id,
      fields: ['name', 'formatted_address', 'geometry'],
    }, (place: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const placeName = place.name || r.structured_formatting?.main_text || r.description.split(',')[0];
        const address = place.formatted_address || r.description;
        onSelectResult(address, lat, lng, placeName);
      }
    });
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          placeholder={placeholder}
          className="form-input"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36, fontSize: '0.88rem', background: 'rgba(255,255,255,0.04)' }}
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
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>
                  📍 {r.structured_formatting?.main_text || r.description.split(',')[0]}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {r.description}
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
  const { userProfile } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang] || LANG.en;

  // Favorites state per user in localStorage
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [routeStats, setRouteStats] = useState<{ distanceText: string; durationText: string; totalMeters: number; totalSeconds: number } | null>(null);

  const storageKey = `concierge_user_fav_places_${userProfile?.uid || 'default'}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setFavorites(JSON.parse(stored));
      } else {
        setFavorites(DEFAULT_PHUKET_PLACES);
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_PHUKET_PLACES));
      }
    } catch {
      setFavorites(DEFAULT_PHUKET_PLACES);
    }
  }, [storageKey]);

  const saveFavoritesToStorage = (list: FavoritePlace[]) => {
    setFavorites(list);
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save favorites', e);
    }
  };

  const checkIsFavorite = (dest: Destination) => {
    if (!dest.title && !dest.address) return false;
    const rawName = (dest.title || dest.address.split(',')[0]).trim();
    const cleanName = rawName.replace(/^[\p{Emoji}\s]+/u, '').trim() || rawName;
    return favorites.some(f => f.name.toLowerCase().trim() === cleanName.toLowerCase());
  };

  const handleToggleFavorite = (dest: Destination) => {
    if (!dest.title && !dest.address) return;
    if (!dest.latLng) return;

    const rawName = (dest.title || dest.address.split(',')[0]).trim();
    const cleanName = rawName.replace(/^[\p{Emoji}\s]+/u, '').trim() || rawName;
    const existingIndex = favorites.findIndex(f => f.name.toLowerCase().trim() === cleanName.toLowerCase());

    if (existingIndex >= 0) {
      const updated = favorites.filter((_, idx) => idx !== existingIndex);
      saveFavoritesToStorage(updated);
    } else {
      const newFav: FavoritePlace = {
        id: `fav-${Date.now()}`,
        name: cleanName,
        address: dest.address,
        latLng: dest.latLng,
        icon: '⭐',
      };
      const updated = [newFav, ...favorites];
      saveFavoritesToStorage(updated);
      setSavedFeedback(t.savedFav);
      setTimeout(() => setSavedFeedback(null), 2500);
    }
  };

  const handleDeleteFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = favorites.filter(f => f.id !== id);
    saveFavoritesToStorage(updated);
  };

  const handleApplyFavorite = (fav: FavoritePlace) => {
    // Find first empty stop, or add new stop
    const emptyIndex = destinations.findIndex(d => !d.title && !d.latLng && !d.address);
    if (emptyIndex !== -1) {
      const newDests = [...destinations];
      newDests[emptyIndex] = {
        ...newDests[emptyIndex],
        title: fav.name.replace(/^[\p{Emoji}\s]+/u, ''),
        address: fav.address,
        latLng: fav.latLng,
      };
      onDestinationsChange(newDests);
    } else if (destinations.length < maxStops) {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      onDestinationsChange([
        ...destinations,
        {
          id: newId,
          title: fav.name.replace(/^[\p{Emoji}\s]+/u, ''),
          address: fav.address,
          latLng: fav.latLng,
        }
      ]);
    }
  };

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

  // Reverse geocoding on drag
  const handleMarkerDragEnd = useCallback((index: number, lat: number, lng: number) => {
    loadGoogleMapsScript()
      .then(() => {
        const google = (window as any).google;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          const newDests = [...destinations];
          let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
            address = results[0].formatted_address;
          }
          newDests[index] = {
            ...newDests[index],
            latLng: { lat, lng },
            address: address,
          };
          onDestinationsChange(newDests);
        });
      })
      .catch(() => {
        const newDests = [...destinations];
        newDests[index] = { ...newDests[index], latLng: { lat, lng }, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
        onDestinationsChange(newDests);
      });
  }, [destinations, onDestinationsChange]);

  // When place selected from search: autofill address+coords and title
  const handleSelectAddress = useCallback((index: number, display: string, lat: number, lng: number, placeName?: string) => {
    const newDests = [...destinations];
    const shortName = placeName || display.split(',')[0].trim();
    newDests[index] = {
      ...newDests[index],
      address: display,
      latLng: { lat, lng },
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

  const addRoundTrip = () => {
    if (destinations.length >= maxStops) return;
    const firstStop = destinations[0];
    if (!firstStop || (!firstStop.title && !firstStop.address)) return;

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const returnTitle = firstStop.title ? `${firstStop.title} (${lang === 'th' ? 'ขากลับ' : 'Return'})` : firstStop.address;
    onDestinationsChange([
      ...destinations,
      {
        id: newId,
        title: returnTitle,
        address: firstStop.address,
        latLng: firstStop.latLng,
        description: lang === 'th' ? 'กลับมาจุดเริ่มต้น' : 'Return to starting origin',
      }
    ]);
  };

  const removeDestination = (index: number) => {
    onDestinationsChange(destinations.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      {/* ── Personal Favorites / Frequent Places Bar ── */}
      <div className={styles.favoritesSection}>
        <div className={styles.favoritesHeader}>
          <div className={styles.favoritesTitle}>
            {t.favoritesTitle}
          </div>
          {savedFeedback && (
            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, animation: 'fadeIn 0.2s ease' }}>
              ✓ {savedFeedback}
            </span>
          )}
        </div>
        <p className={styles.favoritesSubtitle}>{t.favoritesHint}</p>
        <div className={styles.favoritesList}>
          {favorites.map((fav) => (
            <button
              key={fav.id}
              type="button"
              className={styles.favChip}
              onClick={() => handleApplyFavorite(fav)}
              title={fav.address}
            >
              <span>{fav.name}</span>
              <span
                className={styles.favChipDelete}
                onClick={(e) => handleDeleteFavorite(e, fav.id)}
                title="Remove from favorites"
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Route Distance & Duration Banner ── */}
      {routeStats && (
        <div className={styles.routeStatsBanner}>
          <div className={styles.routeStatsLeft}>
            <div className={styles.statItem}>
              <span>🚗</span>
              <span className={styles.statLabel}>{t.estDistance}:</span>
              <span className={styles.statValue}>{routeStats.distanceText}</span>
            </div>
            <div className={styles.statItem}>
              <span>⏱️</span>
              <span className={styles.statLabel}>{t.estDuration}:</span>
              <span className={styles.statValue}>{routeStats.durationText}</span>
            </div>
          </div>
          <div className={styles.statItem} style={{ fontSize: '0.78rem', color: 'var(--color-text-3)' }}>
            <span>📍 {destinations.filter(d => d.latLng).length} {t.totalStops}</span>
          </div>
        </div>
      )}

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
              const isFav = checkIsFavorite(dest);

              return (
                <SortableStopItem key={id} id={id}>
                  <div className={styles.stopCard}>
                    {/* Top Action Bar: Stop # Badge + Origin indicator + Save Fav Pill + Delete Stop */}
                    <div className={styles.stopTopBar}>
                      <div className={styles.stopTopLeft}>
                        <div className={styles.stopBadge} style={{ backgroundColor: color }}>
                          {index + 1}
                        </div>
                        <span className={styles.stopNumberLabel}>
                          {t.stopLabel} {index + 1}
                          {index === 0 && (
                            <span className={styles.stopOriginTag}>{t.originLabel}</span>
                          )}
                        </span>
                      </div>

                      <div className={styles.stopHeaderActions}>
                        {/* Bookmark / Save to favorites button */}
                        <button
                          type="button"
                          className={`${styles.actionPillBtn} ${isFav ? styles.savedFavPillBtn : styles.saveFavPillBtn}`}
                          onClick={() => {
                            if (!hasCoords && !dest.title && !dest.address) {
                              alert(t.saveFavPrompt);
                              return;
                            }
                            handleToggleFavorite(dest);
                          }}
                          title={isFav ? (lang === 'th' ? 'ลบออกจากรายการโปรด' : 'Remove from favorites') : t.saveFav}
                        >
                          <span className={styles.favStarIcon}>{isFav ? '★' : '☆'}</span>
                          <span className={styles.favBtnText}>
                            {isFav ? t.favSavedStatus : t.saveFav}
                          </span>
                        </button>

                        {/* Remove stop button */}
                        {destinations.length > 1 && (
                          <button
                            type="button"
                            className={styles.deleteStopBtn}
                            onClick={() => removeDestination(index)}
                            title={t.removeStop}
                            aria-label={t.removeStop}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Full-width Google Places Address Search */}
                    <div className={styles.addressSearchRow}>
                      <AddressSearch
                        placeholder={t.searchHint}
                        hint=""
                        onSelectResult={(display, lat, lng, name) => handleSelectAddress(index, display, lat, lng, name)}
                        noResultsText={t.noResults}
                        searchingText={t.searching}
                      />
                    </div>

                    {/* Place Name Title & Coordinates */}
                    <div className={styles.searchSection}>
                      <input
                        type="text"
                        placeholder={`${t.placeNameHint} *`}
                        className={styles.stopTitleInput}
                        value={dest.title || ''}
                        onChange={e => updateField(index, 'title', e.target.value)}
                        required
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />

                      {/* Coordinates info pill */}
                      {hasCoords ? (
                        <div className={styles.coordsBadge}>
                          <span style={{ flexShrink: 0 }}>📌</span>
                          <span className={styles.coordsText}>
                            {dest.latLng!.lat.toFixed(5)}, {dest.latLng!.lng.toFixed(5)}
                          </span>
                          <span className={styles.coordsAddress}>
                            — {dest.address}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newDests = [...destinations];
                              newDests[index] = { ...newDests[index], latLng: null, address: '' };
                              onDestinationsChange(newDests);
                            }}
                            title={t.clearCoords}
                            className={styles.clearCoordsBtn}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className={styles.pinHintText}>
                          💡 ค้นหาสถานที่ หรือคลิกบนแผนที่ด้านล่างเพื่อปักหมุด
                        </div>
                      )}
                    </div>

                    {/* Driver Task Note & Passengers Row */}
                    <div className={styles.stopDetailsRow}>
                      <input
                        type="text"
                        placeholder={t.descPlaceholder}
                        className={styles.taskInput}
                        value={dest.description || ''}
                        onChange={e => updateField(index, 'description', e.target.value)}
                      />

                      <div className={styles.passengerToggleArea}>
                        <label className={styles.passengerLabel}>
                          <input
                            type="checkbox"
                            checked={dest.hasPassengers || false}
                            onChange={e => {
                              const checked = e.target.checked;
                              updateField(index, 'hasPassengers', checked);
                              if (checked && (!dest.passengerCount || dest.passengerCount < 1)) {
                                updateField(index, 'passengerCount', 1);
                              }
                            }}
                            className={styles.passengerCheckbox}
                          />
                          <span>👥 {t.hasPassengers}</span>
                        </label>

                        {dest.hasPassengers && (
                          <div className={styles.passengerStepper}>
                            <button
                              type="button"
                              className={styles.stepperBtn}
                              onClick={() => {
                                const current = dest.passengerCount || 1;
                                if (current > 1) {
                                  updateField(index, 'passengerCount', current - 1);
                                }
                              }}
                              disabled={(dest.passengerCount || 1) <= 1}
                              aria-label="Decrease passenger count"
                            >
                              −
                            </button>
                            <div className={styles.stepperDisplay}>
                              <input
                                type="number"
                                className={styles.passengerCountInput}
                                value={dest.passengerCount || 1}
                                onChange={e => {
                                  const val = parseInt(e.target.value);
                                  updateField(index, 'passengerCount', isNaN(val) ? 1 : Math.max(1, Math.min(20, val)));
                                }}
                                min={1}
                                max={20}
                                required
                              />
                              <span className={styles.stepperUnit}>
                                {lang === 'th' ? 'คน' : 'pax'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={styles.stepperBtn}
                              onClick={() => {
                                const current = dest.passengerCount || 1;
                                if (current < 20) {
                                  updateField(index, 'passengerCount', current + 1);
                                }
                              }}
                              disabled={(dest.passengerCount || 1) >= 20}
                              aria-label="Increase passenger count"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </SortableStopItem>
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Action Buttons Row: Add Stop & Round Trip */}
        <div className={styles.stopButtonsRow}>
          {destinations.length < maxStops && (
            <button type="button" className={styles.addStopBtn} onClick={addDestination}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t.addStop}</span>
            </button>
          )}

          {destinations.length >= 1 && destinations.length < maxStops && (
            <button type="button" className={styles.roundTripBtn} onClick={addRoundTrip} title="Add starting point as return destination">
              <span>{t.roundTrip}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Interactive Google Map ── */}
      <div className={styles.mapWrapper}>
        <GoogleMapComponent
          destinations={destinations}
          onMarkerDragEnd={handleMarkerDragEnd}
          onRouteStatsChange={setRouteStats}
        />
      </div>
    </div>
  );
}

