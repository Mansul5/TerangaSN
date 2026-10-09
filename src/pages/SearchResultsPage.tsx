import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ArrowRight, Building2, Check, ChevronDown, Compass, Filter, Loader2, RotateCcw, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react';
import { Lodging, SearchFilters, HOTEL_AMENITIES, LodgingCategory } from '@/src/types';
import { fetchHotels, fetchHotelReviews } from '@/src/lib/supabase/api';
import { HotelCard } from '@/src/components/HotelCard';
import { SearchBar } from '@/src/components/SearchBar';
import { formatFCFA } from '@/src/lib/formatters';

interface SearchResultsPageProps {
  initialFilters: Partial<SearchFilters>;
  onSelectHotel: (hotelId: string) => void;
  onAuthRequired: () => void;
  onOpenSupabaseModal: () => void;
}

type SortOrder = 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc';
type ReviewSummary = { rating: number; count: number };
const MAX_BUDGET = 350000;
const categories: { id: LodgingCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' }, { id: 'hotel', label: 'Hôtels' },
  { id: 'residence', label: 'Résidences' }, { id: 'villa', label: 'Villas' },
  { id: 'appartement', label: 'Appartements' }, { id: 'chambre_hotes', label: "Chambres d’hôtes" },
  { id: 'lodge', label: 'Lodges' }, { id: 'campement', label: 'Campements' },
];
const ratingChoices = [0, 3, 3.5, 4, 4.5];
const beachChoices = [{ value: 0, label: 'Indifférent' }, { value: 100, label: 'À 100 m maximum' }, { value: 500, label: 'À 500 m maximum' }, { value: 1000, label: 'À 1 km maximum' }];
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const numeric = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (value === '' || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const reviewSummary = (raw: unknown): ReviewSummary => {
  const rows = Array.isArray(raw) ? raw : [];
  const valid = rows.filter((item) => {
    const row = asRecord(item);
    const status = String(row.status ?? '').toLowerCase();
    // Only explicitly published/approved reviews contribute to the public rating.
    if (!['approved', 'published'].includes(status)) return false;
    const score = numeric(row.rating ?? row.overall_rating);
    return score !== null && score >= 1 && score <= 5;
  });
  if (!valid.length) return { rating: 0, count: 0 };
  const sum = valid.reduce((total, item) => total + (numeric(asRecord(item).rating ?? asRecord(item).overall_rating) || 0), 0);
  return { rating: sum / valid.length, count: valid.length };
};

export const SearchResultsPage: React.FC<SearchResultsPageProps> = ({ initialFilters, onSelectHotel, onAuthRequired }) => {
  const [destination, setDestination] = useState(initialFilters.destination || '');
  const [checkIn, setCheckIn] = useState(initialFilters.checkIn || '');
  const [checkOut, setCheckOut] = useState(initialFilters.checkOut || '');
  const [adults, setAdults] = useState(initialFilters.adults || 2);
  const [children, setChildren] = useState(initialFilters.children || 0);
  const [rooms, setRooms] = useState(initialFilters.rooms || 1);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice ?? MAX_BUDGET);
  const [minRating, setMinRating] = useState(initialFilters.minRating ?? 0);
  const [category, setCategory] = useState<LodgingCategory | 'all'>((initialFilters.category as LodgingCategory | 'all') || 'all');
  const [amenities, setAmenities] = useState<string[]>(initialFilters.amenities || []);
  const [maxBeachDistance, setMaxBeachDistance] = useState(0);
  const [sortBy, setSortBy] = useState<SortOrder>('recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hotels, setHotels] = useState<Lodging[]>([]);
  const [reviewStats, setReviewStats] = useState<Record<string, ReviewSummary>>({});
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const requestId = useRef(0);
  const reviewRequestId = useRef(0);

  const toggleAmenity = useCallback((id: string) => {
    setAmenities((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);
  const resetFilters = useCallback(() => {
    setMaxPrice(MAX_BUDGET); setMinRating(0); setCategory('all');
    setAmenities([]); setMaxBeachDistance(0); setSortBy('recommended');
  }, []);
  const activeFilterCount = (maxPrice < MAX_BUDGET ? 1 : 0) + (minRating > 0 ? 1 : 0) + (category !== 'all' ? 1 : 0) + amenities.length + (maxBeachDistance > 0 ? 1 : 0);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true); setErrorMessage('');
      try {
        const result = await fetchHotels({
          destination, checkIn, checkOut, adults, children, rooms,
          maxPrice: maxPrice < MAX_BUDGET ? maxPrice : undefined,
          // Public review filtering happens after loading approved reviews.
          minRating: undefined,
          category: category === 'all' ? undefined : category,
          amenities,
          maxBeachDistance: maxBeachDistance || undefined,
          sortBy: sortBy === 'rating_desc' ? 'recommended' : sortBy,
        });
        if (id !== requestId.current) return;
        if (result.error) throw result.error;
        setHotels(result.data || []);
        setTotalCount(result.count ?? (result.data || []).length);
      } catch (error) {
        if (id !== requestId.current) return;
        console.error('Erreur de recherche :', error);
        setErrorMessage('Impossible de charger les hébergements pour le moment.');
        setHotels([]); setTotalCount(0);
      } finally { if (id === requestId.current) setLoading(false); }
    }, 180);
    return () => { window.clearTimeout(timer); requestId.current++; };
  }, [destination, checkIn, checkOut, adults, children, rooms, maxPrice, category, amenities, maxBeachDistance, sortBy, refreshIndex]);

  useEffect(() => {
    const id = ++reviewRequestId.current;
    if (!hotels.length) { setReviewStats({}); setReviewsLoading(false); return; }
    setReviewsLoading(true);
    // Limited concurrency avoids flooding Supabase when many listings are returned.
    const load = async () => {
      const stats: Record<string, ReviewSummary> = {};
      const batchSize = 6;
      for (let i = 0; i < hotels.length; i += batchSize) {
        if (id !== reviewRequestId.current) return;
        const batch = hotels.slice(i, i + batchSize);
        await Promise.all(batch.map(async (hotel) => {
          try {
            const result = await fetchHotelReviews(hotel.id);
            const value = asRecord(result);
            stats[hotel.id] = reviewSummary(Array.isArray(result) ? result : value.data);
          } catch { stats[hotel.id] = { rating: 0, count: 0 }; }
        }));
      }
      if (id === reviewRequestId.current) { setReviewStats(stats); setReviewsLoading(false); }
    };
    void load();
    return () => { reviewRequestId.current++; };
  }, [hotels]);

  const visibleHotels = useMemo(() => {
    const filtered = hotels.filter((hotel) => {
      if (!minRating) return true;
      const score = reviewStats[hotel.id];
      return !!score && score.count > 0 && score.rating >= minRating;
    });
    if (sortBy === 'rating_desc') {
      return [...filtered].sort((a, b) => {
        const aStats = reviewStats[a.id]; const bStats = reviewStats[b.id];
        return (bStats?.rating || 0) - (aStats?.rating || 0) || (bStats?.count || 0) - (aStats?.count || 0);
      });
    }
    return filtered;
  }, [hotels, minRating, reviewStats, sortBy]);

  const filterPanel = (mobile: boolean) => (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-[#1B382D]"><SlidersHorizontal size={17} /> Affiner votre séjour</div>
        <button type="button" onClick={resetFilters} className="text-xs font-semibold text-[#284C3B] hover:underline flex items-center gap-1"><RotateCcw size={13} /> Effacer</button>
      </div>
      <section className="space-y-3">
        <div className="flex justify-between items-center gap-2"><label htmlFor={mobile ? 'budget-mobile' : 'budget-desktop'} className="text-sm font-bold text-[#30352F]">Budget par nuit</label><span className="text-sm font-semibold text-[#284C3B]">{maxPrice >= MAX_BUDGET ? 'Sans limite' : formatFCFA(maxPrice)}</span></div>
        <input id={mobile ? 'budget-mobile' : 'budget-desktop'} type="range" min={20000} max={MAX_BUDGET} step={5000} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-[#284C3B] cursor-pointer" />
        <div className="flex justify-between text-[11px] text-[#777A70]"><span>20 000 FCFA</span><span>350 000+ FCFA</span></div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[#30352F]">Type d’hébergement</h3>
        <div className="flex flex-wrap gap-2">{categories.map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={`rounded-full px-3 py-2 text-xs font-semibold border transition ${category === item.id ? 'bg-[#284C3B] text-white border-[#284C3B]' : 'bg-white text-[#545A50] border-[#E9E2D5] hover:border-[#284C3B]'}`}>{item.label}</button>)}</div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[#30352F]">Note des voyageurs</h3>
        <div className="space-y-2">{ratingChoices.map((score) => <label key={score} className="flex items-center gap-3 text-sm text-[#545A50] cursor-pointer"><input type="radio" name={mobile ? 'rating-mobile' : 'rating-desktop'} checked={minRating === score} onChange={() => setMinRating(score)} className="accent-[#284C3B] w-4 h-4" /><span className="flex items-center gap-1">{score === 0 ? 'Toutes les notes' : <><Star size={14} className="text-[#B79B69] fill-[#B79B69]" /> {score.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} / 5 et plus</>}</span></label>)}</div>
        <p className="text-[11px] leading-relaxed text-[#81857B]">Notes issues uniquement des avis publiés. Les établissements sans avis ne sont pas notés.</p>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[#30352F]">Équipements</h3>
        <div className="grid grid-cols-1 gap-2.5">{HOTEL_AMENITIES.map((amenity) => <label key={amenity.id} className="flex items-center gap-3 text-sm text-[#545A50] cursor-pointer"><input type="checkbox" checked={amenities.includes(amenity.id)} onChange={() => toggleAmenity(amenity.id)} className="accent-[#284C3B] w-4 h-4" /><span>{amenity.label}</span></label>)}</div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[#30352F]">Distance à la plage</h3>
        <div className="space-y-2">{beachChoices.map((item) => <label key={item.value} className="flex items-center gap-3 text-sm text-[#545A50] cursor-pointer"><input type="radio" name={mobile ? 'beach-mobile' : 'beach-desktop'} checked={maxBeachDistance === item.value} onChange={() => setMaxBeachDistance(item.value)} className="accent-[#284C3B] w-4 h-4" />{item.label}</label>)}</div>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F5EF] pb-20">
      <div className="relative z-20 overflow-visible bg-[#1B382D] text-white">
        {/* Clip only the decorative circles; the search dropdowns must remain visible. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-36 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute right-20 -bottom-48 h-96 w-96 rounded-full border border-white/10" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-9 sm:pt-11 sm:pb-12">
          <div className="flex items-center gap-2 text-[#D7C8A9] text-xs font-semibold tracking-[0.18em] uppercase mb-3"><Compass size={15} /> TerangaSN · Explorer le Sénégal</div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight max-w-3xl">Votre prochain séjour <span className="italic text-[#D7C8A9]">commence ici.</span></h1>
          <p className="mt-3 mb-7 text-sm sm:text-base text-white/75 max-w-xl">Des adresses à découvrir, des séjours à votre rythme, des prix en francs CFA.</p>
          <div className="rounded-2xl bg-white/10 border border-white/15 p-2 sm:p-3 backdrop-blur-sm"><SearchBar variant="compact" initialDestination={destination} initialCheckIn={checkIn} initialCheckOut={checkOut} initialAdults={adults} initialChildren={children} initialRooms={rooms} onSearch={(params) => { setDestination(params.destination); setCheckIn(params.checkIn); setCheckOut(params.checkOut); setAdults(params.adults); setChildren(params.children); setRooms(params.rooms); }} /></div>
        </div>
      </div>

      <div className="relative z-0 max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-6">
          <div><div className="flex items-center gap-2 text-[#8C7652] text-xs uppercase tracking-[0.17em] font-bold mb-2"><Sparkles size={14} /> La sélection TerangaSN</div><h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1B382D]">{destination ? `Séjours à ${destination}` : 'Des lieux à découvrir'}</h2><p className="mt-2 text-sm text-[#777A70]">{loading ? 'Recherche en cours…' : `${totalCount} hébergement${totalCount > 1 ? 's' : ''} trouvé${totalCount > 1 ? 's' : ''}`} · Tarifs en FCFA</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFiltersOpen(true)} className="lg:hidden inline-flex items-center gap-2 bg-white border border-[#E9E2D5] rounded-xl px-4 py-3 text-sm font-semibold text-[#1B382D]"><Filter size={16} /> Filtres {activeFilterCount > 0 && <span className="bg-[#284C3B] text-white rounded-full px-2 py-0.5 text-xs">{activeFilterCount}</span>}</button>
            <label className="inline-flex items-center gap-2 bg-white border border-[#E9E2D5] rounded-xl px-3 py-3 text-sm text-[#545A50]"><ArrowDownUp size={16} /><span className="sr-only">Trier les résultats</span><select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOrder)} className="bg-transparent outline-none font-semibold text-[#1B382D] max-w-[180px] cursor-pointer"><option value="recommended">Recommandés</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option><option value="rating_desc">Mieux notés</option></select><ChevronDown size={13} className="hidden sm:block" /></label>
          </div>
        </div>

        {activeFilterCount > 0 && <div className="flex items-center gap-2 flex-wrap mb-6"><span className="text-xs font-semibold text-[#777A70]">Filtres actifs :</span>{category !== 'all' && <button onClick={() => setCategory('all')} className="rounded-full bg-[#E9E2D5] px-3 py-1.5 text-xs text-[#284C3B] flex items-center gap-1">{categories.find((x) => x.id === category)?.label}<X size={12} /></button>}{maxPrice < MAX_BUDGET && <button onClick={() => setMaxPrice(MAX_BUDGET)} className="rounded-full bg-[#E9E2D5] px-3 py-1.5 text-xs text-[#284C3B] flex items-center gap-1">Max. {formatFCFA(maxPrice)}<X size={12} /></button>}{minRating > 0 && <button onClick={() => setMinRating(0)} className="rounded-full bg-[#E9E2D5] px-3 py-1.5 text-xs text-[#284C3B] flex items-center gap-1">{minRating}/5 et +<X size={12} /></button>}{amenities.map((id) => <button key={id} onClick={() => toggleAmenity(id)} className="rounded-full bg-[#E9E2D5] px-3 py-1.5 text-xs text-[#284C3B] flex items-center gap-1">{HOTEL_AMENITIES.find((a) => a.id === id)?.label || id}<X size={12} /></button>)}{maxBeachDistance > 0 && <button onClick={() => setMaxBeachDistance(0)} className="rounded-full bg-[#E9E2D5] px-3 py-1.5 text-xs text-[#284C3B] flex items-center gap-1">Plage ≤ {maxBeachDistance} m<X size={12} /></button>}<button onClick={resetFilters} className="text-xs font-bold text-[#284C3B] underline underline-offset-2 px-2">Tout effacer</button></div>}

        <div className="grid grid-cols-1 lg:grid-cols-[285px_minmax(0,1fr)] xl:grid-cols-[305px_minmax(0,1fr)] gap-7 items-start">
          <aside className="hidden lg:block bg-white rounded-[24px] border border-[#E9E2D5] p-6 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">{filterPanel(false)}</aside>
          <main className="min-w-0" aria-live="polite">
            {loading ? <div className="rounded-[24px] bg-white border border-[#E9E2D5] p-16 text-center"><Loader2 className="animate-spin text-[#284C3B] mx-auto mb-4" size={30} /><p className="text-sm text-[#777A70]">Nous cherchons votre prochain séjour…</p></div> : errorMessage ? <div className="rounded-[24px] bg-white border border-[#E9E2D5] p-12 text-center"><p className="font-semibold text-[#1B382D] mb-4">{errorMessage}</p><button onClick={() => setRefreshIndex((x) => x + 1)} className="bg-[#284C3B] text-white px-5 py-3 rounded-xl text-sm font-bold">Réessayer</button></div> : (reviewsLoading && (minRating > 0 || sortBy === 'rating_desc')) ? <div className="rounded-[24px] bg-white border border-[#E9E2D5] p-12 text-center"><Loader2 className="animate-spin text-[#284C3B] mx-auto mb-3" /><p className="text-sm text-[#777A70]">Vérification des avis publiés…</p></div> : visibleHotels.length === 0 ? <div className="rounded-[24px] bg-white border border-[#E9E2D5] p-12 text-center"><div className="w-16 h-16 bg-[#F7F5EF] rounded-2xl flex items-center justify-center mx-auto mb-4"><Building2 size={30} className="text-[#284C3B]" /></div><h3 className="font-serif text-xl font-bold text-[#1B382D]">Aucun séjour trouvé pour ces critères</h3><p className="text-sm text-[#777A70] mt-2 max-w-md mx-auto">Essayez un autre budget, une note différente ou une autre destination.</p><button onClick={resetFilters} className="mt-6 bg-[#284C3B] text-white px-5 py-3 rounded-xl text-sm font-bold">Effacer les filtres</button></div> : <><div className="flex items-center justify-between gap-3 mb-4"><p className="text-xs font-medium text-[#777A70]">{visibleHotels.length} résultat{visibleHotels.length > 1 ? 's' : ''} affiché{visibleHotels.length > 1 ? 's' : ''}{minRating > 0 ? ' avec avis publiés' : ''}</p><span className="text-[11px] text-[#777A70] flex items-center gap-1"><Check size={13} /> Notes sur 5</span></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{visibleHotels.map((hotel) => { const stats = reviewStats[hotel.id]; return <div key={hotel.id} className="min-w-0 rounded-[22px] border border-[#E9E2D5] bg-white p-2.5 sm:p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"><HotelCard hotel={hotel} onSelect={onSelectHotel} onAuthRequired={onAuthRequired} /><div className="flex items-center justify-between gap-2 px-2 pt-3 pb-1 border-t border-[#F0ECE3] mt-2"><div className="flex items-center gap-1.5 text-xs text-[#545A50]">{stats?.count ? <><Star size={15} className="fill-[#B79B69] text-[#B79B69]" /><strong className="text-[#1B382D]">{stats.rating.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/5</strong><span>· {stats.count} avis publié{stats.count > 1 ? 's' : ''}</span></> : <span>{reviewsLoading ? 'Chargement des avis…' : 'Nouveau · Aucun avis publié'}</span>}</div><button type="button" onClick={() => onSelectHotel(hotel.id)} className="text-[#284C3B] font-bold text-xs flex items-center gap-1 hover:underline">Découvrir <ArrowRight size={14} /></button></div></div>; })}</div></>}
            <div className="mt-8 rounded-2xl bg-[#E9E2D5]/60 px-5 py-4 flex items-start gap-3 text-sm text-[#545A50]"><Sparkles size={18} className="shrink-0 mt-0.5 text-[#8C7652]" /><p>Un séjour se choisit aussi au ressenti. Consultez les photos, les équipements et les avis publiés avant de réserver.</p></div>
          </main>
        </div>
      </div>

      {filtersOpen && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtres de recherche"><button type="button" aria-label="Fermer les filtres" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-[#1B382D]/65" /><div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#F7F5EF] flex flex-col shadow-2xl"><div className="px-5 py-4 flex items-center justify-between border-b border-[#E9E2D5]"><div className="font-serif text-lg font-bold text-[#1B382D]">Personnaliser ma recherche</div><button type="button" aria-label="Fermer" onClick={() => setFiltersOpen(false)} className="p-2 rounded-full bg-white text-[#1B382D]"><X size={20} /></button></div><div className="overflow-y-auto flex-1 p-5">{filterPanel(true)}</div><div className="p-4 bg-white border-t border-[#E9E2D5]"><button type="button" onClick={() => setFiltersOpen(false)} className="w-full bg-[#284C3B] text-white rounded-xl py-3.5 font-bold text-sm flex items-center justify-center gap-2">Voir les résultats <ArrowRight size={16} /></button></div></div></div>}
    </div>
  );
};

export default SearchResultsPage;
