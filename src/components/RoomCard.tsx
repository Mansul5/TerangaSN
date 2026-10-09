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
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#D1DBC2] bg-[#ECF3E5] px-2.5 py-1 text-xs font-semibold text-[#3F6212]">
            <ShieldCheck size={14} className="shrink-0" />
            <span>Annulation GRATUITE</span>
          </div>
        );
      case 'flexible':
        return (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#E6E2D3] bg-[#F0EDE4] px-2.5 py-1 text-xs font-semibold text-[#8B5E34]">
            <Check size={14} className="shrink-0" />
            <span>Annulation flexible</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[#F0EDE4] px-2.5 py-1 text-xs font-medium text-[#6B6658]">
            <Info size={14} className="shrink-0" />
            <span>Non remboursable</span>
          </div>
        );
    }
  };

  return (
    <div
      id={`room-card-${room.id}`}
      className={`overflow-hidden rounded-2xl border p-4 transition-all duration-200 sm:p-5 ${
        !isAvailable
          ? 'border-gray-200 bg-gray-50/70 opacity-80'
          : isSelected
            ? 'border-[#3F6212] bg-[#ECF3E5]/20 ring-2 ring-[#3F6212]/20 shadow-md'
            : 'border-[#E6E2D3] bg-white hover:border-[#D9D5C3] hover:shadow-xs'
      }`}
    >
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="break-words font-serif text-base font-bold leading-tight text-[#2D2A26] sm:text-lg">
                {room.name}
              </h4>

              {!isAvailable && (
                <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                  <Lock size={12} className="shrink-0" />
                  <span>Complet pour ces dates</span>
                </span>
              )}

              {isAvailable && minAvailable !== undefined && minAvailable > 0 && minAvailable <= 3 && (
                <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  <Sparkles size={12} className="shrink-0" />
                  <span>Plus que {minAvailable} chambre{minAvailable > 1 ? 's' : ''} disponible{minAvailable > 1 ? 's' : ''}</span>
                </span>
              )}
            </div>
          </div>

          {room.description && (
            <p className="break-words text-xs leading-relaxed text-[#6B6658]">
              {room.description}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 text-xs text-[#2D2A26] sm:gap-2">
            {room.bed_type && (
              <span className="flex max-w-full items-center gap-1.5 rounded-lg border border-[#E6E2D3] bg-[#F0EDE4] px-2.5 py-1 font-medium">
                <Bed size={14} className="shrink-0 text-[#8B5E34]" />
                <span className="break-words">{room.bed_type}</span>
              </span>
            )}

            {room.size_sqm && (
              <span className="flex items-center gap-1.5 rounded-lg border border-[#E6E2D3] bg-[#F0EDE4] px-2.5 py-1 font-medium">
                <Maximize2 size={14} className="text-[#8B5E34]" />
                {room.size_sqm} m²
              </span>
            )}

            <span className="flex max-w-full items-center gap-1.5 rounded-lg border border-[#E6E2D3] bg-[#F0EDE4] px-2.5 py-1 font-medium">
              <Users size={14} className="shrink-0 text-[#8B5E34]" />
              <span>
                Jusqu&apos;à {room.capacity_adults} adulte{room.capacity_adults > 1 ? 's' : ''}
                {room.capacity_children > 0 && ` + ${room.capacity_children} enfant`}
              </span>
            </span>
          </div>

          {room.amenities && room.amenities.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6B6658]">
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

        <div className="flex flex-col justify-center space-y-3 border-t border-[#E6E2D3] pt-4 lg:col-span-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B6658]">
            Conditions du séjour
          </p>

          <div>{getCancellationBadge(room.cancellation_policy)}</div>

          <div className="space-y-1.5 text-xs text-[#6B6658]">
            <div className="flex items-start gap-1.5 text-[#2D2A26]">
              <CalendarCheck size={14} className="mt-0.5 shrink-0 text-[#3F6212]" />
              <span>Confirmation selon les conditions de l&apos;hébergement</span>
            </div>
            <div className="flex items-start gap-1.5 text-[#2D2A26]">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-[#D97706]" />
              <span>Modalités de paiement indiquées avant confirmation</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between border-t border-[#E6E2D3] pt-4 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="text-left min-[380px]:text-right">
            <p className="text-xs text-[#6B6658]">
              Prix pour {nightsCount} nuit{nightsCount > 1 ? 's' : ''}
            </p>

            <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5 min-[380px]:justify-end">
              <span className="break-words font-serif text-xl font-bold text-[#8B5E34] sm:text-2xl">
                {formatFCFA(effectiveTotalPrice)}
              </span>
            </div>

            <p className="mt-0.5 text-xs text-[#6B6658]">
              {formatFCFA(effectiveNightlyPrice)} / nuit (moy.)
            </p>

            {hasSpecialRates && (
              <span className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <Tag size={11} />
                <span>Tarif spécial appliqué</span>
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center justify-stretch pt-3 min-[380px]:justify-end">
            <button
              type="button"
              id={`select-room-btn-${room.id}`}
              disabled={!isAvailable}
              onClick={() => onSelect(room, selectedQuantity || 1)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition min-[380px]:w-auto sm:px-5 sm:text-sm ${
                !isAvailable
                  ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                  : isSelected
                    ? 'cursor-pointer bg-[#3F6212] text-white hover:bg-[#365314]'
                    : 'cursor-pointer bg-[#D97706] text-white hover:bg-[#B45309] hover:shadow-md'
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

export default RoomCard;
