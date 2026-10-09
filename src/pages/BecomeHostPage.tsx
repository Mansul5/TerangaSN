import React, { useState } from 'react';
import {
  ArrowRight, BarChart3, BedDouble, Building2, CalendarDays, Check,
  CheckCircle2, ChevronDown, Clock3,
  Globe2, KeyRound, LayoutDashboard,
  MessageCircle, ShieldCheck, Users, Wallet, BriefcaseBusiness, BadgeCheck, LockKeyhole, } from 'lucide-react';

interface BecomeHostPageProps {
  isAuthenticated: boolean;
  onStart: () => void;
  onSignIn: () => void;
}

type PlanValue = string | boolean;
type ComparisonRow = { name: string; standard: PlanValue; pro: PlanValue; enterprise: PlanValue };
type ComparisonGroup = { title: string; rows: ComparisonRow[] };
const PRO_PRICE_TTC = 39900;
const STANDARD_COMMISSION = 0.08;
const money = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} F CFA`;
const C = {
  forest: '#284C3B', deep: '#1B382D', cream: '#F7F5EF', sand: '#E9E2D5',
  gold: '#B79B69', ink: '#30352F', muted: '#6F756D', light: '#EFF3ED',
};

const comparison: ComparisonGroup[] = [
  { title: 'Tarification et distribution', rows: [
    { name: 'Abonnement mensuel TTC', standard: '0 F CFA', pro: '39 900 F CFA', enterprise: 'Sur devis' },
    { name: 'Commission sur les réservations marketplace éligibles', standard: '8 % TTC', pro: '0 %', enterprise: 'Négociée' },
    { name: 'Réservations via un lien direct attribué à l’établissement', standard: '0 %*', pro: '0 %*', enterprise: '0 %*' },
    { name: 'Réservations saisies manuellement', standard: '0 %', pro: '0 %', enterprise: '0 %' },
    { name: 'Visibilité sur TerangaSN Booking', standard: true, pro: true, enterprise: 'Selon contrat' },
  ] },
  { title: 'Gestion quotidienne', rows: [
    { name: 'Établissements actifs', standard: '1', pro: 'Jusqu’à 3', enterprise: 'Sur mesure' },
    { name: 'Chambres, unités et offres', standard: 'Illimitées*', pro: 'Illimitées*', enterprise: 'Selon contrat' },
    { name: 'Réservations manuelles', standard: 'Illimitées*', pro: 'Illimitées*', enterprise: 'Selon contrat' },
    { name: 'Calendrier et disponibilités', standard: true, pro: true, enterprise: true },
    { name: 'Suivi des arrivées et départs', standard: true, pro: true, enterprise: true },
    { name: 'Gestion du ménage', standard: 'Statut des chambres et liste des ménages', pro: 'Tâches assignées, priorités et suivi', enterprise: 'Coordination des équipes multi-sites' },
    { name: 'Suivi des clients', standard: true, pro: true, enterprise: true },
    { name: 'Acomptes et règlements', standard: true, pro: true, enterprise: true },
  ] },
  { title: 'Équipe et organisation', rows: [
    { name: 'Accès collaborateurs', standard: 'Propriétaire seul', pro: 'Jusqu’à 5', enterprise: 'Sur mesure' },
    { name: 'Rôles et permissions', standard: 'Accès principal', pro: 'Rôles prédéfinis', enterprise: 'Personnalisés' },
    { name: 'Vue multi-établissements', standard: false, pro: true, enterprise: 'Consolidée' },
    { name: 'Formation et déploiement', standard: 'Documentation', pro: 'Accompagnement prioritaire', enterprise: 'Personnalisés' },
  ] },
  { title: 'Croissance, données et assistance', rows: [
    { name: 'Site vitrine partageable', standard: 'Modèle fixe, photos et descriptifs modifiables', pro: 'Couleurs, galeries et sections personnalisables', enterprise: 'Identité et vitrines multi-établissements' },
    { name: 'Lien de réservation directe', standard: true, pro: true, enterprise: true },
    { name: 'Promotions', standard: 'Tarifs réduits sur une période', pro: 'Codes, longs séjours et offres programmées', enterprise: 'Campagnes coordonnées multi-sites' },
    { name: 'Statistiques', standard: 'Essentielles', pro: 'Avancées', enterprise: 'Consolidées' },
    { name: 'Exports CSV, Excel et PDF', standard: true, pro: true, enterprise: true },
    { name: 'Automatisations', standard: 'Calculs et indicateurs automatiques', pro: 'Tâches de ménage et rappels internes', enterprise: 'Règles et rapports programmés sur mesure' },
    { name: 'Assistance', standard: 'Standard', pro: 'Prioritaire', enterprise: 'Dédiée selon contrat' },
    { name: 'Intégrations / API spécifiques', standard: false, pro: 'Selon disponibilité', enterprise: 'Selon faisabilité et contrat' },
  ] },
];

const faq = [
  ['Puis-je commencer gratuitement ?', 'Oui. Standard ne comporte aucun abonnement mensuel. Une commission de 8 % TTC est prévue uniquement sur les réservations marketplace éligibles apportées par TerangaSN Booking.'],
  ['Dois-je utiliser TerangaSN Booking pour utiliser Manager ?', 'Non. Manager est pensé comme un logiciel de gestion autonome : vous pouvez saisir vos réservations reçues par téléphone, WhatsApp, à la réception ou depuis d’autres plateformes.'],
  ['Pourquoi 0 % via mon lien si la réservation se fait sur TerangaSN ?', 'Le logiciel qui enregistre la réservation et le canal qui a amené le client sont deux choses différentes. Une réservation attribuée à votre lien personnel peut être traitée sur TerangaSN sans commission : c’est vous qui avez apporté le client. En Standard, les 8 % TTC concernent uniquement les réservations éligibles apportées par la recherche publique TerangaSN Booking. Les règles d’attribution et de prévention des abus seront précisées avant le lancement.'],
  ['Que comprend la gestion du ménage ?', 'Standard prévoit le statut des chambres (à nettoyer, en cours, prête) et une liste de tâches. Pro ajoute l’attribution aux employés, les priorités et le suivi. Enterprise prévoit la coordination de plusieurs sites. Ces modules seront déployés progressivement.'],
  ['Que signifie automatisations ?', 'Ce sont des opérations déclenchées par le logiciel : calcul des nuitées et indicateurs en Standard, tâches de ménage et rappels internes en Pro, règles et rapports sur mesure en Enterprise. Cela ne promet ni intelligence artificielle, ni messages WhatsApp automatiques, ni synchronisation Booking.com/Airbnb.'],
  ['Quelle différence entre les vitrines Standard et Pro ?', 'Standard permet de renseigner les photos, chambres, prix, équipements et coordonnées dans une présentation fixe. Pro prévoit davantage de choix de couleurs, galeries et sections. Dans les deux cas, les réservations directes attribuées au lien restent à 0 % de commission TerangaSN.'],
  ['Quelles promotions puis-je créer ?', 'Standard prévoit des réductions simples sur une période. Pro prévoit des codes promotionnels, des offres pour longs séjours et des campagnes programmées. Enterprise pourra coordonner les offres de plusieurs établissements. Ces possibilités seront livrées progressivement.'],
  ['Pourquoi choisir Pro ?', 'Pro supprime la commission marketplace TerangaSN et ajoute notamment la gestion de trois établissements, cinq collaborateurs, des permissions, des statistiques avancées et une vitrine plus personnalisable.'],
  ['Quand Pro devient-il financièrement intéressant ?', 'Avec les tarifs de travail actuels, le point d’équilibre est atteint à 498 750 F CFA de réservations marketplace éligibles par mois. Les réservations directes sont exclues de ce calcul.'],
  ['Puis-je connecter automatiquement Booking.com ou Airbnb ?', 'Pas dans le MVP. Vous pourrez saisir ces réservations manuellement ; aucune synchronisation automatique avec ces services n’est promise au lancement.'],
  ['Comment fonctionne Enterprise ?', 'Enterprise est une formule spéciale sur devis pour les groupes et opérateurs ayant des besoins spécifiques : nombre d’établissements, organisation, accompagnement, rapports, intégrations et conditions financières sont étudiés au cas par cas.'],
  ['Dois-je être propriétaire de l’établissement ?', 'Non. Un propriétaire, un gérant ou un représentant dûment autorisé peut utiliser le parcours hôte. Des justificatifs pourront être demandés avant publication.'],
  ['Les fonctionnalités sont-elles déjà toutes disponibles ?', 'Cette page présente la vision produit et les formules envisagées. Certaines fonctions avancées seront déployées progressivement ; les disponibilités effectives seront indiquées lors de la commercialisation.'],
];

const Heading: React.FC<{ eyebrow: string; title: string; description?: string; center?: boolean }> = ({ eyebrow, title, description, center = false }) => (
  <div className={center ? 'mx-auto max-w-[760px] text-center' : 'max-w-[760px]'}>
    <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: C.forest }}>{eyebrow}</p>
    <h2 className="mt-3 font-serif text-3xl font-semibold leading-[1.18] tracking-tight sm:text-4xl lg:text-[42px]" style={{ color: C.ink }}>{title}</h2>
    {description && <p className="mt-5 text-sm leading-7 sm:text-base" style={{ color: C.muted }}>{description}</p>}
  </div>
);

const Feature: React.FC<{ value: PlanValue }> = ({ value }) => typeof value === 'boolean'
  ? value ? <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: C.forest }}><CheckCircle2 size={16} /> Inclus</span> : <span className="text-stone-400">—</span>
  : <span>{value}</span>;

const IconTile: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({ icon: Icon, title, description }) => (
  <div className="rounded-[22px] border border-[#E9E2D5] bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-[#284C3B]/5">
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF3ED] text-[#284C3B]"><Icon size={21} strokeWidth={1.8} /></span>
    <h3 className="mt-5 text-[16px] font-semibold" style={{ color: C.ink }}>{title}</h3>
    <p className="mt-2 text-sm leading-6" style={{ color: C.muted }}>{description}</p>
  </div>
);

export const BecomeHostPage: React.FC<BecomeHostPageProps> = ({ isAuthenticated, onStart, onSignIn }) => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [bookingVolume, setBookingVolume] = useState(1000000);
  const standardCost = bookingVolume * STANDARD_COMMISSION;
  const savings = standardCost - PRO_PRICE_TTC;
  const threshold = PRO_PRICE_TTC / STANDARD_COMMISSION;
  const scrollPricing = () => document.getElementById('host-pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="overflow-hidden bg-[#F7F5EF] text-[#30352F]">
      {/* INTRODUCTION : LES BÉNÉFICES AVANT LES OFFRES */}
      <section className="relative overflow-hidden bg-[#284C3B] text-white">
        <div className="pointer-events-none absolute -right-40 -top-56 h-[650px] w-[650px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 -top-32 h-[480px] w-[480px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-48 left-[15%] h-[380px] w-[380px] rounded-full bg-[#B79B69]/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-[#E9E2D5]"><span className="h-1.5 w-1.5 rounded-full bg-[#D7B880]" /> TERANGASN MANAGER</span>
            <h1 className="mt-8 max-w-2xl font-serif text-[42px] font-medium leading-[1.08] tracking-tight sm:text-[58px] lg:text-[66px]">
              Votre établissement.<br /><span className="text-[#E2D3B6]">Toute votre activité.</span><br />Un seul espace.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-white/75 sm:text-lg">Des réservations à l'accueil des voyageurs, simplifiez votre quotidien. Retrouvez vos chambres, votre calendrier, vos clients et vos paiements dans un outil pensé pour les professionnels de l'hébergement.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F5EF] px-6 py-3.5 text-sm font-bold text-[#284C3B] transition hover:bg-white">Créer mon espace hôte <ArrowRight size={17} /></button>
              <button type="button" onClick={() => document.getElementById('manager-features')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">Découvrir Manager <ArrowRight size={16} /></button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/75">
              {['Vos réservations au même endroit', 'Un calendrier plus clair', 'Une gestion accessible partout'].map((item) => <span key={item} className="flex items-center gap-2"><Check size={15} className="text-[#D7B880]" />{item}</span>)}
            </div>
            {!isAuthenticated && <button type="button" onClick={onSignIn} className="mt-7 text-xs font-medium text-white/75 underline underline-offset-4 hover:text-white">Vous avez déjà un compte ? Connectez-vous</button>}
          </div>
            {/* Aperçu fidèle aux rubriques du tableau de bord en cours de développement. */}
            <div className="relative mx-auto w-full max-w-[540px]">
              <div className="absolute -inset-5 rounded-[36px] border border-white/10 bg-white/5" />
              <div className="relative overflow-hidden rounded-[25px] border border-white/20 bg-[#F7F5EF] p-3 text-[#30352F] shadow-2xl shadow-black/20 sm:p-4">
                <div className="flex items-center justify-between border-b border-[#E9E2D5] pb-3">
                  <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#284C3B] text-white"><LayoutDashboard size={18}/></span><div><p className="text-[9px] font-bold uppercase tracking-wider text-[#6F756D]">TerangaSN Manager</p><h3 className="text-sm font-semibold">Vue d'ensemble</h3></div></div>
                  <span className="rounded-full bg-[#EFF3ED] px-2 py-1 text-[9px] font-semibold text-[#284C3B]">Démonstration</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] text-[#6F756D]">
                  {['Établissements', 'Réservations', 'Clients', 'Chambres & offres', 'Calendrier', 'Finances'].map((label) => <span key={label} className="rounded-md border border-[#E9E2D5] bg-white px-2 py-1.5">{label}</span>)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[{label:'Réservations',value:'12',icon:CalendarDays},{label:'Revenus enregistrés',value:'850 k',icon:Wallet},{label:'À venir',value:'240 k',icon:Clock3},{label:'Nuitées',value:'38',icon:BedDouble}].map(({label,value,icon:Icon}) => <div key={label} className="rounded-xl border border-[#E9E2D5] bg-white p-3"><Icon size={15} className="text-[#284C3B]"/><p className="mt-2 text-lg font-semibold">{value}</p><p className="mt-1 text-[9px] leading-3 text-[#6F756D]">{label}</p></div>)}
                </div>
                <div className="mt-3 rounded-xl border border-[#E9E2D5] bg-white p-3">
                  <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">Réservations récentes</p><span className="text-[9px] text-[#6F756D]">Exemple fictif</span></div>
                  {[['Studio Confort','12–15 oct.','Confirmée'],['Suite familiale','17–20 oct.','En attente'],['Chambre 103','22–24 oct.','Confirmée']].map(([room,dates,status]) => <div key={room} className="mt-2 flex items-center justify-between gap-2 border-t border-[#F0EDE6] pt-2 text-[10px]"><div><p className="font-medium">{room}</p><p className="text-[#6F756D]">{dates}</p></div><span className={status === 'Confirmée' ? 'rounded-full bg-[#EFF3ED] px-2 py-1 text-[#284C3B]' : 'rounded-full bg-[#F7F0E1] px-2 py-1 text-[#83632C]'}>{status}</span></div>)}
                </div>
                <p className="mt-3 text-center text-[9px] leading-4 text-[#6F756D]">Aperçu non interactif inspiré des rubriques du tableau de bord réel. Chiffres fictifs.</p>
              </div>
            </div>
        </div>
      </section>

      <section className="border-b border-[#E9E2D5] bg-white py-8"><div className="mx-auto max-w-7xl px-5 sm:px-8"><p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#6F756D]">Pensé pour tous les types d'hébergements</p><div className="mt-5 flex flex-wrap justify-center gap-2">{['Hôtels', 'Résidences', 'Villas', 'Appartements', 'Lodges', 'Campements', 'Chambres d’hôtes'].map((type) => <span key={type} className="rounded-full border border-[#E9E2D5] bg-[#F7F5EF] px-4 py-2 text-xs font-medium text-[#4F584F]">{type}</span>)}</div></div></section>

      <section id="manager-features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <Heading eyebrow="Une gestion plus simple" title="Moins de tâches dispersées. Plus de temps pour vos voyageurs." description="Au lieu de multiplier les carnets, tableaux et conversations, organisez vos opérations quotidiennes autour d'une seule vue claire." center />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <IconTile icon={CalendarDays} title="Calendrier centralisé" description="Visualisez les dates occupées, libres ou bloquées et retrouvez vos séjours en un coup d'œil." />
          <IconTile icon={MessageCircle} title="Toutes vos demandes" description="Enregistrez les réservations reçues sur WhatsApp, par téléphone ou directement à l'accueil." />
          <IconTile icon={BedDouble} title="Chambres et disponibilités" description="Structurez vos unités, tarifs, capacités et équipements pour mieux anticiper les séjours." />
          <IconTile icon={KeyRound} title="Arrivées et départs" description="Préparez les check-in, suivez les check-out et gardez une réception bien organisée." />
          <IconTile icon={Wallet} title="Paiements et acomptes" description="Distinguez réservations confirmées et montants réellement encaissés. Suivez les soldes restants." />
          <IconTile icon={BarChart3} title="Une activité lisible" description="Consultez les indicateurs essentiels, les tendances de réservation et vos données exportables." />
        </div>
      </section>

      <section className="bg-white py-20 lg:py-24"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div><Heading eyebrow="Un logiciel indépendant" title="Votre activité ne se limite pas à une plateforme de réservation." description="TerangaSN Manager vous accompagne même quand vos clients réservent ailleurs. Vous conservez la maîtrise de votre organisation et de vos informations." />
          <div className="mt-8 space-y-5">{[
            ['01', 'La demande arrive', 'Un client vous écrit sur WhatsApp, appelle ou se présente à la réception.'],
            ['02', 'Vous saisissez le séjour', 'Ajoutez le client, les dates, l’unité et les informations de paiement.'],
            ['03', 'Vous pilotez votre planning', 'Retrouvez les séjours et les disponibilités dans votre espace de gestion.'],
          ].map(([n, title, detail]) => <div key={n} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF3ED] text-xs font-bold text-[#284C3B]">{n}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#6F756D]">{detail}</p></div></div>)}</div>
          <p className="mt-8 rounded-xl border border-[#E9E2D5] bg-[#F7F5EF] p-4 text-xs leading-6 text-[#6F756D]">Les réservations externes sont saisies manuellement dans la première version. La synchronisation automatique avec Airbnb ou Booking.com n'est pas incluse dans le MVP.</p>
        </div>
        <div className="rounded-[28px] bg-[#284C3B] p-6 text-white sm:p-9"><p className="text-xs font-semibold uppercase tracking-widest text-[#D8D1BD]">Une journée mieux organisée</p><h3 className="mt-3 font-serif text-3xl">Un accueil plus serein.</h3><div className="mt-8 space-y-3">{[
          {icon: Clock3, title: '09:00 · Préparer les départs', desc: 'Consultez les séjours qui se terminent.'},
          {icon: BedDouble, title: '11:00 · Vérifier les chambres', desc: 'Repérez les unités à préparer.'},
          {icon: MessageCircle, title: '14:00 · Ajouter une réservation', desc: 'Une demande reçue par téléphone.'},
          {icon: CheckCircle2, title: '16:00 · Accueillir les arrivées', desc: 'Retrouvez les informations du séjour.'},
        ].map(({icon: Icon, title, desc}) => <div key={title} className="flex items-start gap-4 rounded-2xl border border-white/15 bg-white/10 p-4"><span className="rounded-xl bg-white/10 p-2.5"><Icon size={19} className="text-[#E2D3B6]" /></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-white/65">{desc}</p></div></div>)}</div><p className="mt-5 text-xs text-white/50">Scénario illustratif du fonctionnement prévu.</p></div>
      </div></section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
        <div><Heading eyebrow="Votre vitrine, votre relation client" title="Un lien de réservation à votre image." description="Présentez votre établissement avec ses photos, ses chambres et ses tarifs. Partagez votre vitrine avec vos clients habituels, sur WhatsApp ou sur vos réseaux sociaux." />
          <div className="mt-7 space-y-4">{[
            'Une page dédiée à votre établissement',
            'Un lien direct facile à partager',
            '0 % de commission sur les réservations attribuées à votre lien direct',
            'Une présentation essentielle, enrichie avec les options avancées',
          ].map((line) => <p key={line} className="flex items-start gap-3 text-sm leading-6"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#284C3B]" />{line}</p>)}</div>
          <p className="mt-6 text-xs leading-6 text-[#6F756D]">La vitrine et ses possibilités de personnalisation seront déployées progressivement. La réservation peut se faire sur TerangaSN : c’est l’origine du client qui détermine la commission. Les règles d’attribution seront précisées dans les conditions commerciales.</p>
        </div>
        <div className="overflow-hidden rounded-[26px] border border-[#E9E2D5] bg-white p-4 shadow-xl shadow-[#284C3B]/5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-[#E9E2D5] pb-4 text-xs text-[#6F756D]">
            <Globe2 size={16} className="shrink-0 text-[#284C3B]" />
            <span className="min-w-0 flex-1 truncate">terangasn.sn/e/les-palmiers</span>
            <span className="rounded-full bg-[#EFF3ED] px-2.5 py-1 text-[10px] font-semibold text-[#284C3B]">Aperçu</span>
          </div>

          {/* Maquette illustrative d'une véritable fiche établissement. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="relative col-span-2 row-span-2 flex min-h-[188px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#B9C8B8] via-[#DCE6D7] to-[#E9E2D5] sm:min-h-[224px]">
              <div className="text-center text-[#284C3B]"><Building2 size={43} className="mx-auto"/><p className="mt-3 px-2 text-[11px] font-medium">Photo principale</p></div>
              <span className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-[#284C3B]">1 / 8 photos</span>
            </div>
            <div className="flex min-h-[90px] items-center justify-center rounded-xl bg-[#E9E2D5] text-center text-[10px] text-[#6F756D] sm:min-h-[108px]">Chambre & suite</div>
            <div className="flex min-h-[90px] items-center justify-center rounded-xl bg-[#DCE6D7] text-center text-[10px] text-[#284C3B] sm:min-h-[108px]">Piscine & espaces</div>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#B79B69]">Résidence · Séjour & détente</p><h3 className="mt-1 font-serif text-2xl font-semibold">Résidence Les Palmiers</h3><p className="mt-1 text-xs text-[#6F756D]">Saly, Petite Côte · Sénégal</p></div>
            <div className="rounded-xl bg-[#EFF3ED] px-3 py-2 text-center"><p className="text-sm font-bold text-[#284C3B]">4,8 / 5</p><p className="text-[10px] text-[#6F756D]">Note fictive</p></div>
          </div>

          <p className="mt-4 text-xs leading-6 text-[#6F756D]">Une résidence paisible à proximité des plages, avec des espaces lumineux et des logements pensés pour les séjours en couple, en famille ou entre amis.</p>
          <div className="mt-4 flex flex-wrap gap-2">{['Wi-Fi', 'Piscine', 'Parking', 'Climatisation', 'Cuisine équipée'].map((t) => <span key={t} className="rounded-full bg-[#F7F5EF] px-3 py-1.5 text-[11px] text-[#30352F]">{t}</span>)}</div>

          <div className="mt-5 border-t border-[#E9E2D5] pt-5">
            <div className="flex items-center justify-between gap-3"><h4 className="font-serif text-lg font-semibold">Choisissez votre hébergement</h4><span className="text-[10px] text-[#6F756D]">Tarifs indicatifs TTC</span></div>
            <div className="mt-3 space-y-3">
              {[
                { name: 'Studio Confort', detail: '2 voyageurs · 1 grand lit · 28 m²', price: '35 000 F CFA', tag: 'Idéal en couple' },
                { name: 'Suite familiale', detail: '4 voyageurs · 2 chambres · 55 m²', price: '65 000 F CFA', tag: 'Pour les familles' },
              ].map((room) => <div key={room.name} className="flex flex-col gap-3 rounded-xl border border-[#E9E2D5] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-sm font-semibold">{room.name}</p><p className="mt-1 text-[11px] text-[#6F756D]">{room.detail}</p><p className="mt-2 text-[10px] font-medium text-[#284C3B]">{room.tag}</p></div>
                <div className="shrink-0 sm:text-right"><p className="text-sm font-bold text-[#284C3B]">{room.price}</p><p className="text-[10px] text-[#6F756D]">par nuit</p></div>
              </div>)}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[#F7F5EF] p-4 text-[11px]">
            <div><p className="font-semibold text-[#30352F]">Arrivée</p><p className="mt-1 text-[#6F756D]">À partir de 15 h</p></div>
            <div><p className="font-semibold text-[#30352F]">Départ</p><p className="mt-1 text-[#6F756D]">Avant 11 h</p></div>
            <div><p className="font-semibold text-[#30352F]">Annulation</p><p className="mt-1 text-[#6F756D]">Selon les conditions du séjour</p></div>
            <div><p className="font-semibold text-[#30352F]">Contact</p><p className="mt-1 text-[#6F756D]">Messagerie de l'établissement</p></div>
          </div>

          <div className="mt-5 rounded-xl bg-[#284C3B] py-3.5 text-center text-sm font-semibold text-white">Voir les disponibilités et réserver</div>
          <p className="mt-3 text-center text-[10px] leading-5 text-[#6F756D]">Exemple fictif non interactif · Photos, tarifs, avis et informations présentés à titre d'illustration</p>
        </div>
      </section>

      {/* Les offres précèdent volontairement le comparatif détaillé. */}
      <section id="host-pricing" className="scroll-mt-20 border-y border-[#E9E2D5] bg-[#F7F5EF] py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Heading eyebrow="Des formules adaptées à votre activité" title="Une gestion professionnelle, à votre rythme." description="Commencez avec les outils essentiels, développez votre activité avec Pro ou construisez une solution adaptée à votre groupe avec Enterprise." center />
          <div className="mt-12 grid gap-5 lg:grid-cols-3 lg:items-stretch">
            <article className="flex flex-col rounded-[26px] border border-[#E9E2D5] bg-white p-7 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6F756D]">Pour démarrer</p>
              <h3 className="mt-3 font-serif text-3xl font-semibold">Standard</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#6F756D]">La gestion quotidienne, sans abonnement mensuel.</p>
              <p className="mt-6 text-4xl font-semibold">0 F CFA <span className="text-xs font-normal text-[#6F756D]">TTC / mois</span></p>
              <div className="mt-5 rounded-xl bg-[#F7F5EF] p-4"><p className="text-xl font-semibold">8 % TTC</p><p className="mt-1 text-xs text-[#6F756D]">Sur les réservations marketplace éligibles uniquement</p></div>
              <ul className="mt-6 flex-1 space-y-3">{['1 établissement actif','Calendrier, chambres et réservations manuelles','Clients, paiements et exports','Vitrine essentielle et lien direct à 0 %','Suivi simple du ménage et promotions'].map(item => <li key={item} className="flex gap-2 text-sm leading-6"><Check size={17} className="mt-1 shrink-0 text-[#284C3B]"/>{item}</li>)}</ul>
              <button type="button" onClick={onStart} className="mt-8 rounded-xl border border-[#284C3B] px-5 py-3.5 text-sm font-semibold text-[#284C3B] transition hover:bg-[#EFF3ED]">Commencer gratuitement</button>
            </article>
            <article className="relative flex flex-col rounded-[26px] border-2 border-[#284C3B] bg-[#EFF3ED] p-7 shadow-lg shadow-[#284C3B]/10">
              <span className="absolute -top-3 right-6 rounded-full bg-[#284C3B] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">Pour aller plus loin</span>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#284C3B]">Pour les professionnels en croissance</p>
              <h3 className="mt-3 font-serif text-3xl font-semibold">Pro</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#6F756D]">Plus d'autonomie, plus de collaboration et zéro commission marketplace.</p>
              <p className="mt-6 text-4xl font-semibold text-[#284C3B]">39 900 F <span className="text-xs font-normal text-[#6F756D]">CFA TTC / mois</span></p>
              <div className="mt-5 rounded-xl border border-[#D5E2D7] bg-white p-4"><p className="text-2xl font-semibold text-[#284C3B]">0 %</p><p className="mt-1 text-xs text-[#6F756D]">Commission TerangaSN sur les réservations marketplace</p></div>
              <ul className="mt-6 flex-1 space-y-3">{['Tout Standard inclus','Jusqu’à 3 établissements et 5 collaborateurs','Rôles et permissions','Statistiques, ménage et promotions avancés','Vitrine personnalisable et assistance prioritaire'].map(item => <li key={item} className="flex gap-2 text-sm leading-6"><Check size={17} className="mt-1 shrink-0 text-[#284C3B]"/>{item}</li>)}</ul>
              <button type="button" onClick={onStart} className="mt-8 rounded-xl bg-[#284C3B] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1B382D]">Créer mon espace hôte</button>
              <p className="mt-3 text-center text-[11px] text-[#6F756D]">Souscription après activation du compte</p>
            </article>
            <article className="flex flex-col rounded-[26px] bg-[#30352F] p-7 text-white shadow-sm">
              <div className="flex items-center gap-2 text-[#E2D3B6]"><BadgeCheck size={19}/><p className="text-[11px] font-bold uppercase tracking-widest">Statut spécial · Sur mesure</p></div>
              <h3 className="mt-3 font-serif text-3xl font-semibold">Enterprise</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-white/70">Pour les groupes hôteliers et organisations complexes.</p>
              <p className="mt-6 text-3xl font-semibold">Sur devis</p>
              <div className="mt-5 rounded-xl border border-white/15 bg-white/10 p-4"><p className="text-lg font-semibold">Conditions négociées</p><p className="mt-1 text-xs text-white/70">Tarification, commissions et accompagnement selon contrat</p></div>
              <ul className="mt-6 flex-1 space-y-3">{['Nombre d’établissements sur mesure','Organisation multi-sites et rôles personnalisés','Rapports consolidés et campagnes coordonnées','Formation, déploiement et assistance dédiés','Intégrations étudiées selon faisabilité'].map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-white/85"><Check size={17} className="mt-1 shrink-0 text-[#E2D3B6]"/>{item}</li>)}</ul>
              <button type="button" onClick={onStart} className="mt-8 rounded-xl border border-white/40 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">Démarrer le parcours hôte</button>
              <p className="mt-3 text-center text-[11px] text-white/60">Devis à organiser avec l’équipe commerciale</p>
            </article>
          </div>
          <p className="mx-auto mt-7 max-w-4xl text-center text-xs leading-6 text-[#6F756D]">Tarifs TTC et fonctionnalités envisagés, sous réserve de validation commerciale et fiscale. Le 0 % sur les réservations directes suppose une attribution vérifiée au lien de l’établissement. Les frais éventuels des prestataires de paiement sont distincts. Les fonctions avancées seront déployées progressivement.</p>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Heading eyebrow="Comparaison détaillée" title="Des différences claires, au-delà du prix." description="Comparez les conditions financières, les opérations quotidiennes, le travail en équipe et les possibilités de croissance." center />
        <div className="mt-10 overflow-x-auto rounded-[20px] border border-[#E9E2D5]"><table className="w-full min-w-[760px] border-collapse text-left text-[13px]"><thead><tr className="bg-[#F7F5EF]"><th className="w-[34%] px-5 py-5 font-semibold">Fonctionnalité</th><th className="w-[22%] px-4 py-5 font-semibold">Standard</th><th className="w-[22%] bg-[#EFF3ED] px-4 py-5 font-semibold text-[#284C3B]">Pro</th><th className="w-[22%] px-4 py-5 font-semibold">Enterprise</th></tr></thead><tbody>{comparison.map((group) => <React.Fragment key={group.title}><tr><th colSpan={4} className="bg-[#E9E2D5]/55 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-[#284C3B]">{group.title}</th></tr>{group.rows.map((r, i) => <tr key={r.name} className={`border-t border-[#E9E2D5] ${i % 2 ? 'bg-[#FCFBF8]' : 'bg-white'}`}><th className="px-5 py-4 font-medium">{r.name}</th><td className="px-4 py-4 text-[#6F756D]"><Feature value={r.standard}/></td><td className="bg-[#EFF3ED]/60 px-4 py-4 font-semibold text-[#284C3B]"><Feature value={r.pro}/></td><td className="px-4 py-4 text-[#6F756D]"><Feature value={r.enterprise}/></td></tr>)}</React.Fragment>)}</tbody></table></div><p className="mt-4 text-xs leading-6 text-[#6F756D]">* Le taux direct de 0 % suppose une attribution vérifiée au lien de l’établissement, même si la réservation est finalisée sur TerangaSN. Les limites proposées (3 établissements et 5 collaborateurs en Pro) ainsi que les fonctions avancées restent à confirmer avant commercialisation. La mention « inclus » décrit le périmètre envisagé, pas une garantie de disponibilité immédiate.</p>
      </div></section>

      <section className="bg-[#F7F5EF] py-20 lg:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Heading eyebrow="Simulateur de coûts TTC" title="À quel moment Pro devient-il avantageux ?" description="Comparez les coûts à partir du montant mensuel des réservations éligibles apportées par TerangaSN Booking. Les réservations directes ne sont pas prises en compte." center />
        <div className="mx-auto mt-10 max-w-4xl rounded-[24px] border border-[#E9E2D5] bg-white p-6 sm:p-9"><label htmlFor="host-booking-volume" className="text-sm font-semibold">Volume mensuel de réservations marketplace</label><p className="mt-3 font-serif text-3xl font-semibold text-[#284C3B] sm:text-4xl">{money(bookingVolume)}</p><input id="host-booking-volume" type="range" min={0} max={5000000} step={25000} value={bookingVolume} onChange={(e) => setBookingVolume(Number(e.target.value))} className="mt-7 w-full accent-[#284C3B]"/><div className="mt-2 flex justify-between text-xs text-[#6F756D]"><span>0 F</span><span>5 000 000 F</span></div><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[#F7F5EF] p-5"><p className="text-sm text-[#6F756D]">Standard · commission 8 %</p><p className="mt-3 text-2xl font-semibold">{money(standardCost)}</p><p className="mt-2 text-xs text-[#6F756D]">Coût estimé pour le mois</p></div><div className="rounded-2xl bg-[#EFF3ED] p-5"><p className="text-sm text-[#284C3B]">Pro · commission 0 %</p><p className="mt-3 text-2xl font-semibold text-[#284C3B]">{money(PRO_PRICE_TTC)}</p><p className="mt-2 text-xs text-[#6F756D]">Abonnement mensuel TTC</p></div></div><div className="mt-7 border-t border-[#E9E2D5] pt-6"><p className="text-sm text-[#6F756D]">{savings > 0 ? 'Économie mensuelle estimée avec Pro' : savings < 0 ? 'Surcoût mensuel estimé avec Pro' : 'Coût identique'}</p><p className="mt-2 text-3xl font-semibold" style={{color: savings > 0 ? C.forest : C.ink}}>{money(Math.abs(savings))}</p><p className="mt-3 text-sm leading-6 text-[#6F756D]">{savings > 0 ? `À volume constant, cela représente ${money(savings * 12)} d'économies estimées sur douze mois.` : 'À ce volume, Standard est moins coûteux. Pro peut néanmoins répondre à des besoins de gestion avancée.'}</p></div><p className="mt-7 rounded-xl bg-[#F7F5EF] p-4 text-sm leading-6"><strong>Point d'équilibre : {money(threshold)} / mois.</strong> Au-delà, Pro est moins coûteux selon les tarifs envisagés.</p><p className="mt-5 text-xs leading-5 text-[#6F756D]">Simulation indicative, hors frais éventuels de paiement, annulations et ajustements. Elle ne constitue pas un devis.</p></div>
      </div></section>

      <section className="bg-white py-20 lg:py-24"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20"><div><Heading eyebrow="Collaboration" title="Une équipe coordonnée, des responsabilités claires." description="Pour les structures qui travaillent à plusieurs, les accès différenciés permettent d'organiser les tâches sans donner à chacun le contrôle de tout le compte." /><p className="mt-6 text-sm leading-7 text-[#6F756D]">En Pro, les rôles prévus incluent la direction, la réception, la comptabilité et l'entretien. Enterprise pourra proposer des circuits d'autorisation adaptés aux groupes.</p><div className="mt-6 flex items-start gap-3 rounded-xl bg-[#EFF3ED] p-4 text-xs leading-6 text-[#284C3B]"><LockKeyhole size={19} className="mt-0.5 shrink-0"/>Les permissions devront être contrôlées côté serveur lors de l'intégration backend.</div></div><div className="overflow-hidden rounded-[24px] border border-[#E9E2D5] bg-[#F7F5EF]"><div className="flex items-center gap-3 border-b border-[#E9E2D5] bg-white px-6 py-5"><Users size={21} className="text-[#284C3B]"/><h3 className="font-semibold">Exemples de rôles</h3></div>{[['Propriétaire', 'Compte et supervision générale'], ['Directeur', 'Gestion des opérations et de l’équipe'], ['Réceptionniste', 'Réservations, arrivées et départs'], ['Comptable', 'Paiements et rapports'], ['Agent d’entretien', 'Préparation des chambres']].map(([role, detail]) => <div key={role} className="border-b border-[#E9E2D5] px-6 py-4 last:border-0"><p className="text-sm font-semibold">{role}</p><p className="mt-1 text-xs text-[#6F756D]">{detail}</p></div>)}</div></div></section>

      <section className="border-y border-[#E9E2D5] bg-[#F7F5EF] py-20 lg:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Heading eyebrow="Votre parcours" title="Démarrer simplement, évoluer à votre rythme." description="Un parcours guidé pour créer votre espace, renseigner votre activité et préparer votre établissement." center /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        {icon: KeyRound, n:'01', title:'Votre compte', detail:'Connectez-vous ou créez votre compte TerangaSN.'},
        {icon: BriefcaseBusiness, n:'02', title:'Votre rôle', detail:'Indiquez votre statut de propriétaire, gérant ou représentant.'},
        {icon: Building2, n:'03', title:'Votre établissement', detail:'Renseignez les informations de votre hébergement.'},
        {icon: ShieldCheck, n:'04', title:'Votre préparation', detail:'Complétez les éléments nécessaires avant publication.'},
      ].map(({icon: Icon, n, title, detail}) => <div key={n} className="rounded-[20px] border border-[#E9E2D5] bg-white p-6"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF3ED] text-[#284C3B]"><Icon size={21}/></span><span className="font-serif text-3xl text-[#D4CCBB]">{n}</span></div><h3 className="mt-6 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#6F756D]">{detail}</p></div>)}</div><div className="mt-9 text-center"><button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-[#284C3B] px-7 py-3.5 text-sm font-semibold text-white hover:bg-[#1B382D]">Commencer mon inscription <ArrowRight size={17}/></button></div></div></section>

      <section className="bg-white py-20 lg:py-24"><div className="mx-auto max-w-4xl px-5 sm:px-8"><Heading eyebrow="Questions fréquentes" title="Les réponses avant de commencer." center /><div className="mt-10 divide-y divide-[#E9E2D5] border-y border-[#E9E2D5]">{faq.map(([question, answer], i) => <div key={question}><button type="button" aria-expanded={openFAQ === i} onClick={() => setOpenFAQ(openFAQ === i ? null : i)} className="flex w-full items-center justify-between gap-5 py-5 text-left text-sm font-semibold sm:text-base"><span>{question}</span><ChevronDown size={19} className={`shrink-0 text-[#284C3B] transition-transform ${openFAQ === i ? 'rotate-180' : ''}`}/></button>{openFAQ === i && <p className="max-w-3xl pb-6 pr-8 text-sm leading-7 text-[#6F756D]">{answer}</p>}</div>)}</div></div></section>

      <section className="bg-[#284C3B] py-16 text-white lg:py-20"><div className="mx-auto max-w-4xl px-5 text-center sm:px-8"><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D7C39D]">TerangaSN Manager</span><h2 className="mt-4 font-serif text-3xl font-medium leading-tight sm:text-5xl">Consacrez moins de temps à l'organisation.<br/>Plus de temps à l'accueil.</h2><p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/70">Commencez à préparer votre espace de gestion et faites évoluer vos outils au rythme de votre établissement.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-[#F7F5EF] px-7 py-3.5 text-sm font-semibold text-[#284C3B] hover:bg-white">{isAuthenticated ? 'Continuer vers mon espace hôte' : 'Créer mon espace hôte'} <ArrowRight size={17}/></button>{!isAuthenticated && <button type="button" onClick={onSignIn} className="rounded-xl border border-white/30 px-7 py-3.5 text-sm font-semibold hover:bg-white/10">J'ai déjà un compte</button>}</div></div></section>
    </div>
  );
};

export default BecomeHostPage;
