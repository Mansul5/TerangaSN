import React, { useEffect, useState } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Compass, 
  Building2, 
  ArrowRight, 
  ShieldCheck, 
  HeartHandshake, 
  Waves, 
  Sun,
  Loader2,
  Database
} from 'lucide-react';
import { SearchBar } from '@/src/components/SearchBar';
import { HotelCard } from '@/src/components/HotelCard';
import { Hotel, SENEGAL_REGIONS } from '@/src/types';
import { fetchFeaturedHotels, fetchRegionCounts } from '@/src/lib/supabase/api';
import { isSupabaseConfigured } from '@/src/lib/supabase/client';

interface HomePageProps {
  onSearch: (params: any) => void;
  onSelectHotel: (hotelId: string) => void;
  onSelectRegion: (regionName: string) => void;
  onOpenAuth: () => void;
  onOpenSupabaseModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSearch,
  onSelectHotel,
  onSelectRegion,
  onOpenAuth,
  onOpenSupabaseModal,
}) => {
  const [featuredHotels, setFeaturedHotels] = useState<Hotel[]>([]);
  const [regionCounts, setRegionCounts] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHomeData() {
      setIsLoading(true);
      setDbError(null);
      try {
        const [hotelsRes, countsRes] = await Promise.all([
          fetchFeaturedHotels(),
          fetchRegionCounts(),
        ]);

        if (hotelsRes.error) {
          console.warn('Featured hotels fetch issue:', hotelsRes.error);
          setDbError(hotelsRes.error.message || 'Impossible de contacter Supabase');
        } else {
          setFeaturedHotels(hotelsRes.data || []);
        }

        setRegionCounts(countsRes || {});
      } catch (err: any) {
        console.error('Home data load error:', err);
        setDbError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadHomeData();
  }, []);

  return (
    <div className="space-y-12 pb-16">
      
      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-b from-[#3F6212] via-[#365314] to-[#2D470C] text-white pt-10 pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          
          <div className="max-w-3xl mb-8">
            <div className="inline-flex items-center gap-2 bg-[#ECF3E5]/20 text-[#ECF3E5] border border-[#ECF3E5]/30 px-3.5 py-1 rounded-full text-xs font-bold mb-4 backdrop-blur-md">
              <Sparkles size={14} className="text-[#FDE68A]" />
              <span>La Teranga Sénégalaise à portée de main</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight leading-tight text-white">
              Trouvez votre prochain séjour au <span className="text-[#FDE68A] underline decoration-[#FDE68A]/40">Sénégal</span>
            </h1>
            
            <p className="text-sm sm:text-base text-[#E6E2D3] mt-3.5 max-w-2xl leading-relaxed">
              Des hôtels de prestige sur la Corniche de Dakar aux campements traditionnels du Sine Saloum et aux plages de Saly ou Cap Skirring. Payez directement sur place à votre arrivée.
            </p>
          </div>

          {/* Booking Style Search Box */}
          <div className="relative mt-2">
            <SearchBar
              variant="hero"
              onSearch={onSearch}
            />
          </div>

          {/* Quick Features tags */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-[#4E7917] text-xs font-semibold text-[#E6E2D3]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#A3E635]" />
              <span>Paiement direct à l'hôtel</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FDE68A]" />
              <span>Annulation sans frais</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#93C5FD]" />
              <span>Tarifs officiels en FCFA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F9A8D4]" />
              <span>Authentification Supabase</span>
            </div>
          </div>

        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-14">

        {/* DESTINATIONS POPULAIRES AU SÉNÉGAL */}
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D2A26] tracking-tight">
                Destinations populaires au Sénégal
              </h2>
              <p className="text-xs sm:text-sm text-[#6B6658] mt-1">
                Explorez les régions les plus prisées par les voyageurs
              </p>
            </div>
            <button
              onClick={() => onSearch({ destination: '' })}
              className="text-xs font-bold text-[#3F6212] hover:text-[#365314] flex items-center gap-1 group cursor-pointer"
            >
              <span>Voir tout</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Regions Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SENEGAL_REGIONS.map((region, index) => {
              const count = regionCounts[region.name] || 0;
              return (
                <div
                  key={region.id}
                  id={`destination-card-${region.id}`}
                  onClick={() => onSelectRegion(region.name)}
                  className={`group relative rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 cursor-pointer h-64 bg-[#2D2A26] border border-[#E6E2D3] ${
                    index === 0 ? 'sm:col-span-2' : ''
                  }`}
                >
                  <img
                    src={region.image}
                    alt={region.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2D2A26]/95 via-[#2D2A26]/40 to-transparent" />
                  
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="text-[11px] font-bold text-[#FDE68A] uppercase tracking-wider block mb-1">
                      Sénégal
                    </span>
                    <h3 className="text-lg sm:text-xl font-serif font-bold group-hover:text-[#FDE68A] transition-colors">
                      {region.name}
                    </h3>
                    <p className="text-xs text-[#E6E2D3] line-clamp-1 mt-0.5 opacity-90">
                      {region.description}
                    </p>
                    <div className="mt-2 text-[11px] font-semibold text-[#D9D5C3] flex items-center gap-1.5">
                      <Building2 size={13} className="text-[#FDE68A]" />
                      <span>{count > 0 ? `${count} hébergements enregistrés` : 'Découvrir la région'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* OFFRES DU MOMENT / HÔTELS EN VEDETTE */}
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3F6212] bg-[#ECF3E5] px-2.5 py-0.5 rounded-md mb-1 border border-[#D1DBC2]">
                <Sparkles size={13} />
                <span>Sélection Teranga</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D2A26] tracking-tight">
                Offres du moment au Sénégal
              </h2>
              <p className="text-xs sm:text-sm text-[#6B6658] mt-0.5">
                Des hébergements vérifiés avec d'excellents retours clients
              </p>
            </div>
            <button
              onClick={() => onSearch({ destination: '' })}
              className="text-xs font-bold text-[#3F6212] hover:text-[#365314] flex items-center gap-1 group cursor-pointer"
            >
              <span>Plus d'offres</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-[#E6E2D3]">
              <Loader2 className="animate-spin mx-auto text-[#3F6212]" size={32} />
              <p className="text-xs font-semibold text-[#6B6658]">Chargement des hôtels...</p>
            </div>
          )}

          {/* Real Empty State if no hotels in Supabase */}
          {!isLoading && featuredHotels.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-[#D9D5C3] p-8 sm:p-12 text-center space-y-4">
              <div className="w-14 h-14 bg-[#F0EDE4] rounded-2xl text-[#8B5E34] flex items-center justify-center mx-auto">
                <Building2 size={28} />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-base font-serif font-bold text-[#2D2A26]">Aucun hôtel publié pour le moment</h4>
                <p className="text-xs text-[#6B6658] mt-1 leading-relaxed">
                  Votre base de données est actuellement en attente d'éléments publiés ou d'initialisation.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onOpenSupabaseModal}
                  className="bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Database size={15} />
                  <span>Charger les données de test (SQL)</span>
                </button>
              </div>
            </div>
          )}

          {/* Hotels List */}
          {!isLoading && featuredHotels.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredHotels.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  onSelect={onSelectHotel}
                  onAuthRequired={onOpenAuth}
                />
              ))}
            </div>
          )}
        </section>

        {/* WHY BOOK IN SENEGAL WITH TERANGA */}
        <section className="bg-[#2D2A26] text-white rounded-3xl p-6 sm:p-10 relative overflow-hidden border border-[#3F3B35]">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-bold text-[#FDE68A] uppercase tracking-widest">
                L'hospitalité sénégalaise
              </span>
              <h3 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight">
                Vivez une expérience inoubliable au pays de la Teranga
              </h3>
              <p className="text-xs sm:text-sm text-[#D9D5C3] leading-relaxed">
                Le Sénégal offre une diversité unique en Afrique de l'Ouest : les vagues de Ngor et des Almadies à Dakar, la douceur de vivre de Saint-Louis la coloniale, la mangrove sauvage du Saloum, et les plages bordées de palmiers de Cap Skirring.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => onSearch({ destination: 'Sine Saloum' })}
                  className="bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-xs cursor-pointer"
                >
                  Découvrir les Écolodges
                </button>
                <button
                  onClick={() => onSearch({ destination: 'Saly' })}
                  className="bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition border border-[#3F6212] cursor-pointer"
                >
                  Séjours Plage à Saly
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-3 text-[#2D2A26]">
              <div className="bg-[#FAF9F6] p-4 rounded-2xl space-y-1 border border-[#E6E2D3]">
                <span className="text-2xl">🏝️</span>
                <h5 className="font-serif font-bold text-xs">Petite Côte & Plages</h5>
                <p className="text-[11px] text-[#6B6658]">Soleil garanti toute l'année</p>
              </div>
              <div className="bg-[#FAF9F6] p-4 rounded-2xl space-y-1 border border-[#E6E2D3]">
                <span className="text-2xl">🚣‍♂️</span>
                <h5 className="font-serif font-bold text-xs">Delta du Saloum</h5>
                <p className="text-[11px] text-[#6B6658]">Nature & balades en pirogue</p>
              </div>
              <div className="bg-[#FAF9F6] p-4 rounded-2xl space-y-1 border border-[#E6E2D3]">
                <span className="text-2xl">🏛️</span>
                <h5 className="font-serif font-bold text-xs">Gorée & Saint-Louis</h5>
                <p className="text-[11px] text-[#6B6658]">Patrimoine mondial UNESCO</p>
              </div>
              <div className="bg-[#FAF9F6] p-4 rounded-2xl space-y-1 border border-[#E6E2D3]">
                <span className="text-2xl">🌴</span>
                <h5 className="font-serif font-bold text-xs">Cap Skirring</h5>
                <p className="text-[11px] text-[#6B6658]">Casamance authentique</p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
