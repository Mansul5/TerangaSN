import React, { useEffect, useRef } from 'react';
import { Hotel } from '@/src/types';
import { formatFCFA } from '@/src/lib/formatters';
import L from 'leaflet';

interface InteractiveMapProps {
  hotels: Hotel[];
  selectedHotelId?: string | null;
  onSelectHotel: (hotelId: string) => void;
  className?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  hotels,
  selectedHotelId,
  onSelectHotel,
  className = 'h-[500px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Senegal center approx (around Thiès / Dakar region)
    const defaultCenter: [number, number] = [14.6928, -17.4467];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 8,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear previous markers
    Object.values(markersRef.current).forEach((marker: any) => {
      if (marker && typeof marker.remove === 'function') {
        marker.remove();
      }
    });
    markersRef.current = {};

    const validHotels = hotels.filter(h => h.latitude && h.longitude && !isNaN(h.latitude) && !isNaN(h.longitude));

    if (validHotels.length === 0) {
      map.setView(defaultCenter, 7);
      return;
    }

    const bounds = L.latLngBounds([]);

    validHotels.forEach((hotel) => {
      const isSelected = hotel.id === selectedHotelId;
      const minPrice = hotel.min_price || 25000;

      // Custom HTML Marker matching Booking style price tags
      const customIcon = L.divIcon({
        className: 'custom-hotel-pin',
        html: `
          <div style="
            background: ${isSelected ? '#1d4ed8' : '#ffffff'};
            color: ${isSelected ? '#ffffff' : '#0f172a'};
            border: 2px solid ${isSelected ? '#1e40af' : '#2563eb'};
            border-radius: 20px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 800;
            font-family: inherit;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            cursor: pointer;
            transform: translate(-50%, -50%);
            transition: all 0.2s ease;
          ">
            <span>${formatFCFA(minPrice)}</span>
          </div>
        `,
        iconSize: [80, 30],
        iconAnchor: [40, 15],
      });

      const marker = L.marker([hotel.latitude, hotel.longitude], { icon: customIcon }).addTo(map);

      // Popup Content
      const popupHtml = `
        <div style="width: 220px; font-family: inherit; border-radius: 12px; overflow: hidden;">
          <img src="${hotel.photos?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80'}" 
               style="width: 100%; height: 110px; object-fit: cover; display: block;" />
          <div style="padding: 10px 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #2563eb; margin-bottom: 2px;">
              ${hotel.city || ''}, ${hotel.region}
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; line-height: 1.2;">
              ${hotel.name}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 10px; color: #64748b;">Dès</span>
              <span style="font-size: 14px; font-weight: 900; color: #0f172a;">${formatFCFA(minPrice)}</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        onSelectHotel(hotel.id);
      });

      markersRef.current[hotel.id] = marker;
      bounds.extend([hotel.latitude, hotel.longitude]);
    });

    if (validHotels.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    // Leaflet map resizing observer to avoid grey boxes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [hotels, selectedHotelId, onSelectHotel]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" id="senegal-interactive-map" />
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-slate-200 z-[1000] text-xs font-semibold text-slate-700 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>{hotels.length} hébergement{hotels.length > 1 ? 's' : ''} au Sénégal</span>
      </div>
    </div>
  );
};
