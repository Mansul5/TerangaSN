import React from 'react';
import { 
  Users, 
  Bed, 
  Maximize2, 
  Check, 
  ShieldCheck, 
  CalendarCheck, 
  Info,
  Sparkles,
  Lock,
  Tag
} from 'lucide-react';
import { RoomType } from '@/src/types';
import { formatFCFA } from '@/src/lib/formatters';
import { BadgeEquipement } from './BadgeEquipement';

interface RoomCardProps {
  room: RoomType;
  nightsCount: number;
  isSelected: boolean;
  selectedQuantity?: number;
  onSelect: (room: RoomType, quantity: number) => void;
  hotelCheckInTime?: string;
  hotelCheckOutTime?: string;
  pricing?: {
    totalPrice: number;
    averageNightlyPrice: number;
    hasSpecialRates: boolean;
    minAvailable?: number;
    isAvailable?: boolean;
  };
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  nightsCount = 1,
  isSelected,
  selectedQuantity = 1,
  onSelect,
  pricing,
}) => {
  const effectiveTotalPrice = pricing ? pricing.totalPrice : room.price_per_night * (nightsCount || 1);
  const effectiveNightlyPrice = pricing ? pricing.averageNightlyPrice : room.price_per_night;
  const isAvailable = pricing?.isAvailable !== undefined ? pricing.isAvailable : true;
  const minAvailable = pricing?.minAvailable;
  const hasSpecialRates = Boolean(pricing?.hasSpecialRates);

  const getCancellationBadge = (policy: string) => {
    switch (policy) {
      case 'free_cancellation':
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#3F6212] font-semibold bg-[#ECF3E5] px-2.5 py-1 rounded-lg border border-[#D1DBC2]">
            <ShieldCheck size={14} />
            <span>Annulation GRATUITE</span>
          </div>
        );
      case 'flexible':
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#8B5E34] font-semibold bg-[#F0EDE4] px-2.5 py-1 rounded-lg border border-[#E6E2D3]">
            <Check size={14} />
            <span>Annulation flexible</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#6B6658] font-medium bg-[#F0EDE4] px-2.5 py-1 rounded-lg">
            <Info size={14} />
            <span>Non remboursable</span>
          </div>
        );
    }
  };

  return (
    <div
      id={`room-card-${room.id}`}
      className={`bg-white rounded-2xl border transition-all duration-200 p-5 overflow-hidden ${
        !isAvailable
          ? 'border-gray-200 bg-gray-50/70 opacity-80'
          : isSelected 
            ? 'border-[#3F6212] ring-2 ring-[#3F6212]/20 shadow-md bg-[#ECF3E5]/20' 
            : 'border-[#E6E2D3] hover:border-[#D9D5C3] hover:shadow-xs'
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Room Details & Specs */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-lg font-serif font-bold text-[#2D2A26] leading-tight">
                {room.name}
              </h4>
              {!isAvailable && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 mt-1">
                  <Lock size={12} />
                  <span>Complet pour ces dates</span>
                </span>
              )}
              {isAvailable && minAvailable !== undefined && minAvailable > 0 && minAvailable <= 3 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 mt-1">
                  <Sparkles size={12} />
                  <span>Plus que {minAvailable} chambre{minAvailable > 1 ? 's' : ''} disponible{minAvailable > 1 ? 's' : ''}</span>
                </span>
              )}
            </div>
          </div>

          {room.description && (
            <p className="text-xs text-[#6B6658] leading-relaxed">
              {room.description}
            </p>
          )}

          {/* Specs tags */}
          <div className="flex flex-wrap gap-2 text-xs text-[#2D2A26]">
            {room.bed_type && (
              <span className="flex items-center gap-1.5 bg-[#F0EDE4] px-2.5 py-1 rounded-lg font-medium border border-[#E6E2D3]">
                <Bed size={14} className="text-[#8B5E34]" />
                {room.bed_type}
              </span>
            )}
            {room.size_sqm && (
              <span className="flex items-center gap-1.5 bg-[#F0EDE4] px-2.5 py-1 rounded-lg font-medium border border-[#E6E2D3]">
                <Maximize2 size={14} className="text-[#8B5E34]" />
                {room.size_sqm} m²
              </span>
            )}
            <span className="flex items-center gap-1.5 bg-[#F0EDE4] px-2.5 py-1 rounded-lg font-medium border border-[#E6E2D3]">
              <Users size={14} className="text-[#8B5E34]" />
              Jusqu'à {room.capacity_adults} adulte{room.capacity_adults > 1 ? 's' : ''}
              {room.capacity_children > 0 && ` + ${room.capacity_children} enfant`}
            </span>
          </div>

          {/* Room Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-bold text-[#6B6658] uppercase tracking-wider mb-2">
                Équipements inclus
              </p>
              <div className="flex flex-wrap gap-1.5">
                {room.amenities.map((item, idx) => (
                  <BadgeEquipement key={idx} id={item} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Middle Column: Policies */}
        <div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-[#E6E2D3] pt-4 lg:pt-0 lg:pl-5 space-y-3 flex flex-col justify-center">
          <p className="text-[11px] font-bold text-[#6B6658] uppercase tracking-wider">
            Conditions du séjour
          </p>
          
          <div>{getCancellationBadge(room.cancellation_policy)}</div>

          <div className="space-y-1.5 text-xs text-[#6B6658]">
            <div className="flex items-center gap-1.5 text-[#2D2A26]">
              <CalendarCheck size={14} className="text-[#3F6212] shrink-0" />
              <span>Confirmation instantanée</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#2D2A26]">
              <Sparkles size={14} className="text-[#D97706] shrink-0" />
              <span>Paiement sur place à l'arrivée</span>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Selection */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#E6E2D3] pt-4 lg:pt-0 lg:pl-5 flex flex-col justify-between">
          <div className="text-right">
            <p className="text-xs text-[#6B6658]">Prix pour {nightsCount} nuit{nightsCount > 1 ? 's' : ''}</p>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <span className="text-2xl font-serif font-bold text-[#8B5E34]">
                {formatFCFA(effectiveTotalPrice)}
              </span>
            </div>
            <p className="text-xs text-[#6B6658] mt-0.5">
              {formatFCFA(effectiveNightlyPrice)} / nuit (moy.)
            </p>
            {hasSpecialRates && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1">
                <Tag size={11} />
                <span>Tarif spécial appliqué</span>
              </span>
            )}
            <p className="text-[10px] text-[#8C887D] mt-0.5">Taxes et frais compris</p>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              id={`select-room-btn-${room.id}`}
              disabled={!isAvailable}
              onClick={() => onSelect(room, selectedQuantity || 1)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-xs ${
                !isAvailable
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isSelected
                    ? 'bg-[#3F6212] hover:bg-[#365314] text-white cursor-pointer'
                    : 'bg-[#D97706] hover:bg-[#B45309] text-white hover:shadow-md cursor-pointer'
              }`}
            >
              {!isAvailable ? (
                <>
                  <Lock size={15} />
                  <span>Complet</span>
                </>
              ) : isSelected ? (
                <>
                  <Check size={16} />
                  <span>Sélectionnée</span>
                </>
              ) : (
                <span>Choisir cette chambre</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
