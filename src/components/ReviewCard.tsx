import React from 'react';
import { Review } from '@/src/types';
import { formatDate } from '@/src/lib/formatters';

interface ReviewCardProps {
  review: Review;
  showHotelName?: boolean;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  showHotelName = false,
}) => {
  return (
    <div
      id={`review-card-${review.id}`}
      className="space-y-3 rounded-2xl border border-[#E6E2D3] bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D1DBC2] bg-[#ECF3E5] text-xs font-bold uppercase text-[#3F6212] sm:h-10 sm:w-10 sm:text-sm">
            {review.guest_name ? review.guest_name.substring(0, 2) : 'VS'}
          </div>

          <div className="min-w-0">
            <h5 className="truncate text-sm font-bold text-[#2D2A26]">
              {review.guest_name || 'Voyageur'}
            </h5>
            <p className="mt-0.5 text-[11px] leading-snug text-[#8C887D] sm:text-xs">
              Séjour vérifié • {formatDate(review.created_at)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[#3F6212] px-2 py-1.5 text-xs font-extrabold text-white shadow-xs sm:px-2.5">
          <span>{Number(review.rating).toFixed(1)}</span>
          <span className="text-[#D1DBC2]">/ 5</span>
        </div>
      </div>

      {showHotelName && review.hotel && (
        <div className="inline-block max-w-full rounded-md border border-[#D1DBC2] bg-[#ECF3E5] px-2.5 py-1 text-xs font-semibold text-[#3F6212]">
          <span className="break-words">
            {review.hotel.name} ({review.hotel.region})
          </span>
        </div>
      )}

      <p className="break-words text-sm italic leading-relaxed text-[#2D2A26]">
        &quot;{review.comment}&quot;
      </p>

      {(review.cleanliness || review.comfort || review.location || review.staff) && (
        <div className="grid grid-cols-1 gap-2 border-t border-[#E6E2D3] pt-3 text-[11px] text-[#6B6658] min-[360px]:grid-cols-2 sm:grid-cols-4">
          {review.cleanliness && (
            <div>Propreté: <span className="font-bold text-[#2D2A26]">{review.cleanliness}/5</span></div>
          )}
          {review.comfort && (
            <div>Confort: <span className="font-bold text-[#2D2A26]">{review.comfort}/5</span></div>
          )}
          {review.location && (
            <div>Emplacement: <span className="font-bold text-[#2D2A26]">{review.location}/5</span></div>
          )}
          {review.staff && (
            <div>Personnel: <span className="font-bold text-[#2D2A26]">{review.staff}/5</span></div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewCard;
