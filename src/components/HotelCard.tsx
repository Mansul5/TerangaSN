import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronRight,
  Heart,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { Lodging } from '@/src/types';
import {
  formatFCFA,
  formatDistance,
  getCategoryLabel,
} from '@/src/lib/formatters';
import { BadgeEquipement } from './BadgeEquipement';
import { useAuth } from '@/src/context/AuthContext';
import { toggleFavorite } from '@/src/lib/supabase/api';

interface HotelCardProps {
  hotel: Lodging;
  onSelect: (hotelId: string) => void;
  isFavoriteInitial?: boolean;
  onAuthRequired?: () => void;
}

const BRAND = '#284C3B';

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  onSelect,
  isFavoriteInitial = false,
  onAuthRequired,
}) => {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(isFavoriteInitial);
  const [isFavLoading, setIsFavLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  useEffect(() => {
    setIsFavorite(isFavoriteInitial);
  }, [isFavoriteInitial, hotel.id]);

  useEffect(() => {
    setActivePhotoIdx(0);
    setFavoriteError(null);
  }, [hotel.id]);

  const photos = (hotel.photos ?? []).filter(
    (photo): photo is string => typeof photo === 'string' && /^https?:\/\//i.test(photo)
  );
  const photoIndex = Math.min(activePhotoIdx, Math.max(photos.length - 1, 0));

  const roomPrices = (hotel.room_types ?? [])
    .map((room) => Number(room.price_per_night))
    .filter((price) => Number.isFinite(price) && price > 0);
  const listedPrice = Number(hotel.min_price);
  const minPrice =
    Number.isFinite(listedPrice) && listedPrice > 0
      ? listedPrice
      : roomPrices.length > 0
        ? Math.min(...roomPrices)
        : null;

  const location = [hotel.city, hotel.region].filter(Boolean).join(', ');
  const distance = hotel.distance_beach_m;
  const isNearBeach =
    typeof distance === 'number' &&
    Number.isFinite(distance) &&
    distance >= 0 &&
    distance <= 1000;

  const openHotel = () => onSelect(hotel.id);

  const changePhoto = (direction: number) => {
    if (photos.length < 2) return;
    setActivePhotoIdx((current) => (current + direction + photos.length) % photos.length);
  };

  const handleFavorite = async () => {
    if (isFavLoading) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }

    setFavoriteError(null);
    setIsFavLoading(true);
    try {
      const result = await toggleFavorite(user.id, hotel.id);
      setIsFavorite(result.isFavorite);
    } catch (error) {
      console.error('Impossible de modifier le favori :', error);
      setFavoriteError('Impossible de modifier les favoris. Réessayez.');
    } finally {
      setIsFavLoading(false);
    }
  };

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#E9E2D5] bg-white transition-all duration-300 hover:border-[#B79B69]/60 hover:shadow-[0_18px_45px_-24px_rgba(27,56,45,0.28)] sm:flex-row">
      <div className="relative h-56 shrink-0 overflow-hidden bg-[#F0EDE6] sm:h-auto sm:min-h-[275px] sm:w-[42%] lg:w-[39%]">
        {photos.length > 0 ? (
          <button
            type="button"
            onClick={openHotel}
            className="block h-full w-full overflow-hidden text-left"
            aria-label={`Découvrir ${hotel.name}`}
          >
            <img
              src={photos[photoIndex]}
              alt={`${hotel.name} — photo ${photoIndex + 1} sur ${photos.length}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              loading="lazy"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={openHotel}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#8A8D84]"
            aria-label={`Découvrir ${hotel.name}`}
          >
            <Building2 size={35} strokeWidth={1.4} />
            <span className="text-xs">Photo non disponible</span>
          </button>
        )}

        <span className="absolute left-3 top-3 max-w-[calc(100%-5rem)] truncate rounded-lg bg-[#1B382D]/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
          {getCategoryLabel(hotel.category)}
        </span>

        <button
          type="button"
          onClick={handleFavorite}
          disabled={isFavLoading}
          aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-pressed={isFavorite}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#30352F] shadow-md transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#284C3B] disabled:cursor-wait disabled:opacity-60"
        >
          <Heart size={19} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changePhoto(-1)}
              aria-label="Photo précédente"
              className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1B382D] opacity-90 shadow-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => changePhoto(1)}
              aria-label="Photo suivante"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1B382D] opacity-90 shadow-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <ArrowRight size={16} />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1B382D]/75 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white">
              {photoIndex + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 p-4 sm:p-5 lg:p-6">
        <div className="min-w-0">
          {location && (
            <div className="mb-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-[#746C5D]">
              <MapPin size={14} className="shrink-0 text-[#B79B69]" />
              <span className="truncate">{location}</span>
            </div>
          )}
          <h3 className="font-serif text-xl font-semibold leading-snug text-[#1B382D] sm:text-[22px]">
            <button type="button" onClick={openHotel} className="text-left hover:underline hover:underline-offset-4 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#284C3B]">
              {hotel.name}
            </button>
          </h3>

          {hotel.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#77796F]">
              {hotel.description}
            </p>
          )}

          {isNearBeach && (
            <p className="mt-2 text-xs font-medium text-[#284C3B]">
              À {formatDistance(distance)} de la plage
            </p>
          )}

          {!!hotel.amenities?.length && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {hotel.amenities.slice(0, 4).map((amenity) => (
                <BadgeEquipement key={amenity} id={amenity} size="sm" />
              ))}
              {hotel.amenities.length > 4 && (
                <span className="px-1 text-xs text-[#77796F]">
                  +{hotel.amenities.length - 4} autres
                </span>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#E9E2D5] pt-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-[#6F776E]">
            <ShieldCheck size={15} className="shrink-0 text-[#284C3B]" />
            <span>Prix et conditions détaillés avant confirmation</span>
          </div>
          <div className="flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-end min-[380px]:justify-between">
            <div className="min-w-0">
              {minPrice !== null ? (
                <>
                  <p className="text-xs text-[#77796F]">À partir de</p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                    <span className="font-serif text-2xl font-bold text-[#1B382D]">
                      {formatFCFA(minPrice)}
                    </span>
                    <span className="text-xs text-[#77796F]">/ nuit</span>
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-[#77796F]">Tarif à consulter</p>
              )}
            </div>
            <button
              type="button"
              onClick={openHotel}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#284C3B] min-[380px]:w-auto"
              style={{ backgroundColor: BRAND }}
            >
              Voir les disponibilités
              <ChevronRight size={17} />
            </button>
          </div>
          {favoriteError && (
            <p role="alert" className="mt-3 text-xs text-red-700">{favoriteError}</p>
          )}
        </div>
      </div>
    </article>
  );
};

export default HotelCard;
