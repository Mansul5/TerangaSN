import React, { useEffect, useState } from 'react';

import { ArrowRight, Building2, CheckCircle2, Compass, Database, Loader2, MapPin, Search, ShieldCheck, Sparkles, Wallet } from 'lucide-react';

import { SearchBar } from '@/src/components/SearchBar';

import { HotelCard } from '@/src/components/HotelCard';

import { SENEGAL_REGIONS } from '@/src/types';

import type { Lodging } from '@/src/types';

import { fetchFeaturedHotels, fetchRegionCounts } from '@/src/lib/supabase/api';



interface HomePageProps {

  onSearch: (params: any) => void;

  onSelectHotel: (hotelId: string) => void;

  onSelectRegion: (regionName: string) => void;

  onOpenAuth: () => void;

  onOpenSupabaseModal: () => void;

}



type HomeDataCache = {

  featuredLodgings: Lodging[];

  regionCounts: Record<string, number>;

  loaded: boolean;

  error: string | null;

};

const homeDataCache: HomeDataCache = {

  featuredLodgings: [], regionCounts: {}, loaded: false, error: null,

};

let homeDataRequest: Promise<void> | null = null;



// Photographies de lieux réels. Source : Wikimedia Commons. Les crédits restent visibles.
// Images chargées une seule fois par URL ; pas de rafraîchissement programmé.
const COMMONS = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/';
const DESTINATIONS = [
  { name: 'Petite Côte', location: 'Plages de Saly et de la Somone', region: 'Thiès', photo: 'SalyPortudalBeach.jpg', author: 'Jjm2311', license: 'Voir licence', source: 'https://commons.wikimedia.org/wiki/File:SalyPortudalBeach.jpg', size: 'large' },
  { name: 'Dindéfélo', location: 'La cascade de Dindéfélo', region: 'Kédougou', photo: 'DindefeloFalls_01.jpg', author: 'BluesyPete', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:DindefeloFalls_01.jpg', size: 'normal' },
  { name: 'Lac Rose', location: 'Le lac Retba et ses paysages', region: 'Dakar', photo: 'Lac_rose_au_Sénégal.jpg', author: 'Abrahami', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Lac_rose_au_Sénégal.jpg', size: 'normal' },
  { name: 'Lompoul', location: 'Les dunes de sable ocre', region: 'Louga', photo: 'Dune_de_sable_lompoul.jpg', author: 'AdjoEsse', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Dune_de_sable_lompoul.jpg', size: 'normal' },
  { name: 'Saint-Louis', location: 'L’île historique et le pont Faidherbe', region: 'Saint-Louis', photo: 'Island_of_Saint-Louis-113799.jpg', author: 'Wikimedia Commons', license: 'Voir licence', source: 'https://commons.wikimedia.org/wiki/File:Island_of_Saint-Louis-113799.jpg', size: 'normal' },
  { name: 'Cap Skirring', location: 'Les plages de Casamance', region: 'Ziguinchor', photo: 'Cap-Skirring-Beach-2007.jpg', author: 'Bjørn Christian Tørrissen', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Cap-Skirring-Beach-2007.jpg', size: 'normal' },
  { name: 'Sine-Saloum', location: 'Mangroves et îles du delta', region: 'Fatick', photo: 'Mangrove_delta_du_saloum.jpg', author: 'Wikimedia Commons', license: 'Voir licence', source: 'https://commons.wikimedia.org/wiki/File:Mangrove_delta_du_saloum.jpg', size: 'normal' },
  { name: 'Dakar', location: 'Monument de la Renaissance africaine', region: 'Dakar', photo: 'African_Renaissance_Monument_Dakar_2025.jpg', author: 'Gromane', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:African_Renaissance_Monument_Dakar_2025.jpg', size: 'normal' },
] as const;

const DESTINATION_IMAGES: Record<string, string> = {
  saly: `${COMMONS}Cap-Skirring-Beach-2007.jpg`,
  saloum: `${COMMONS}Mangrove_delta_du_saloum.jpg`,
  saintlouis: `${COMMONS}Island_of_Saint-Louis-113799.jpg`,
};
const INSPIRATIONS = [
  { title: 'Évasion sur la côte', subtitle: 'Les plages de Casamance', destination: 'Ziguinchor', icon: '🌊', image: DESTINATION_IMAGES.saly },
  { title: 'Nature et déconnexion', subtitle: 'Le delta du Saloum', destination: 'Fatick', icon: '🌿', image: DESTINATION_IMAGES.saloum },
  { title: 'Culture et patrimoine', subtitle: 'Saint-Louis', destination: 'Saint-Louis', icon: '🏛️', image: DESTINATION_IMAGES.saintlouis },
];

export const HomePage: React.FC<HomePageProps> = ({

  onSearch, onSelectHotel, onSelectRegion, onOpenAuth, onOpenSupabaseModal,

}) => {

  const [featuredLodgings, setFeaturedLodgings] = useState<Lodging[]>(() => homeDataCache.featuredLodgings);

  const [regionCounts, setRegionCounts] = useState<Record<string, number>>(() => homeDataCache.regionCounts);

  const [isLoading, setIsLoading] = useState(() => !homeDataCache.loaded);

  const [dbError, setDbError] = useState<string | null>(() => homeDataCache.error);

  const [imageFailures, setImageFailures] = useState<Record<string, boolean>>({});



  useEffect(() => {

    let active = true;

    const sync = () => {

      if (!active) return;

      setFeaturedLodgings(homeDataCache.featuredLodgings);

      setRegionCounts(homeDataCache.regionCounts);

      setDbError(homeDataCache.error);

      setIsLoading(false);

    };

    if (homeDataCache.loaded) {

      sync();

      return () => { active = false; };

    }

    if (!homeDataRequest) {

      homeDataRequest = (async () => {

        try {

          const [lodgingsRes, countsRes] = await Promise.all([fetchFeaturedHotels(), fetchRegionCounts()]);

          if (lodgingsRes.error) {

            homeDataCache.error = lodgingsRes.error.message || 'Impossible de récupérer les hébergements.';

            homeDataCache.featuredLodgings = [];

          } else {

            homeDataCache.featuredLodgings = lodgingsRes.data || [];

            homeDataCache.error = null;

          }

          homeDataCache.regionCounts = countsRes || {};

        } catch (error) {

          homeDataCache.error = error instanceof Error ? error.message : 'Une erreur est survenue.';

          homeDataCache.featuredLodgings = [];

        } finally {

          // On évite les requêtes répétées pendant la navigation ; à réviser avec une stratégie de cache serveur.*

          homeDataCache.loaded = true;

        }

      })();

    }

    void homeDataRequest.finally(() => {

      homeDataRequest = null;

      sync();

    });

    return () => { active = false; };

  }, []);



  const exploreAll = () => onSearch({ destination: '' });

  const exploreDestination = (destination: string) => onSearch({ destination });



  return (

    <main className="w-full min-w-0 overflow-x-clip bg-[#F7F5EF] pb-20">

      <section className="relative isolate bg-[#1B382D] px-4 pb-14 pt-12 text-white sm:px-6 sm:pb-20 sm:pt-16 lg:pt-20">

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">

          <div className="absolute -right-24 -top-28 h-96 w-96 rounded-full bg-[#B79B69]/10 blur-3xl" />

          <div className="absolute bottom-0 left-0 h-48 w-full bg-gradient-to-t from-[#284C3B] to-transparent" />

          <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />

        </div>

        <div className="relative mx-auto max-w-7xl">

          <div className="max-w-3xl">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-[#F3E8D2]">

              <Sparkles size={14} aria-hidden="true" /> L'hospitalité sénégalaise, à votre rythme

            </div>

            <h1 className="font-serif text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">

              Votre prochaine escapade <span className="text-[#E3C58F]">commence ici.</span>

            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#E4E9E3] sm:text-base">

              De Dakar à la Casamance, trouvez le séjour qui vous ressemble.

              Explorez les hébergements, comparez les prix et choisissez en toute simplicité.

            </p>

          </div>

          <div className="relative z-20 mt-8 rounded-2xl bg-white p-2 text-[#30352F] shadow-[0_20px_55px_rgba(0,0,0,0.16)] sm:p-3">

            <SearchBar variant="hero" onSearch={onSearch} />

          </div>

          <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3 text-xs text-[#E6EAE5] sm:text-sm">

            <span className="inline-flex items-center gap-2"><Search size={16} className="text-[#E3C58F]" /> Recherche facile</span>

            <span className="inline-flex items-center gap-2"><Wallet size={16} className="text-[#E3C58F]" /> Prix affichés en FCFA</span>

            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[#E3C58F]" /> Conditions visibles avant confirmation</span>

          </div>

        </div>

      </section>



      <div className="mx-auto max-w-7xl space-y-16 px-4 pt-14 sm:px-6 sm:pt-16">

        <section aria-labelledby="inspiration-heading">

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">

            <div>

              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8C744C]">L'inspiration du moment</p>

              <h2 id="inspiration-heading" className="font-serif text-2xl font-semibold text-[#1B382D] sm:text-3xl">Une envie, une destination</h2>

              <p className="mt-2 text-sm text-[#687067]">Quelques idées pour imaginer votre prochain séjour.</p>

            </div>

          </div>

          <div className="grid gap-4 md:grid-cols-3">

            {INSPIRATIONS.map(item => (

              <button key={item.destination} type="button" onClick={() => exploreDestination(item.destination)}

                className="group relative h-64 overflow-hidden rounded-2xl bg-[#284C3B] text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B79B69]">

                {!imageFailures[item.destination] && <img src={item.image} alt="" loading="lazy" onError={() => setImageFailures(p => ({...p, [item.destination]: true}))}

                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}

                <div className="absolute inset-0 bg-gradient-to-t from-[#142A22]/95 via-[#142A22]/35 to-transparent" />

                <div className="absolute bottom-5 left-5 right-5 text-white">

                  <span className="text-xl" aria-hidden="true">{item.icon}</span>

                  <h3 className="mt-2 font-serif text-xl font-semibold">{item.title}</h3>

                  <p className="mt-1 text-sm text-white/80">{item.subtitle}</p>

                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#E3C58F]">Explorer <ArrowRight size={14} /></span>

                </div>

              </button>

            ))}

          </div>

        </section>



                  <section aria-labelledby="destinations-heading" className="relative">
            <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#8C744C]"><Compass size={15} /> Carnet de voyage</p>
                <h2 id="destinations-heading" className="font-serif text-3xl font-semibold tracking-tight text-[#1B382D] sm:text-4xl lg:text-[42px]">Le Sénégal, <span className="italic text-[#9B7848]">en grand.</span></h2>
                <p className="mt-3 text-sm leading-6 text-[#687067] sm:text-base">De la Petite Côte aux cascades de Kédougou, en passant par le Lac Rose et les dunes de Lompoul : explorez le Sénégal sous toutes ses facettes.</p>
              </div>
              <button type="button" onClick={exploreAll} className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#284C3B]/20 px-5 py-2.5 text-sm font-semibold text-[#284C3B] transition hover:bg-[#284C3B] hover:text-white sm:self-auto">Explorer tous les séjours <ArrowRight size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:auto-rows-[235px]">
              {DESTINATIONS.map((place, index) => {
                const imageKey = `destination-${place.name}`;
                const count = regionCounts[place.region] || 0;
                return (
                  <div key={place.name} className={`group relative isolate min-h-[220px] overflow-hidden rounded-[22px] bg-[#284C3B] shadow-[0_8px_25px_rgba(27,56,45,0.09)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(27,56,45,0.2)] sm:min-h-[260px] lg:min-h-0 ${index === 0 ? 'col-span-2 row-span-2' : ''}`}>
                    {!imageFailures[imageKey] && (
                      <img src={`${COMMONS}${encodeURIComponent(place.photo).replace(/%2F/g, '/')}`} alt={`Photographie de ${place.location}, ${place.name}, Sénégal`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" onError={() => setImageFailures(previous => ({ ...previous, [imageKey]: true }))} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
                    )}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B221B]/95 via-[#102A22]/20 to-black/10 transition-colors group-hover:from-[#0B221B]" />
                    <button type="button" onClick={() => onSelectRegion(place.region)} className="absolute inset-0 z-10 flex flex-col items-start justify-end p-4 text-left text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-[#E3C58F] sm:p-5 lg:p-6" aria-label={`Explorer les hébergements de ${place.region} — ${place.name}`}>
                      {index === 0 && <span className="mb-auto inline-flex rounded-full border border-white/30 bg-black/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest backdrop-blur-sm">À ne pas manquer</span>}
                      <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#F2D4A0] sm:text-xs">{place.location}</span>
                      <span className={`font-serif font-semibold leading-tight ${index === 0 ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-xl sm:text-2xl'}`}>{place.name}</span>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/90 sm:text-sm">{count > 0 ? `${count} hébergement${count > 1 ? 's' : ''} dans la région` : 'Découvrir la destination'} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
                    </button>
                    <a href={place.source} target="_blank" rel="noopener noreferrer" aria-label={`Crédit photo ${place.name} : ${place.author}, ${place.license}`} title={`Photo : ${place.author} · ${place.license} · Wikimedia Commons`} className="absolute right-2 top-2 z-20 max-w-[75%] rounded-full bg-[#102A22]/70 px-2.5 py-1 text-[10px] text-white/90 opacity-80 backdrop-blur-sm transition hover:bg-[#102A22] hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E3C58F] sm:right-3 sm:top-3">Photo · crédits ↗</a>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-[#687067]">Photographies de lieux réels, à titre d’inspiration. Les hébergements et disponibilités se consultent séparément. Crédits et licences accessibles sur chaque image.</p>
          </section>

<section aria-labelledby="featured-heading">

          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">

            <div>

              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#8C744C]"><Sparkles size={14} /> À découvrir</p>

              <h2 id="featured-heading" className="font-serif text-2xl font-semibold text-[#1B382D] sm:text-3xl">Des hébergements pour vous inspirer</h2>

              <p className="mt-2 text-sm text-[#687067]">Parcourez les annonces disponibles et consultez les détails avant de réserver.</p>

            </div>

            <button type="button" onClick={exploreAll} className="inline-flex items-center gap-2 text-sm font-semibold text-[#284C3B] hover:underline">Voir tous les séjours <ArrowRight size={16} /></button>

          </div>

          {isLoading ? (

            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-[#E9E2D5] bg-white">

              <Loader2 size={28} className="animate-spin text-[#284C3B]" />

              <p className="text-sm text-[#687067]">Chargement des hébergements…</p>

            </div>

          ) : dbError && featuredLodgings.length === 0 ? (

            <div className="rounded-2xl border border-[#E9E2D5] bg-white px-6 py-10 text-center">

              <Database size={28} className="mx-auto text-[#8C744C]" />

              <h3 className="mt-3 font-serif text-lg font-semibold text-[#1B382D]">Les hébergements sont momentanément indisponibles</h3>

              <p className="mx-auto mt-2 max-w-lg text-sm text-[#687067]">Nous n'avons pas pu charger les annonces. Vous pouvez réessayer plus tard ou poursuivre votre exploration des destinations.</p>

              <button type="button" onClick={exploreAll} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-semibold text-white">Explorer les destinations <ArrowRight size={16} /></button>

            </div>

          ) : featuredLodgings.length === 0 ? (

            <div className="rounded-2xl border border-[#E9E2D5] bg-white px-6 py-10 text-center">

              <Building2 size={28} className="mx-auto text-[#8C744C]" />

              <h3 className="mt-3 font-serif text-lg font-semibold text-[#1B382D]">Les premières adresses arrivent bientôt</h3>

              <p className="mx-auto mt-2 max-w-lg text-sm text-[#687067]">En attendant, découvrez les régions du Sénégal et préparez votre prochaine escapade.</p>

              <button type="button" onClick={exploreAll} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-semibold text-white">Découvrir les destinations <ArrowRight size={16} /></button>

            </div>

          ) : (

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              {featuredLodgings.map(lodging => (

                <HotelCard key={lodging.id} hotel={lodging} onSelect={onSelectHotel} onAuthRequired={onOpenAuth} />

              ))}

            </div>

          )}

        </section>



        <section className="relative overflow-hidden rounded-3xl bg-[#1B382D] px-6 py-10 text-white sm:px-10 sm:py-12">

          <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#B79B69]/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E3C58F]">L'esprit Teranga</p>

              <h2 className="mt-3 max-w-xl font-serif text-2xl font-semibold sm:text-4xl">Des découvertes, des rencontres, des souvenirs.</h2>

              <p className="mt-4 max-w-xl text-sm leading-7 text-[#E2E9E3]">

                Un week-end au bord de l'océan, une escapade en famille ou quelques jours au vert :

                choisissez votre destination et prenez le temps de découvrir le Sénégal.

              </p>

              <button type="button" onClick={exploreAll} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#E3C58F] px-5 py-3 text-sm font-semibold text-[#1B382D] transition hover:bg-[#F0D9AD]">

                Trouver mon séjour <ArrowRight size={17} />

              </button>

            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4"><Compass size={20} className="shrink-0 text-[#E3C58F]" /><span className="text-sm">Explorez selon vos envies</span></div>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4"><MapPin size={20} className="shrink-0 text-[#E3C58F]" /><span className="text-sm">Découvrez les régions du Sénégal</span></div>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4"><CheckCircle2 size={20} className="shrink-0 text-[#E3C58F]" /><span className="text-sm">Consultez les conditions avant de réserver</span></div>

            </div>

          </div>

        </section>

      </div>

    </main>

  );

};



export default HomePage;
