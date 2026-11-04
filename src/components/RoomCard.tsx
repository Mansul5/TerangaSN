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
  Tag,
  ArrowUpRight
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
    baseTotalPrice?: number;
    averageNightlyPrice: number;
    hasSpecialRates: boolean;
    hasCategoryWideSpecialRate?: boolean;
    hasUnitSpecificRates?: boolean;
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
  const baseTotalPrice = pricing?.baseTotalPrice ?? effectiveTotalPrice;
  const hasCategoryWideSpecialRate = Boolean(pricing?.hasCategoryWideSpecialRate);
  const hasUnitSpecificRates = Boolean(pricing?.hasUnitSpecificRates);
  const unitRatesVary = hasUnitSpecificRates && !hasCategoryWideSpecialRate;
  const displayedTotalPrice = unitRatesVary ? baseTotalPrice : effectiveTotalPrice;
  const displayedNightlyPrice = unitRatesVary ? room.price_per_night : effectiveNightlyPrice;
  const discountPercent = hasCategoryWideSpecialRate && baseTotalPrice > effectiveTotalPrice
    ? Math.round((baseTotalPrice - effectiveTotalPrice) * 100 / baseTotalPrice)
    : 0;
  const isAvailable = pricing?.isAvailable !== undefined ? pricing.isAvailable : true;
  const minAvailable = pricing?.minAvailable;

  const getCancellationBadge = (policy: string) => {
    switch (policy) {
      case 'free_cancellation':
        return (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#D5E6D9] bg-[#F0F7F1] px-3 py-1.5 text-xs font-semibold text-[#285541]">
            <ShieldCheck size={14} className="shrink-0" />
            <span>Annulation GRATUITE</span>
          </div>
        );
      case 'flexible':
        return (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#E8DDC8] bg-[#FBF7EE] px-3 py-1.5 text-xs font-semibold text-[#947448]">
            <Check size={14} className="shrink-0" />
            <span>Annulation flexible</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[#F5F2EC] px-3 py-1.5 text-xs font-medium text-[#706D65]">
            <Info size={14} className="shrink-0" />
            <span>Non remboursable</span>
          </div>
        );
    }
  };

  return (
    <div
      id={`room-card-${room.id}`}
      className={`group relative overflow-hidden rounded-[26px] border p-5 transition-all duration-300 sm:p-7 ${
        !isAvailable
          ? 'border-[#E7E5DF] bg-[#FAF9F6] opacity-85'
          : isSelected
            ? 'border-[#2D5A46] bg-[#F7FAF6] ring-2 ring-[#2D5A46]/10 shadow-[0_18px_55px_-35px_rgba(29,70,49,0.5)]'
            : 'border-[#E9E5DC] bg-white hover:border-[#C9D7CB] hover:shadow-[0_20px_55px_-38px_rgba(26,62,45,0.45)]'
      }`}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-0">
        <div className="space-y-4 lg:col-span-5 lg:pr-7">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="break-words font-serif text-xl font-semibold leading-tight tracking-tight text-[#1D392D] sm:text-2xl">
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
            <p className="break-words text-sm leading-6 text-[#77776F]">
              {room.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-[#35483D]">
            {room.bed_type && (
              <span className="flex max-w-full items-center gap-1.5 rounded-full border border-[#EAE7DF] bg-[#FAF9F6] px-3 py-1.5 font-medium">
                <Bed size={14} className="shrink-0 text-[#A18455]" />
                <span className="break-words">{room.bed_type}</span>
              </span>
            )}

            {room.size_sqm && (
              <span className="flex items-center gap-1.5 rounded-full border border-[#EAE7DF] bg-[#FAF9F6] px-3 py-1.5 font-medium">
                <Maximize2 size={14} className="text-[#A18455]" />
                {room.size_sqm} m²
              </span>
            )}

            <span className="flex max-w-full items-center gap-1.5 rounded-full border border-[#EAE7DF] bg-[#FAF9F6] px-3 py-1.5 font-medium">
              <Users size={14} className="shrink-0 text-[#A18455]" />
              <span>
                Jusqu&apos;à {room.capacity_adults} adulte{room.capacity_adults > 1 ? 's' : ''}
                {room.capacity_children > 0 && ` + ${room.capacity_children} enfant`}
              </span>
            </span>
          </div>

          {room.amenities && room.amenities.length > 0 && (
            <div className="pt-2">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#89877D]">
                Équipements inclus
              </p>
              <div className="flex flex-wrap gap-2">
                {room.amenities.map((item, idx) => (
                  <BadgeEquipement key={idx} id={item} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center space-y-4 border-t border-[#ECE8DF] pt-5 lg:col-span-3 lg:border-l lg:border-t-0 lg:px-7 lg:pt-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#89877D]">
            Conditions du séjour
          </p>

          <div>{getCancellationBadge(room.cancellation_policy)}</div>

          <div className="space-y-3 text-xs leading-5 text-[#77776F]">
            <div className="flex items-start gap-1.5 text-[#4B5B50]">
              <CalendarCheck size={14} className="mt-0.5 shrink-0 text-[#2D5A46]" />
              <span>Confirmation selon les conditions de l&apos;hébergement</span>
            </div>
            <div className="flex items-start gap-1.5 text-[#4B5B50]">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-[#A18455]" />
              <span>Modalités de paiement indiquées avant confirmation</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between border-t border-[#ECE8DF] pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <div className="text-left min-[380px]:text-right">
            <p className="text-xs text-[#89877D]">
              Prix pour {nightsCount} nuit{nightsCount > 1 ? 's' : ''}
            </p>

            <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5 min-[380px]:justify-end">
              {discountPercent > 0 && (
                <span className="text-sm text-[#89877D] line-through">{formatFCFA(baseTotalPrice)}</span>
              )}
              <span className="break-words font-serif text-xl font-bold text-[#A18455] sm:text-2xl">
                {formatFCFA(displayedTotalPrice)}
              </span>
            </div>
            {discountPercent > 0 && (
              <p className="text-[11px] font-semibold text-emerald-700">Économisez {discountPercent}%</p>
            )}

            <p className="mt-0.5 text-xs text-[#89877D]">
              {formatFCFA(displayedNightlyPrice)} / nuit (moy.)
            </p>

            {hasCategoryWideSpecialRate && (
              <span className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <Tag size={11} />
                <span>Tarif spécial appliqué</span>
              </span>
            )}
            {!hasCategoryWideSpecialRate && hasUnitSpecificRates && (
              <p className="mt-1 text-[10px] text-[#74786F]">Tarif calculé selon les unités attribuées</p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-stretch pt-3 min-[380px]:justify-end">
            <button
              type="button"
              id={`select-room-btn-${room.id}`}
              disabled={!isAvailable}
              onClick={() => onSelect(room, selectedQuantity || 1)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-semibold shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5A46] min-[380px]:w-auto sm:px-5 sm:text-sm ${
                !isAvailable
                  ? 'cursor-not-allowed bg-[#E9E8E3] text-[#9C9B94]'
                  : isSelected
                    ? 'cursor-pointer bg-[#244B39] text-white hover:bg-[#193D2D]'
                    : 'cursor-pointer bg-[#284C3B] text-white hover:bg-[#193D2D] hover:shadow-lg'
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
                <><span>Choisir cette chambre</span><ArrowUpRight size={15} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
