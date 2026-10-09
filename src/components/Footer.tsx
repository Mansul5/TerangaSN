import React from 'react';
import { ArrowUpRight, BedDouble, Compass, ShieldCheck, MapPin, Building2, HeartHandshake } from 'lucide-react';
import { SENEGAL_REGIONS } from '@/src/types';

interface FooterProps {
  onSelectRegion: (regionName: string) => void;
  /** Conservé pour compatibilité avec App.tsx. Aucun contrôle Supabase public. */
  onOpenSupabaseModal?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectRegion }) => {
  const currentYear = new Date().getFullYear();
  const destinations = SENEGAL_REGIONS.slice(0, 8);
  const firstDestinations = destinations.slice(0, 4);
  const otherDestinations = destinations.slice(4, 8);

  const regionLinkClass =
    'inline-flex max-w-full items-center gap-1.5 rounded text-left text-sm leading-relaxed text-[#C9D5CC] transition-colors hover:text-[#F0D7A8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B79B69]';

  const features = [
    {
      icon: BedDouble,
      title: 'Des hébergements variés',
      description: 'Hôtels, villas, résidences et autres adresses pour découvrir le Sénégal.',
    },
    {
      icon: ShieldCheck,
      title: 'Des informations utiles',
      description: 'Consultez les caractéristiques, les tarifs affichés et les conditions avant de réserver.',
    },
    {
      icon: Compass,
      title: 'Le Sénégal à explorer',
      description: 'Entre littoral, villes, patrimoine et nature, trouvez votre prochaine destination.',
    },
  ];

  return (
    <footer className="border-t border-[#355744] bg-[#1B382D] text-[#E5EAE3]">
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
        <div className="grid gap-4 border-b border-white/15 pb-9 md:grid-cols-3 md:gap-5">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#B79B69]/25 bg-[#B79B69]/15 text-[#E5C99C]">
                <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-base font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#C9D5CC]">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-9 border-b border-white/15 py-10 min-[380px]:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1fr] lg:gap-10 lg:py-12">
          <div className="min-w-0 min-[380px]:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F7F5EF] font-serif text-2xl font-bold text-[#284C3B]">T</span>
              <span className="font-serif text-2xl font-bold tracking-tight text-white">
                Teranga<span className="text-[#D7B980]">SN</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[#C9D5CC]">
              Votre point de départ pour découvrir les hébergements et préparer vos séjours au Sénégal.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#E4E8DE]">
              <MapPin size={14} className="text-[#D7B980]" aria-hidden="true" />
              Pensé pour le Sénégal 🇸🇳
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="mb-4 font-serif text-base font-semibold text-white">Destinations</h3>
            <ul className="space-y-2.5">
              {firstDestinations.map(region => (
                <li key={region.id}>
                  <button type="button" className={regionLinkClass} onClick={() => onSelectRegion(region.name)}>
                    {region.name}<ArrowUpRight size={13} aria-hidden="true" className="opacity-60" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="mb-4 font-serif text-base font-semibold text-white">À découvrir</h3>
            <ul className="space-y-2.5">
              {otherDestinations.map(region => (
                <li key={region.id}>
                  <button type="button" className={regionLinkClass} onClick={() => onSelectRegion(region.name)}>
                    {region.name}<ArrowUpRight size={13} aria-hidden="true" className="opacity-60" />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className={regionLinkClass} onClick={() => onSelectRegion('Somone')}>
                  Somone<ArrowUpRight size={13} aria-hidden="true" className="opacity-60" />
                </button>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="mb-4 font-serif text-base font-semibold text-white">Pour vos séjours</h3>
            <ul className="space-y-3 text-sm leading-relaxed text-[#C9D5CC]">
              <li className="flex items-start gap-2"><BedDouble size={16} className="mt-0.5 shrink-0 text-[#D7B980]" aria-hidden="true" /> Hôtels et résidences</li>
              <li className="flex items-start gap-2"><HeartHandshake size={16} className="mt-0.5 shrink-0 text-[#D7B980]" aria-hidden="true" /> Chambres d'hôtes</li>
              <li className="flex items-start gap-2"><Compass size={16} className="mt-0.5 shrink-0 text-[#D7B980]" aria-hidden="true" /> Villas et appartements</li>
              <li className="flex items-start gap-2"><Building2 size={16} className="mt-0.5 shrink-0 text-[#D7B980]" aria-hidden="true" /> Lodges et campements</li>
            </ul>
            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-[#B7C6BB]">
              Vous gérez un hébergement ? Découvrez le parcours « Devenir hôte » depuis le menu principal.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-white/15 py-6 text-xs leading-relaxed text-[#B7C6BB] sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="max-w-3xl">
            Les disponibilités, les prix et les conditions de séjour sont propres à chaque hébergement et peuvent évoluer.
            Vérifiez les informations présentées avant de confirmer une réservation.
          </p>
          <span className="shrink-0 font-semibold text-[#E5C99C]">Français · FCFA (XOF)</span>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 pt-6 text-xs text-[#AABDAF] sm:flex-row sm:items-center">
          <p>© {currentYear} TerangaSN. Tous droits réservés.</p>
          <p>Hébergements et séjours au Sénégal <span aria-hidden="true">🇸🇳</span></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
