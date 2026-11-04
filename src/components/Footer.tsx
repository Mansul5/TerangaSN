import React from 'react';
import { ArrowUpRight, BedDouble, Compass, ShieldCheck, MapPin, Building2, HeartHandshake, ArrowRight } from 'lucide-react';
import { SENEGAL_REGIONS } from '@/src/types';

interface FooterProps {
  onSelectRegion: (regionName: string) => void;
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectRegion, onNavigate }) => {
  const currentYear = new Date().getFullYear();
  const destinations = SENEGAL_REGIONS.slice(0, 8);
  const firstDestinations = destinations.slice(0, 4);
  const otherDestinations = destinations.slice(4, 8);

  const regionLinkClass =
    'group inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-sm leading-relaxed text-[#53665A] transition-colors duration-200 hover:text-[#193E30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C7AC85]';

  const features = [
    {
      icon: BedDouble,
      title: 'Des séjours pour chaque envie',
      description: 'Hôtels, villas, résidences et adresses singulières à découvrir.',
    },
    {
      icon: ShieldCheck,
      title: 'Choisissez en confiance',
      description: 'Des informations, des tarifs et des conditions accessibles avant de réserver.',
    },
    {
      icon: Compass,
      title: 'Le Sénégal à explorer',
      description: 'Du littoral aux villes historiques, laissez-vous inspirer.',
    },
  ];

  return (
    <footer className="border-t border-[#E9E5DC] bg-[#F8F6F1] text-[#23382D]">
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-12 sm:px-6 sm:pt-16">
        <div className="grid gap-3 border-b border-[#E6E0D6] pb-10 md:grid-cols-3 md:gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3 rounded-[20px] border border-[#EAE5DC] bg-white p-5 shadow-[0_5px_20px_rgba(25,62,48,0.035)] transition-shadow duration-200 hover:shadow-[0_10px_25px_rgba(25,62,48,0.07)]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF1EB] text-[#193E30]">
                <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-base font-semibold text-[#193E30]">{title}</h3>
                <p className="mt-1.5 text-xs leading-6 text-[#667268]">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-[#E6E0D6] py-12 min-[380px]:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1fr] lg:gap-10">
          <div className="min-w-0 min-[380px]:col-span-2 lg:col-span-1">
            <div className="font-serif text-[30px] font-bold leading-none tracking-[-0.055em] text-[#193E30]">TerangaSN</div>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#667268]">
              Découvrez le Sénégal à votre rythme. Des séjours soigneusement présentés, une recherche simple et une expérience pensée pour vous.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#E6E0D6] bg-white px-3.5 py-2 text-xs font-medium text-[#53665A]">
              <MapPin size={14} className="text-[#A88D66]" aria-hidden="true" />
              Imaginé pour le Sénégal 🇸🇳
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.14em] text-[#193E30]">Destinations</h3>
            <ul className="space-y-3">
              {firstDestinations.map(region => (
                <li key={region.id}>
                  <button type="button" className={regionLinkClass} onClick={() => onSelectRegion(region.name)}>
                    {region.name}<ArrowUpRight size={13} aria-hidden="true" className="opacity-45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.14em] text-[#193E30]">À explorer</h3>
            <ul className="space-y-3">
              {otherDestinations.map(region => (
                <li key={region.id}>
                  <button type="button" className={regionLinkClass} onClick={() => onSelectRegion(region.name)}>
                    {region.name}<ArrowUpRight size={13} aria-hidden="true" className="opacity-45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className={regionLinkClass} onClick={() => onSelectRegion('Somone')}>
                  Somone<ArrowUpRight size={13} aria-hidden="true" className="opacity-45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.14em] text-[#193E30]">Votre séjour</h3>
            <ul className="space-y-3.5 text-sm text-[#53665A]">
              <li className="flex items-center gap-2.5"><BedDouble size={16} className="shrink-0 text-[#A88D66]" aria-hidden="true" /> Hôtels et résidences</li>
              <li className="flex items-center gap-2.5"><HeartHandshake size={16} className="shrink-0 text-[#A88D66]" aria-hidden="true" /> Chambres d'hôtes</li>
              <li className="flex items-center gap-2.5"><Compass size={16} className="shrink-0 text-[#A88D66]" aria-hidden="true" /> Villas et appartements</li>
              <li className="flex items-center gap-2.5"><Building2 size={16} className="shrink-0 text-[#A88D66]" aria-hidden="true" /> Lodges et campements</li>
            </ul>
            <p className="mt-6 border-t border-[#E6E0D6] pt-4 text-xs leading-6 text-[#667268]">
              Vous gérez un hébergement ? Retrouvez le parcours « Devenir hôte » dans le menu principal.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-[#E6E0D6] py-6 text-xs leading-6 text-[#738077] sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="max-w-3xl">
            Les disponibilités, les tarifs et les conditions dépendent de chaque hébergement et peuvent évoluer. Vérifiez les informations avant de confirmer votre réservation.
          </p>
          <span className="shrink-0 font-semibold text-[#53665A]">Français · FCFA (XOF)</span>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 pt-6 text-xs text-[#77847A] sm:flex-row sm:items-center">
          <p>© {currentYear} TerangaSN. Tous droits réservés.</p>
          <nav aria-label="Informations juridiques" className="flex flex-wrap gap-x-4 gap-y-2">
            <button type="button" onClick={() => onNavigate('terms')} className="underline-offset-4 hover:text-[#193E30] hover:underline">Conditions d’utilisation</button>
            <button type="button" onClick={() => onNavigate('host-terms-public')} className="underline-offset-4 hover:text-[#193E30] hover:underline">Conditions pour les hôtes</button>
            <button type="button" onClick={() => onNavigate('privacy-policy')} className="underline-offset-4 hover:text-[#193E30] hover:underline">Politique de confidentialité</button>
          </nav>
          <p className="inline-flex items-center gap-1.5">L'hospitalité sénégalaise, à votre rythme <ArrowRight size={13} aria-hidden="true" /></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
