import React, { useEffect, useState } from 'react';
import { 
  Filter, 
  Map, 
  List, 
  ArrowUpDown, 
  RotateCcw, 
  Building2, 
  Loader2, 
  SlidersHorizontal,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';
import { Hotel, SearchFilters, HOTEL_AMENITIES } from '@/src/types';
import { fetchHotels } from '@/src/lib/supabase/api';
import { HotelCard } from '@/src/components/HotelCard';
import { InteractiveMap } from '@/src/components/InteractiveMap';
import { SearchBar } from '@/src/components/SearchBar';
import { formatFCFA } from '@/src/lib/formatters';

interface SearchResultsPageProps {
  initialFilters: Partial<SearchFilters>;
  onSelectHotel: (hotelId: string) => void;
  onAuthRequired: () => void;
  onOpenSupabaseModal: () => void;
}

export const SearchResultsPage: React.FC<SearchResultsPageProps> = ({
  initialFilters,
  onSelectHotel,
  onAuthRequired,
  onOpenSupabaseModal,
}) => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  
  // Mobile / Desktop View Mode
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'split'>('split');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);

  // Filter States
  const [destination, setDestination] = useState<string>(initialFilters.destination || '');
  const [checkIn, setCheckIn] = useState<string>(initialFilters.checkIn || '');
  const [checkOut, setCheckOut] = useState<string>(initialFilters.checkOut || '');
  const [adults, setAdults] = useState<number>(initialFilters.adults || 2);
  const [children, setChildren] = useState<number>(initialFilters.children || 0);
  const [rooms, setRooms] = useState<number>(initialFilters.rooms || 1);

  const [maxPrice, setMaxPrice] = useState<number>(initialFilters.maxPrice || 350000);
  const [minRating, setMinRating] = useState<number>(initialFilters.minRating || 0);
  const [category, setCategory] = useState<string>(initialFilters.category || 'all');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initialFilters.amenities || []);
  const [maxBeachDistance, setMaxBeachDistance] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'recommended' | 'price_asc' | 'price_desc' | 'rating_desc'>('recommended');

  const loadHotels = async () => {
    setIsLoading(true);
    try {
      const { data, count, error } = await fetchHotels({
        destination,
        checkIn,
        checkOut,
        adults,
        children,
        rooms,
        maxPrice: maxPrice < 350000 ? maxPrice : undefined,
        minRating: minRating > 0 ? minRating : undefined,
        category: category !== 'all' ? category : undefined,
        amenities: selectedAmenities,
        maxBeachDistance: maxBeachDistance > 0 ? maxBeachDistance : undefined,
        sortBy,
      });

      if (error) {
        console.warn('Hotels query warning:', error.message);
      }
      setHotels(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching filtered hotels:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHotels();
  }, [destination, maxPrice, minRating, category, selectedAmenities, maxBeachDistance, sortBy]);

  const toggleAmenity = (amenityId: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenityId) ? prev.filter(a => a !== amenityId) : [...prev, amenityId]
    );
  };

  const handleResetFilters = () => {
    setMaxPrice(350000);
    setMinRating(0);
    setCategory('all');
    setSelectedAmenities([]);
    setMaxBeachDistance(0);
    setSortBy('recommended');
  };

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-16">
      
      {/* Top Search Bar Header */}
      <div className="bg-[#3F6212] px-4 sm:px-6 py-4 shadow-inner border-b border-[#365314]">
        <div className="max-w-7xl mx-auto">
          <SearchBar
            variant="compact"
            initialDestination={destination}
            initialCheckIn={checkIn}
            initialCheckOut={checkOut}
            initialAdults={adults}
            initialChildren={children}
            initialRooms={rooms}
            onSearch={(params) => {
              setDestination(params.destination);
              setCheckIn(params.checkIn);
              setCheckOut(params.checkOut);
              setAdults(params.adults);
              setChildren(params.children);
              setRooms(params.rooms);
            }}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        
        {/* Results Bar: Title, Count, Sort, and View Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E2D3]">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#2D2A26]">
              {destination ? `Hébergements à "${destination}"` : 'Tous les hébergements au Sénégal'}
            </h1>
            <p className="text-xs text-[#6B6658] mt-0.5">
              {totalCount} établissement{totalCount > 1 ? 's' : ''} trouvé{totalCount > 1 ? 's' : ''} • Tarifs en Francs CFA
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Toggle on Mobile */}
            <button
              type="button"
              id="mobile-filters-trigger"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6E2D3] rounded-xl text-xs font-bold text-[#2D2A26] shadow-xs cursor-pointer"
            >
              <SlidersHorizontal size={14} className="text-[#3F6212]" />
              <span>Filtres {selectedAmenities.length > 0 && `(${selectedAmenities.length})`}</span>
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-2 border border-[#E6E2D3] rounded-xl text-xs font-bold text-[#2D2A26] shadow-xs">
              <ArrowUpDown size={14} className="text-[#8C887D]" />
              <label htmlFor="search-sort-select" className="text-[#6B6658] font-normal">Trier par :</label>
              <select
                id="search-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Trier les résultats"
                className="bg-transparent outline-none cursor-pointer font-bold text-[#2D2A26]"
              >
                <option value="recommended">Recommandés</option>
                <option value="price_asc">Prix : croissant</option>
                <option value="price_desc">Prix : décroissant</option>
                <option value="rating_desc">Mieux notés (avis)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex bg-[#F0EDE4] p-1 rounded-xl gap-1 text-xs font-bold border border-[#E6E2D3]">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'split' ? 'bg-white shadow text-[#3F6212]' : 'text-[#6B6658] hover:text-[#2D2A26]'
                }`}
              >
                Liste & Carte
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'list' ? 'bg-white shadow text-[#3F6212]' : 'text-[#6B6658] hover:text-[#2D2A26]'
                }`}
              >
                Liste seule
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'map' ? 'bg-white shadow text-[#3F6212]' : 'text-[#6B6658] hover:text-[#2D2A26]'
                }`}
              >
                Carte seule
              </button>
            </div>
          </div>
        </div>

        {/* Layout Grid (Filters Sidebar + Hotel Results + Map) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 items-start">
          
          {/* DESKTOP FILTERS SIDEBAR */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6 sticky top-20 bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D3]">
              <h3 className="font-serif font-bold text-sm text-[#2D2A26] flex items-center gap-2">
                <Filter size={16} className="text-[#3F6212]" />
                <span>Filtrer par :</span>
              </h3>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-[#3F6212] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Effacer</span>
              </button>
            </div>

            {/* Price Budget Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#2D2A26]">
                  Budget max / nuit
                </label>
                <span className="text-xs font-bold text-[#8B5E34]">
                  {maxPrice >= 350000 ? 'Tous les prix' : formatFCFA(maxPrice)}
                </span>
              </div>
              <input
                type="range"
                min={20000}
                max={350000}
                step={5000}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#3F6212] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#8C887D] font-semibold">
                <span>20 000 F</span>
                <span>350 000+ F</span>
              </div>
            </div>

            {/* Accommodation Category */}
            <div className="space-y-2 pt-3 border-t border-[#E6E2D3]">
              <label className="text-xs font-bold text-[#2D2A26] block">
                Type d'hébergement
              </label>
              <div className="space-y-1.5 text-xs text-[#2D2A26]">
                {[
                  { id: 'all', label: 'Tous les types' },
                  { id: 'hotel', label: 'Hôtel & Resort' },
                  { id: 'lodge', label: 'Lodge & Écolodge' },
                  { id: 'campement', label: 'Campement touristique' },
                  { id: 'residence', label: 'Résidence & Appartement' },
                ].map((item) => (
                  <label 
                    key={item.id} 
                    className="flex items-center gap-2 cursor-pointer hover:text-[#3F6212] py-0.5"
                  >
                    <input
                      type="radio"
                      name="category-filter"
                      value={item.id}
                      checked={category === item.id}
                      onChange={() => setCategory(item.id)}
                      className="accent-[#3F6212]"
                    />
                    <span className={category === item.id ? 'font-bold text-[#3F6212]' : ''}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Minimum Rating */}
            <div className="space-y-2 pt-3 border-t border-[#E6E2D3]">
              <label className="text-xs font-bold text-[#2D2A26] block">
                Note des clients
              </label>
              <div className="space-y-1 text-xs text-[#2D2A26]">
                {[
                  { val: 0, label: 'Toutes les notes' },
                  { val: 8.0, label: '8.0+ Très bien' },
                  { val: 8.5, label: '8.5+ Fabuleux' },
                  { val: 9.0, label: '9.0+ Exceptionnel' },
                ].map((r) => (
                  <label key={r.val} className="flex items-center gap-2 cursor-pointer hover:text-[#3F6212] py-0.5">
                    <input
                      type="radio"
                      name="rating-filter"
                      checked={minRating === r.val}
                      onChange={() => setMinRating(r.val)}
                      className="accent-[#3F6212]"
                    />
                    <span className={minRating === r.val ? 'font-bold text-[#3F6212]' : ''}>
                      {r.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Amenities Checkbox Checklist */}
            <div className="space-y-2 pt-3 border-t border-[#E6E2D3]">
              <label className="text-xs font-bold text-[#2D2A26] block">
                Équipements populaires
              </label>
              <div className="space-y-2 text-xs text-[#2D2A26]">
                {HOTEL_AMENITIES.map((amenity) => (
                  <label 
                    key={amenity.id} 
                    className="flex items-center gap-2.5 cursor-pointer hover:text-[#3F6212] py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAmenities.includes(amenity.id)}
                      onChange={() => toggleAmenity(amenity.id)}
                      className="rounded border-[#D9D5C3] text-[#3F6212] focus:ring-[#3F6212] accent-[#3F6212] w-4 h-4"
                    />
                    <span>{amenity.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Distance to Beach */}
            <div className="space-y-2 pt-3 border-t border-[#E6E2D3]">
              <label className="text-xs font-bold text-[#2D2A26] block">
                Distance à la plage
              </label>
              <div className="space-y-1 text-xs text-[#2D2A26]">
                {[
                  { val: 0, label: 'Peu importe' },
                  { val: 100, label: 'Moins de 100 m (Front de mer)' },
                  { val: 500, label: 'Moins de 500 m' },
                  { val: 1000, label: 'Moins de 1 km' },
                ].map((d) => (
                  <label key={d.val} className="flex items-center gap-2 cursor-pointer hover:text-[#3F6212] py-0.5">
                    <input
                      type="radio"
                      name="beach-distance"
                      checked={maxBeachDistance === d.val}
                      onChange={() => setMaxBeachDistance(d.val)}
                      className="accent-[#3F6212]"
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

          </aside>

          {/* RESULTS CONTENT AREA */}
          <main className={`${
            viewMode === 'map' ? 'hidden' : viewMode === 'split' ? 'lg:col-span-5' : 'lg:col-span-9'
          } space-y-4`}>
            
            {/* Loading */}
            {isLoading && (
              <div className="bg-white rounded-2xl p-12 border border-[#E6E2D3] text-center space-y-3">
                <Loader2 className="animate-spin text-[#3F6212] mx-auto" size={32} />
                <p className="text-xs font-semibold text-[#6B6658]">Recherche d'hébergements en cours...</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && hotels.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-[#D9D5C3] p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 bg-[#F0EDE4] rounded-2xl text-[#8B5E34] flex items-center justify-center mx-auto">
                  <Building2 size={28} />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-base font-serif font-bold text-[#2D2A26]">
                    Aucun hôtel ne correspond à vos critères
                  </h3>
                  <p className="text-xs text-[#6B6658] mt-1 leading-relaxed">
                    Essayez d'élargir vos filtres (prix, équipements) ou de rechercher une autre destination au Sénégal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-[#3F6212] text-white rounded-xl text-xs font-bold hover:bg-[#365314] transition cursor-pointer"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}

            {/* Hotels Card List */}
            {!isLoading && hotels.length > 0 && (
              <div className="space-y-4">
                {hotels.map((hotel) => (
                  <div 
                    key={hotel.id}
                    onMouseEnter={() => setSelectedHotelId(hotel.id)}
                  >
                    <HotelCard
                      hotel={hotel}
                      onSelect={onSelectHotel}
                      onAuthRequired={onAuthRequired}
                    />
                  </div>
                ))}
              </div>
            )}

          </main>

          {/* INTERACTIVE MAP COLUMN */}
          <div className={`${
            viewMode === 'list' ? 'hidden' : viewMode === 'map' ? 'lg:col-span-9' : 'lg:col-span-4'
          } sticky top-20`}>
            <InteractiveMap
              hotels={hotels}
              selectedHotelId={selectedHotelId}
              onSelectHotel={onSelectHotel}
              className="h-[600px] w-full rounded-2xl overflow-hidden shadow-xs border border-[#E6E2D3]"
            />
          </div>

        </div>

      </div>

      {/* MOBILE FILTERS DRAWER */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-[#2D2A26]/60 backdrop-blur-xs lg:hidden flex justify-end">
          <div className="bg-[#FAF9F6] w-full max-w-sm h-full p-5 overflow-y-auto space-y-6 border-l border-[#E6E2D3]">
            <div className="flex items-center justify-between border-b border-[#E6E2D3] pb-3">
              <h3 className="font-serif font-bold text-base text-[#2D2A26]">Filtres de recherche</h3>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="text-[#6B6658] font-bold text-sm hover:text-[#2D2A26] cursor-pointer"
              >
                Fermer
              </button>
            </div>

            {/* Budget */}
            <div>
              <label className="text-xs font-bold text-[#2D2A26] block mb-1">
                Prix max: {formatFCFA(maxPrice)}
              </label>
              <input
                type="range"
                min={20000}
                max={350000}
                step={5000}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#3F6212]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-bold text-[#2D2A26] block mb-2">Type d'hébergement</label>
              <div className="space-y-1.5 text-xs text-[#2D2A26]">
                {[
                  { id: 'all', label: 'Tous' },
                  { id: 'hotel', label: 'Hôtel' },
                  { id: 'lodge', label: 'Lodge' },
                  { id: 'campement', label: 'Campement' },
                ].map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="m-cat"
                      checked={category === cat.id}
                      onChange={() => setCategory(cat.id)}
                      className="accent-[#3F6212]"
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="text-xs font-bold text-[#2D2A26] block mb-2">Équipements</label>
              <div className="space-y-2 text-xs text-[#2D2A26]">
                {HOTEL_AMENITIES.slice(0, 6).map((amenity) => (
                  <label key={amenity.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAmenities.includes(amenity.id)}
                      onChange={() => toggleAmenity(amenity.id)}
                      className="accent-[#3F6212]"
                    />
                    <span>{amenity.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(false)}
              className="w-full py-3 bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Appliquer les filtres
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
