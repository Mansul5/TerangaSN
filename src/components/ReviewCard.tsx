import React from 'react';
import { Star, ThumbsUp, User as UserIcon } from 'lucide-react';
import { Review } from '@/src/types';
import { formatDate } from '@/src/lib/formatters';

interface ReviewCardProps {
  review: Review;
  showHotelName?: boolean;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review, showHotelName = false }) => {
  return (
    <div 
      id={`review-card-${review.id}`}
      className="bg-white rounded-2xl p-5 border border-[#E6E2D3] shadow-xs space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ECF3E5] text-[#3F6212] font-bold flex items-center justify-center text-sm uppercase border border-[#D1DBC2]">
            {review.guest_name ? review.guest_name.substring(0, 2) : 'VS'}
          </div>
          <div>
            <h5 className="font-bold text-sm text-[#2D2A26]">{review.guest_name || 'Voyageur'}</h5>
            <p className="text-xs text-[#8C887D]">Séjour vérifié • {formatDate(review.created_at)}</p>
          </div>
        </div>

        {/* Rating Score */}
        <div className="flex items-center gap-1.5 bg-[#3F6212] text-white font-extrabold text-xs px-2.5 py-1.5 rounded-lg shadow-xs">
          <span>{Number(review.rating).toFixed(1)}</span>
          <span className="text-[#D1DBC2]">/ 10</span>
        </div>
      </div>

      {showHotelName && review.hotel && (
        <div className="text-xs font-semibold text-[#3F6212] bg-[#ECF3E5] px-2.5 py-1 rounded-md inline-block border border-[#D1DBC2]">
          {review.hotel.name} ({review.hotel.region})
        </div>
      )}

      <p className="text-sm text-[#2D2A26] leading-relaxed italic">
        "{review.comment}"
      </p>

      {/* Sub-ratings if available */}
      {(review.cleanliness || review.comfort || review.location || review.staff) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#E6E2D3] text-[11px] text-[#6B6658]">
          {review.cleanliness && <div>Propreté: <span className="font-bold text-[#2D2A26]">{review.cleanliness}/10</span></div>}
          {review.comfort && <div>Confort: <span className="font-bold text-[#2D2A26]">{review.comfort}/10</span></div>}
          {review.location && <div>Emplacement: <span className="font-bold text-[#2D2A26]">{review.location}/10</span></div>}
          {review.staff && <div>Personnel: <span className="font-bold text-[#2D2A26]">{review.staff}/10</span></div>}
        </div>
      )}
    </div>
  );
};
