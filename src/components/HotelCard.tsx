import React, { useState } from 'react';
import { 
  Heart, 
  MapPin, 
  ChevronRight, 
  Star, 
  Waves, 
  ShieldCheck, 
  Sparkles,
  CalendarCheck
} from 'lucide-react';
import { Hotel } from '@/src/types';
import { formatFCFA, formatDistance, getRatingLabel, getCategoryLabel } from '@/src/lib/formatters';
import { BadgeEquipement } from './BadgeEquipement';
import { useAuth } from '@/src/context/AuthContext';
import { toggleFavorite } from '@/src/lib/supabase/api';

interface HotelCardProps {
  hotel: Hotel;
  onSelect: (hotelId: string) => void;
  isFavoriteInitial?: boolean;
  onAuthRequired?: () => void;
}

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  onSelect,
  isFavoriteInitial = false,
  onAuthRequired,
}) => {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState<boolean>(isFavoriteInitial);
  const [isFavLoading, setIsFavLoading] = useState<boolean>(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);

  const photos = hotel.photos && hotel.photos.length > 0 
    ? hotel.photos 
    : ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'];

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      if (onAuthRequired) onAuthRequired();
      return;
    }

    try {
      setIsFavLoading(true);
      const { isFavorite: updatedFav } = await toggleFavorite(user.id, hotel.id);
      setIsFavorite(updatedFav);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setIsFavLoading(false);
    }
  };

  const minPrice = hotel.min_price || 
    (hotel.room_types && hotel.room_types.length > 0 
      ? Math.min(...hotel.room_types.map(r => r.price_per_night)) 
      : 25000);

  return (
    <div
      id={`hotel-card-${hotel.id}`}
      onClick={() => onSelect(hotel.id)}
      className="group bg-white rounded-2xl border border-[#E6E2D3] shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col sm:flex-row cursor-pointer relative hover:border-[#3F6212]/60"
    >
      {/* Image Gallery Column */}
      <div className="sm:w-72 md:w-80 h-56 sm:h-auto shrink-0 relative overflow-hidden bg-[#F0EDE4]">
        <img
          src={photos[activePhotoIdx]}
          alt={hotel.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* Category tag */}
        <div className="absolute top-3 left-3 bg-[#2D2A26]/85 backdrop-blur-md text-[#FAF9F6] text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-xs">
          {getCategoryLabel(hotel.category)}
        </div>

        {/* Favorite Heart Button */}
        <button
          type="button"
          id={`fav-btn-${hotel.id}`}
          onClick={handleFavoriteClick}
          disabled={isFavLoading}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md hover:bg-white text-[#2D2A26] hover:text-rose-600 flex items-center justify-center shadow-md transition-transform active:scale-90 z-20 cursor-pointer"
        >
          <Heart
            size={18}
            className={`${isFavorite ? 'fill-rose-500 text-rose-500' : 'text-[#6B6658]'}`}
          />
        </button>

        {/* Multiple photos indicator if > 1 */}
        {photos.length > 1 && (
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-10 px-2">
            {photos.slice(0, 5).map((_, idx) => (
              <span
                key={idx}
                onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(idx); }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  activePhotoIdx === idx ? 'w-5 bg-white shadow' : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Details Content Column */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
        <div>
          {/* Top Line: Name & Rating Badge */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B5E34] mb-1">
                <MapPin size={13} className="shrink-0 text-[#8B5E34]" />
                <span className="truncate">{hotel.city}, {hotel.region}</span>
                {hotel.distance_beach_m !== null && hotel.distance_beach_m <= 1000 && (
                  <span className="text-[#6B6658] font-normal ml-1">
                    • {formatDistance(hotel.distance_beach_m)} de la plage
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-[#2D2A26] group-hover:text-[#3F6212] transition line-clamp-1">
                {hotel.name}
              </h3>
            </div>

            {/* Rating Box */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-[#2D2A26]">
                  {getRatingLabel(hotel.rating || 8.0)}
                </p>
                <p className="text-[11px] text-[#8C887D]">
                  {hotel.reviews_count > 0 ? `${hotel.reviews_count} avis` : 'Nouveau'}
                </p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#3F6212] text-white font-extrabold text-sm sm:text-base flex items-center justify-center shadow-xs">
                {hotel.rating && hotel.rating > 0 ? hotel.rating.toFixed(1) : '8.5'}
              </div>
            </div>
          </div>

          {/* Description snippet */}
          <p className="text-xs sm:text-sm text-[#6B6658] line-clamp-2 mt-2 leading-relaxed">
            {hotel.description}
          </p>

          {/* Amenities Badges list */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {hotel.amenities?.slice(0, 4).map((amenity) => (
              <BadgeEquipement key={amenity} id={amenity} size="sm" />
            ))}
            {hotel.amenities && hotel.amenities.length > 4 && (
              <span className="text-[11px] font-medium text-[#8C887D] self-center">
                +{hotel.amenities.length - 4} autres
              </span>
            )}
          </div>
        </div>

        {/* Bottom Line: Price & Booking action */}
        <div className="border-t border-[#E6E2D3] pt-3 mt-4 flex items-end justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-[#3F6212] font-semibold">
              <ShieldCheck size={14} />
              <span>Paiement sur place à l'hôtel</span>
            </div>
            <p className="text-[11px] text-[#8C887D]">À partir de</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-2xl font-serif font-bold text-[#8B5E34]">
                {formatFCFA(minPrice)}
              </span>
              <span className="text-xs text-[#6B6658]">/ nuit</span>
            </div>
            <p className="text-[10px] text-[#8C887D]">Taxes et frais compris</p>
          </div>

          <button
            type="button"
            id={`view-availability-${hotel.id}`}
            onClick={(e) => { e.stopPropagation(); onSelect(hotel.id); }}
            className="bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer shrink-0"
          >
            <span>Voir les disponibilités</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
