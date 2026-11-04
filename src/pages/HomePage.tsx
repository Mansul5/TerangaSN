import React, { useEffect, useState } from 'react';

import { ArrowRight, Building2, Compass, Database, MapPin, Search, ShieldCheck, Sparkles, Wallet, Home, Palmtree, BedDouble, Waves } from 'lucide-react';

import { SearchBar } from '@/src/components/SearchBar';

import { HotelCard } from '@/src/components/HotelCard';



import type { Lodging } from '@/src/types';

import { fetchFeaturedHotels, fetchRegionCounts } from '@/src/lib/supabase/api';



interface HomePageProps {

  onSearch: (params: any) => void;

  onSelectHotel: (hotelId: string) => void;

  onSelectRegion: (regionName: string) => void;

  onOpenAuth: () => void;


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

export const HomePage: React.FC<HomePageProps> = ({

  onSearch, onSelectHotel, onSelectRegion, onOpenAuth,

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





    return (
    <main className="boly-page min-w-0 overflow-x-clip pb-24">
      {/* Photographie immersive, texte contrasté et recherche conservée */}
      <section className="relative isolate min-h-[560px] overflow-visible bg-[#193E30] text-white sm:min-h-[610px] lg:min-h-[640px]">
        <div className="absolute inset-0 overflow-hidden">
          <img src={`${COMMONS}Cap-Skirring-Beach-2007.jpg`} alt="Plage du Sénégal bordée de palmiers" fetchPriority="high" decoding="async" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#10281f]/90 via-[#10281f]/65 to-[#10281f]/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10281f]/65 via-transparent to-transparent" />
        </div>
        <div className="boly-container relative z-10 flex min-h-[560px] flex-col justify-center pb-28 pt-16 sm:min-h-[610px] lg:min-h-[640px]">
          <div className="max-w-[700px]">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E9D6B7]"><Sparkles size={15} /> Découvrez le Sénégal autrement</span>
            <h1 className="mt-6 max-w-[680px] font-serif text-[clamp(2.8rem,6vw,5.5rem)] font-medium leading-[1.08] tracking-[-0.035em]">Des séjours inoubliables, <span className="italic text-[#F0D9B3]">en toute confiance.</span></h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-white/85 sm:text-base">Hôtels, villas, résidences et escapades singulières : trouvez l'adresse idéale pour votre prochain voyage.</p>
            <div className="mt-7 flex flex-wrap gap-4 text-xs text-white/85 sm:text-sm">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[#E9D6B7]" /> Conditions transparentes</span>
              <span className="inline-flex items-center gap-2"><Wallet size={16} className="text-[#E9D6B7]" /> Prix en FCFA</span>
            </div>
          </div>
        </div>
        <div className="boly-container absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-1/2">
          <div className="rounded-[22px] border border-[#e8e5dc] bg-white p-3 text-[#26342c] shadow-[0_18px_55px_rgba(25,62,48,0.16)] sm:p-4">
            <SearchBar variant="hero" onSearch={onSearch} />
          </div>
        </div>
      </section>

      <div className="boly-container pt-28 sm:pt-32">
        <section aria-labelledby="categories-title">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a1845f]">À chacun son séjour</p><h2 id="categories-title" className="mt-2 font-serif text-3xl text-[#193e30] sm:text-4xl">L'hébergement qui vous ressemble</h2></div>
            <button onClick={exploreAll} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193e30] hover:underline">Tout explorer <ArrowRight size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label:'Hôtels', icon:Building2, category:'hotel' },
              { label:'Villas', icon:Home, category:'villa' },
              { label:'Résidences', icon:Building2, category:'residence' },
              { label:'Appartements', icon:BedDouble, category:'appartement' },
              { label:'Lodges', icon:Palmtree, category:'lodge' },
              { label:'Campements', icon:Waves, category:'campement' },
            ].map(item => { const Icon = item.icon; return (
              <button key={item.category} type="button" onClick={() => onSearch({ destination:'', category:item.category })} className="boly-card-interactive group flex min-h-[124px] flex-col items-center justify-center gap-3 px-3 py-5 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f5f0] text-[#193e30] transition-colors group-hover:bg-[#e4ede5]"><Icon size={23} strokeWidth={1.5}/></span>
                <span className="text-sm font-semibold text-[#26342c]">{item.label}</span>
              </button>
            ); })}
          </div>
        </section>

        <section aria-labelledby="destinations-title" className="mt-20 sm:mt-24">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a1845f]"><Compass size={15}/> Carnet de voyage</p><h2 id="destinations-title" className="mt-2 font-serif text-3xl text-[#193e30] sm:text-4xl">Les destinations qui inspirent</h2><p className="mt-2 text-sm text-[#68756d]">Des lieux à découvrir, à votre rythme.</p></div>
            <button onClick={exploreAll} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193e30] hover:underline">Voir les destinations <ArrowRight size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {DESTINATIONS.slice(0,8).map((place,index) => { const key = `destination-${place.name}`; const count = regionCounts[place.region] || 0; return (
              <article key={place.name} className="boly-card-interactive group overflow-hidden">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#dfe7dd]">
                  {!imageFailures[key] && <img src={`${COMMONS}${encodeURIComponent(place.photo).replace(/%2F/g, '/')}`} alt={place.location} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" onError={() => setImageFailures(prev => ({...prev,[key]:true}))} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
                  <a href={place.source} target="_blank" rel="noopener noreferrer" aria-label={`Crédit photo : ${place.author}`} className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] text-[#193e30]">Crédit photo</a>
                </div>
                <button type="button" onClick={() => onSelectRegion(place.region)} className="block w-full px-4 py-4 text-left sm:px-5">
                  <h3 className="font-serif text-xl font-semibold text-[#193e30]">{place.name}</h3>
                  <p className="mt-1 text-xs text-[#68756d]">{count ? `${count} hébergement${count>1?'s':''}` : place.location}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#193e30]">Découvrir <ArrowRight size={13}/></span>
                </button>
              </article>
            ); })}
          </div>
          <p className="mt-3 text-xs text-[#68756d]">Photographies de destinations à titre d'inspiration. Crédits et licences accessibles depuis chaque image.</p>
        </section>

        <section aria-labelledby="featured-title" className="mt-20 sm:mt-24">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a1845f]"><Sparkles size={15}/> Sélection TerangaSN</p><h2 id="featured-title" className="mt-2 font-serif text-3xl text-[#193e30] sm:text-4xl">Des adresses à découvrir</h2><p className="mt-2 text-sm text-[#68756d]">De belles expériences, avec des informations claires avant de réserver.</p></div>
            <button onClick={exploreAll} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193e30] hover:underline">Tous les hébergements <ArrowRight size={16}/></button>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {[0,1].map(i => <div key={i} className="boly-card h-64 animate-pulse bg-[#eeede8]" aria-hidden="true" />)}
            </div>
          ) : dbError && featuredLodgings.length === 0 ? (
            <div className="boly-card px-6 py-12 text-center"><Database className="mx-auto text-[#a1845f]" size={30}/><h3 className="mt-3 font-serif text-xl text-[#193e30]">Les hébergements sont momentanément indisponibles</h3><p className="mt-2 text-sm text-[#68756d]">Vous pouvez toujours explorer les destinations.</p><button onClick={exploreAll} className="boly-button-primary mt-5 px-5 py-3 text-sm">Explorer <ArrowRight size={16}/></button></div>
          ) : featuredLodgings.length === 0 ? (
            <div className="boly-card px-6 py-12 text-center"><Building2 className="mx-auto text-[#a1845f]" size={30}/><h3 className="mt-3 font-serif text-xl text-[#193e30]">Les premières adresses arrivent bientôt</h3><p className="mt-2 text-sm text-[#68756d]">Découvrez nos destinations en attendant les premières annonces.</p><button onClick={exploreAll} className="boly-button-primary mt-5 px-5 py-3 text-sm">Découvrir <ArrowRight size={16}/></button></div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{featuredLodgings.map(lodging => <div key={lodging.id} className="boly-card-interactive overflow-hidden"><HotelCard hotel={lodging} onSelect={onSelectHotel} onAuthRequired={onOpenAuth}/></div>)}</div>
          )}
        </section>

        <section className="mt-20 overflow-hidden rounded-[28px] bg-[#193e30] px-6 py-12 text-white sm:mt-24 sm:px-12 sm:py-16">
          <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e5cba7]">L'esprit TerangaSN</p><h2 className="mt-3 max-w-xl font-serif text-3xl leading-tight sm:text-4xl">Le Sénégal, à vivre pleinement.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-white/80">Un week-end face à l'océan, une parenthèse en famille ou une escapade au vert. Trouvez votre prochaine adresse.</p><button onClick={exploreAll} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#f2e7d4] px-5 py-3 text-sm font-semibold text-[#193e30] transition hover:bg-white">Trouver mon séjour <ArrowRight size={16}/></button></div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-4 text-sm"><Search size={19} className="text-[#e5cba7]"/> Recherche simple et intuitive</div>
              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-4 text-sm"><MapPin size={19} className="text-[#e5cba7]"/> Des destinations dans tout le Sénégal</div>
              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-4 text-sm"><ShieldCheck size={19} className="text-[#e5cba7]"/> Conditions consultables avant réservation</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default HomePage;
