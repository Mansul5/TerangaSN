import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Calendar as CalendarIcon, 
  Users, 
  ChevronDown, 
  Minus, 
  Plus,
  Compass
} from 'lucide-react';
import { SENEGAL_REGIONS } from '@/src/types';

interface SearchBarProps {
  initialDestination?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialRooms?: number;
  onSearch: (params: {
    destination: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    rooms: number;
  }) => void;
  variant?: 'hero' | 'compact';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  initialDestination = '',
  initialCheckIn = '',
  initialCheckOut = '',
  initialAdults = 2,
  initialChildren = 0,
  initialRooms = 1,
  onSearch,
  variant = 'hero',
}) => {
  // Default dates: tomorrow and 3 days later if not provided
  const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const getInThreeDays = () => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  };

  const [destination, setDestination] = useState<string>(initialDestination);
  const [checkIn, setCheckIn] = useState<string>(initialCheckIn || getTomorrow());
  const [checkOut, setCheckOut] = useState<string>(initialCheckOut || getInThreeDays());
  const [adults, setAdults] = useState<number>(initialAdults);
  const [children, setChildren] = useState<number>(initialChildren);
  const [rooms, setRooms] = useState<number>(initialRooms);

  const [isDestinationOpen, setIsDestinationOpen] = useState<boolean>(false);
  const [isGuestsOpen, setIsGuestsOpen] = useState<boolean>(false);

  const destRef = useRef<HTMLDivElement>(null);
  const guestsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (destRef.current && !destRef.current.contains(event.target as Node)) {
        setIsDestinationOpen(false);
      }
      if (guestsRef.current && !guestsRef.current.contains(event.target as Node)) {
        setIsGuestsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDestinationOpen(false);
    setIsGuestsOpen(false);
    onSearch({
      destination,
      checkIn,
      checkOut,
      adults,
      children,
      rooms,
    });
  };

  const isHero = variant === 'hero';

  return (
    <form 
      id="search-bar-form"
      onSubmit={handleSearchSubmit}
      className={`w-full ${
        isHero 
          ? 'bg-[#F0EDE4] p-2 sm:p-2.5 rounded-2xl shadow-xl border border-[#D9D5C3]' 
          : 'bg-white p-1.5 sm:p-2 rounded-xl shadow-xs border border-[#E6E2D3]'
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 sm:gap-2">
        
        {/* Destination input */}
        <div ref={destRef} className="relative md:col-span-4">
          <div 
            id="destination-input-trigger"
            onClick={() => setIsDestinationOpen(!isDestinationOpen)}
            className="flex items-center gap-3 bg-white px-3.5 py-3 rounded-xl cursor-pointer hover:bg-[#FAF9F6] transition border border-[#E6E2D3] h-full"
          >
            <MapPin className="text-[#8B5E34] shrink-0" size={20} />
            <div className="flex-1 min-w-0 text-left">
              <label className="block text-[10px] font-bold tracking-wider text-[#6B6658] uppercase">
                Destination au Sénégal
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onClick={(e) => { e.stopPropagation(); setIsDestinationOpen(true); }}
                placeholder="Dakar, Saly, Saint-Louis..."
                className="w-full text-sm font-semibold text-[#2D2A26] placeholder:text-[#8C887D] bg-transparent outline-none truncate"
              />
            </div>
            <ChevronDown size={16} className={`text-[#8C887D] transition-transform ${isDestinationOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Destination Dropdown */}
          {isDestinationOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-[#E6E2D3] z-50 p-2 max-h-80 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-bold text-[#6B6658] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E6E2D3]">
                <Compass size={14} className="text-[#3F6212]" />
                Destinations populaires au Sénégal
              </div>
              <button
                type="button"
                id="select-all-destinations"
                onClick={() => {
                  setDestination('');
                  setIsDestinationOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-[#3F6212] hover:bg-[#ECF3E5] transition flex items-center justify-between mt-1"
              >
                <span>🌍 Tout le Sénégal</span>
                <span className="text-xs text-[#8C887D] font-normal">Toutes régions</span>
              </button>
              {SENEGAL_REGIONS.map((reg) => (
                <button
                  key={reg.id}
                  type="button"
                  id={`select-region-${reg.id}`}
                  onClick={() => {
                    setDestination(reg.name);
                    setIsDestinationOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[#2D2A26] hover:bg-[#F0EDE4] transition flex items-center justify-between group"
                >
                  <div>
                    <span className="font-semibold group-hover:text-[#3F6212]">{reg.name}</span>
                    <p className="text-xs text-[#6B6658] line-clamp-1">{reg.description}</p>
                  </div>
                  <MapPin size={16} className="text-[#8C887D] group-hover:text-[#8B5E34] shrink-0 ml-2" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dates (Check-in / Check-out) */}
        <div className="md:col-span-4 grid grid-cols-2 gap-1.5">
          {/* Check-in */}
          <div className="flex items-center gap-2.5 bg-white px-3 py-3 rounded-xl border border-[#E6E2D3]">
            <CalendarIcon size={18} className="text-[#3F6212] shrink-0" />
            <div className="min-w-0 flex-1">
              <label htmlFor="check-in-date-input" className="block text-[10px] font-bold tracking-wider text-[#6B6658] uppercase">
                Arrivée
              </label>
              <input
                id="check-in-date-input"
                type="date"
                value={checkIn}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (checkOut && e.target.value >= checkOut) {
                    const nextDay = new Date(e.target.value);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setCheckOut(nextDay.toISOString().split('T')[0]);
                  }
                }}
                className="w-full text-xs font-semibold text-[#2D2A26] bg-transparent outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Check-out */}
          <div className="flex items-center gap-2.5 bg-white px-3 py-3 rounded-xl border border-[#E6E2D3]">
            <CalendarIcon size={18} className="text-[#3F6212] shrink-0" />
            <div className="min-w-0 flex-1">
              <label htmlFor="check-out-date-input" className="block text-[10px] font-bold tracking-wider text-[#6B6658] uppercase">
                Départ
              </label>
              <input
                id="check-out-date-input"
                type="date"
                value={checkOut}
                min={checkIn || new Date().toISOString().split('T')[0]}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-xs font-semibold text-[#2D2A26] bg-transparent outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Guests & Rooms */}
        <div ref={guestsRef} className="relative md:col-span-3">
          <div
            id="guests-counter-trigger"
            onClick={() => setIsGuestsOpen(!isGuestsOpen)}
            className="flex items-center gap-3 bg-white px-3.5 py-3 rounded-xl cursor-pointer hover:bg-[#FAF9F6] transition border border-[#E6E2D3] h-full"
          >
            <Users size={19} className="text-[#8B5E34] shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <label className="block text-[10px] font-bold tracking-wider text-[#6B6658] uppercase">
                Voyageurs & Chambres
              </label>
              <span className="text-xs sm:text-sm font-semibold text-[#2D2A26] truncate block">
                {adults} ad., {children > 0 ? `${children} enf., ` : ''}{rooms} ch.
              </span>
            </div>
            <ChevronDown size={16} className={`text-[#8C887D] transition-transform ${isGuestsOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Guests Popover */}
          {isGuestsOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-[#E6E2D3] z-50 p-4 space-y-4 w-72">
              {/* Adults */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#2D2A26]">Adultes</p>
                  <p className="text-xs text-[#6B6658]">18 ans et plus</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    id="decrease-adults-btn"
                    disabled={adults <= 1}
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-8 h-8 rounded-lg border border-[#D9D5C3] flex items-center justify-center text-[#2D2A26] hover:border-[#3F6212] hover:text-[#3F6212] disabled:opacity-30 cursor-pointer"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center font-bold text-sm text-[#2D2A26]">{adults}</span>
                  <button
                    type="button"
                    id="increase-adults-btn"
                    disabled={adults >= 10}
                    onClick={() => setAdults(adults + 1)}
                    className="w-8 h-8 rounded-lg border border-[#D9D5C3] flex items-center justify-center text-[#2D2A26] hover:border-[#3F6212] hover:text-[#3F6212] disabled:opacity-30 cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="flex items-center justify-between border-t border-[#E6E2D3] pt-3">
                <div>
                  <p className="text-sm font-bold text-[#2D2A26]">Enfants</p>
                  <p className="text-xs text-[#6B6658]">0 à 17 ans</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    id="decrease-children-btn"
                    disabled={children <= 0}
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="w-8 h-8 rounded-lg border border-[#D9D5C3] flex items-center justify-center text-[#2D2A26] hover:border-[#3F6212] hover:text-[#3F6212] disabled:opacity-30 cursor-pointer"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center font-bold text-sm text-[#2D2A26]">{children}</span>
                  <button
                    type="button"
                    id="increase-children-btn"
                    disabled={children >= 8}
                    onClick={() => setChildren(children + 1)}
                    className="w-8 h-8 rounded-lg border border-[#D9D5C3] flex items-center justify-center text-[#2D2A26] hover:border-[#3F6212] hover:text-[#3F6212] disabled:opacity-30 cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Rooms */}
              <div className="flex items-center justify-between border-t border-[#E6E2D3] pt-3">
                <div>
                  <p className="text-sm font-bold text-[#2D2A26]">Chambres</p>
                  <p className="text-xs text-[#6B6658]">Nombre d'unités</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    id="decrease-rooms-btn"
                    disabled={rooms <= 1}
                    onClick={() => setRooms(Math.max(1, rooms - 1))}
                    className="w-8 h-8 rounded-lg border border-[#D9D5C3] flex items-center justify-center text-[#2D2A26] hover:border-[#3F6212] hover:text-[#3F6212] disabled:opacity-30 cursor-pointer"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center font-bold text-sm text-[#2D2A26]">{rooms}</span>
                  <button
                    type="button"
                    id="increase-rooms-btn"
                    disabled={rooms >= 6}
                    onClick={() => setRooms(rooms + 1)}
                    className="w-8 h-8 rounded-lg border border-[#D9D5C3] flex items-center justify-center text-[#2D2A26] hover:border-[#3F6212] hover:text-[#3F6212] disabled:opacity-30 cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                id="apply-guests-btn"
                onClick={() => setIsGuestsOpen(false)}
                className="w-full py-2.5 bg-[#3F6212] hover:bg-[#365314] text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Valider
              </button>
            </div>
          )}
        </div>

        {/* Submit Search Button */}
        <div className="md:col-span-1 flex items-center">
          <button
            type="submit"
            id="main-search-submit-button"
            className="w-full h-full min-h-[48px] bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-sm px-4 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
          >
            <Search size={20} />
            <span className="md:hidden">Rechercher</span>
          </button>
        </div>

      </div>
    </form>
  );
};
