import React, { useEffect, useRef } from 'react';

import { Hotel } from '@/src/types';
import { formatFCFA } from '@/src/lib/formatters';

import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  FullscreenControl,
  LngLatBounds,
  setWorkerUrl,
} from 'maplibre-gl';

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

interface InteractiveMapProps {
  hotels: Hotel[];
  selectedHotelId?: string | null;
  onSelectHotel: (hotelId: string) => void;
  className?: string;
}

interface MarkerEntry {
  marker: Marker;
  element: HTMLButtonElement;
}

const DEFAULT_CENTER: [number, number] = [-17.4467, 14.6928];

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80';

const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  hotels,
  selectedHotelId,
  onSelectHotel,
  className = 'h-[360px] sm:h-[440px] lg:h-[500px] w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-inner border border-slate-200',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const markersRef = useRef<Record<string, MarkerEntry>>({});
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const onSelectHotelRef = useRef(onSelectHotel);

  useEffect(() => {
    onSelectHotelRef.current = onSelectHotel;
  }, [onSelectHotel]);

  /*
   * Initialisation de la carte.
   * La carte n'est créée qu'une seule fois.
   */
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const map = new Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 7,
      minZoom: 4,
      maxZoom: 19,
      attributionControl: {
        compact: true,
      },
      cooperativeGestures: false,
    });

    map.addControl(
      new NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      'top-right'
    );

    map.addControl(
      new FullscreenControl(),
      'top-right'
    );

    mapInstanceRef.current = map;

    resizeObserverRef.current = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserverRef.current.observe(mapContainerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      Object.values(markersRef.current).forEach(({ marker }) => {
        marker.remove();
      });

      markersRef.current = {};

      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  /*
   * Gestion des logements et de leurs marqueurs.
   */
  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const renderMarkers = () => {
      /*
       * Suppression des anciens marqueurs.
       */
      Object.values(markersRef.current).forEach(({ marker }) => {
        marker.remove();
      });

      markersRef.current = {};

      const validHotels = hotels.filter(
        (hotel) =>
          typeof hotel.latitude === 'number' &&
          typeof hotel.longitude === 'number' &&
          Number.isFinite(hotel.latitude) &&
          Number.isFinite(hotel.longitude)
      );

      if (validHotels.length === 0) {
        map.easeTo({
          center: DEFAULT_CENTER,
          zoom: 7,
          duration: 500,
        });

        return;
      }

      const bounds = new LngLatBounds();

      validHotels.forEach((hotel) => {
        const isSelected = hotel.id === selectedHotelId;
        const minPrice = hotel.min_price || 25000;

        /*
         * Marqueur personnalisé.
         */
        const markerElement = document.createElement('button');

        markerElement.type = 'button';
        markerElement.setAttribute(
          'aria-label',
          `Voir ${hotel.name}`
        );

        markerElement.style.cssText = `
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          cursor: pointer;
          border: 2px solid ${isSelected ? '#1e40af' : '#2563eb'};
          border-radius: 9999px;
          padding: 5px 9px;
          background: ${isSelected ? '#1d4ed8' : '#ffffff'};
          color: ${isSelected ? '#ffffff' : '#0f172a'};
          font-size: 11px;
          font-weight: 800;
          font-family: inherit;
          line-height: 1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          transition:
            transform 0.2s ease,
            background-color 0.2s ease,
            color 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
          outline: none;
        `;

        markerElement.innerHTML = `
          <span>${escapeHtml(formatFCFA(minPrice))}</span>
        `;

        markerElement.addEventListener('mouseenter', () => {
          markerElement.style.transform = 'scale(1.08)';
          markerElement.style.boxShadow =
            '0 6px 16px rgba(0, 0, 0, 0.30)';
        });

        markerElement.addEventListener('mouseleave', () => {
          markerElement.style.transform = 'scale(1)';
          markerElement.style.boxShadow =
            '0 4px 12px rgba(0, 0, 0, 0.25)';
        });

        markerElement.addEventListener('focus', () => {
          markerElement.style.boxShadow =
            '0 0 0 3px rgba(37, 99, 235, 0.25), 0 4px 12px rgba(0, 0, 0, 0.25)';
        });

        markerElement.addEventListener('blur', () => {
          markerElement.style.boxShadow =
            '0 4px 12px rgba(0, 0, 0, 0.25)';
        });

        const marker = new Marker({
          element: markerElement,
          anchor: 'center',
        })
          .setLngLat([
            hotel.longitude as number,
            hotel.latitude as number,
          ])
          .addTo(map);

        /*
         * Popup.
         */
        const imageUrl =
          hotel.photos?.[0] || FALLBACK_IMAGE;

        const popupContent = document.createElement('div');

        popupContent.style.cssText = `
          width: min(220px, calc(100vw - 72px));
          overflow: hidden;
          border-radius: 12px;
          font-family: inherit;
        `;

        popupContent.innerHTML = `
          <img
            src="${escapeHtml(imageUrl)}"
            alt="${escapeHtml(hotel.name)}"
            style="
              width: 100%;
              height: 110px;
              object-fit: cover;
              display: block;
            "
          />

          <div style="padding: 10px 12px;">
            <div
              style="
                font-size: 11px;
                font-weight: 700;
                color: #2563eb;
                margin-bottom: 2px;
              "
            >
              ${escapeHtml(hotel.city || '')}
              ${hotel.city ? ', ' : ''}
              ${escapeHtml(hotel.region || '')}
            </div>

            <div
              style="
                font-size: 13px;
                font-weight: 800;
                color: #0f172a;
                margin-bottom: 6px;
                line-height: 1.2;
              "
            >
              ${escapeHtml(hotel.name)}
            </div>

            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: baseline;
              "
            >
              <span
                style="
                  font-size: 10px;
                  color: #64748b;
                "
              >
                Dès
              </span>

              <span
                style="
                  font-size: 14px;
                  font-weight: 900;
                  color: #0f172a;
                "
              >
                ${escapeHtml(formatFCFA(minPrice))}
              </span>
            </div>
          </div>
        `;

        const popup = new Popup({
          offset: 16,
          closeButton: true,
          closeOnClick: true,
          maxWidth: '260px',
        }).setDOMContent(popupContent);

        marker.setPopup(popup);

        markerElement.addEventListener('click', () => {
          onSelectHotelRef.current(hotel.id);

          marker.togglePopup();
        });

        markersRef.current[hotel.id] = {
          marker,
          element: markerElement,
        };

        bounds.extend([
          hotel.longitude as number,
          hotel.latitude as number,
        ]);
      });

      /*
       * Ajustement automatique de la caméra.
       */
      if (!bounds.isEmpty()) {
        if (validHotels.length === 1) {
          const hotel = validHotels[0];

          map.easeTo({
            center: [
              hotel.longitude as number,
              hotel.latitude as number,
            ],
            zoom: 14,
            duration: 700,
          });
        } else {
          map.fitBounds(bounds, {
            padding: {
              top: 80,
              bottom: 80,
              left: 80,
              right: 80,
            },
            maxZoom: 14,
            duration: 700,
          });
        }
      }
    };

    /*
     * Si le style est déjà chargé, on dessine immédiatement.
     * Sinon, on attend son chargement.
     */
    if (map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once('load', renderMarkers);
    }

    return () => {
      map.off('load', renderMarkers);
    };
  }, [hotels, selectedHotelId]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        id="senegal-interactive-map"
      />

      <div
        className="
          absolute
          bottom-3
          left-3
          bg-white/95
          backdrop-blur-md
          px-3
          py-1.5
          rounded-lg
          shadow-md
          border
          border-slate-200
          z-[10]
          text-xs
          font-semibold
          text-slate-700
          flex
          items-center
          gap-2
        "
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />

        <span>
          {hotels.length} hébergement
          {hotels.length > 1 ? 's' : ''} au Sénégal
        </span>
      </div>
    </div>
  );
};

export default InteractiveMap;