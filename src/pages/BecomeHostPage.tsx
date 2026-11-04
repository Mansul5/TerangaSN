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

type ComparisonRow = { name: string; standard: PlanValue; business: PlanValue; enterprise: PlanValue };

type ComparisonGroup = { title: string; rows: ComparisonRow[] };

const BUSINESS_PRICE_TTC = 39900;

const STANDARD_COMMISSION = 0.12;

const money = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} F CFA`;

const C = {

  forest: '#193e30', deep: '#10281f', cream: '#f8f7f3', sand: '#e8e5dc',

  gold: '#a1845f', ink: '#26342c', muted: '#68756d', light: '#f2f5f0',

};



const comparison: ComparisonGroup[] = [

  { title: 'Tarification et distribution', rows: [

    { name: 'Abonnement mensuel TTC', standard: '0 F CFA', business: '39 900 F CFA', enterprise: 'Sur devis' },

    { name: 'Commission sur les réservations marketplace éligibles', standard: '12 % TTC', business: '0 %', enterprise: 'Négociée' },

    { name: 'Réservations via un lien direct attribué à l’établissement', standard: '0 %*', business: '0 %*', enterprise: '0 %*' },

    { name: 'Réservations saisies manuellement', standard: '0 %', business: '0 %', enterprise: '0 %' },

    { name: 'Visibilité sur la marketplace TerangaSN', standard: true, business: true, enterprise: 'Selon contrat' },

  ] },

  { title: 'Gestion quotidienne', rows: [

    { name: 'Établissements autorisés', standard: '1', business: 'Jusqu’à 3', enterprise: 'Sur mesure' },

    { name: 'Chambres, unités et offres', standard: 'Illimitées*', business: 'Illimitées*', enterprise: 'Selon contrat' },

    { name: 'Réservations manuelles', standard: 'Illimitées*', business: 'Illimitées*', enterprise: 'Selon contrat' },

    { name: 'Calendrier et disponibilités', standard: true, business: true, enterprise: true },

    { name: 'Suivi des arrivées et départs', standard: true, business: true, enterprise: true },

    { name: 'Gestion du ménage', standard: 'Statut des chambres et liste des ménages', business: 'Tâches assignées, priorités et suivi', enterprise: 'Coordination des équipes multi-sites' },

    { name: 'Suivi des clients', standard: true, business: true, enterprise: true },

    { name: 'Acomptes et règlements', standard: true, business: true, enterprise: true },

  ] },

  { title: 'Équipe et organisation', rows: [

    { name: 'Accès collaborateurs', standard: 'Propriétaire seul', business: 'Jusqu’à 5', enterprise: 'Sur mesure' },

    { name: 'Rôles et permissions', standard: 'Accès principal', business: 'Rôles prédéfinis', enterprise: 'Personnalisés' },

    { name: 'Vue multi-établissements', standard: false, business: true, enterprise: 'Consolidée' },

    { name: 'Formation et déploiement', standard: 'Documentation', business: 'Accompagnement prioritaire', enterprise: 'Personnalisés' },

  ] },

  { title: 'Croissance, données et assistance', rows: [

    { name: 'Site vitrine partageable', standard: 'Modèle fixe, photos et descriptifs modifiables', business: 'Couleurs, galeries et sections personnalisables', enterprise: 'Identité et vitrines multi-établissements' },

    { name: 'Lien de réservation directe', standard: true, business: true, enterprise: true },

    { name: 'Promotions', standard: 'Tarifs réduits sur une période', business: 'Codes, longs séjours et offres programmées', enterprise: 'Campagnes coordonnées multi-sites' },

    { name: 'Statistiques', standard: 'Essentielles', business: 'Avancées', enterprise: 'Consolidées' },

    { name: 'Exports CSV, Excel et PDF', standard: true, business: true, enterprise: true },

    { name: 'Automatisations', standard: 'Calculs et indicateurs automatiques', business: 'Tâches de ménage et rappels internes', enterprise: 'Règles et rapports programmés sur mesure' },

    { name: 'Assistance', standard: 'Standard', business: 'Prioritaire', enterprise: 'Dédiée selon contrat' },

    { name: 'Intégrations / API spécifiques', standard: false, business: 'Selon disponibilité', enterprise: 'Selon faisabilité et contrat' },

  ] },

];



const faq = [

  ['Puis-je commencer gratuitement ?', 'Oui. Standard ne comporte aucun abonnement mensuel. Une commission de 12 % TTC est prévue uniquement sur les réservations marketplace éligibles apportées par TerangaSN.'],

  ['Dois-je utiliser TerangaSN pour utiliser Manager ?', 'Non. Manager est pensé comme un logiciel de gestion autonome : vous pouvez saisir vos réservations reçues par téléphone, WhatsApp, à la réception ou depuis d’autres plateformes.'],

  ['Pourquoi 0 % via mon lien si la réservation se fait sur TerangaSN ?', 'Le logiciel qui enregistre la réservation et le canal qui a amené le client sont deux choses différentes. Une réservation attribuée à votre lien personnel peut être traitée sur TerangaSN sans commission : c’est vous qui avez apporté le client. En Standard, les 12 % TTC concernent uniquement les réservations éligibles apportées par la recherche publique TerangaSN. Les règles d’attribution et de prévention des abus seront précisées avant le lancement.'],

  ['Que comprend la gestion du ménage ?', 'Standard prévoit le statut des chambres (à nettoyer, en cours, prête) et une liste de tâches. Business ajoute l’attribution aux employés, les priorités et le suivi. Enterprise prévoit la coordination de plusieurs sites. Ces modules seront déployés progressivement.'],

  ['Que signifie automatisations ?', 'Ce sont des opérations déclenchées par le logiciel : calcul des nuitées et indicateurs en Standard, tâches de ménage et rappels internes en Business, règles et rapports sur mesure en Enterprise. Cela ne promet ni intelligence artificielle, ni messages WhatsApp automatiques, ni synchronisation Booking.com/Airbnb.'],

  ['Quelle différence entre les vitrines Standard et Business ?', 'Standard permet de renseigner les photos, chambres, prix, équipements et coordonnées dans une présentation fixe. Business prévoit davantage de choix de couleurs, galeries et sections. Dans les deux cas, les réservations directes attribuées au lien restent à 0 % de commission TerangaSN.'],

  ['Quelles promotions puis-je créer ?', 'Standard prévoit des réductions simples sur une période. Business prévoit des codes promotionnels, des offres pour longs séjours et des campagnes programmées. Enterprise pourra coordonner les offres de plusieurs établissements. Ces possibilités seront livrées progressivement.'],

  ['Pourquoi choisir Business ?', 'Business supprime la commission marketplace TerangaSN et ajoute notamment la gestion de trois établissements, cinq collaborateurs, des permissions, des statistiques avancées et une vitrine plus personnalisable.'],

  ['Quand Business devient-il financièrement intéressant ?', 'Avec les tarifs envisagés, le point d’équilibre est atteint à 332 500 F CFA de réservations marketplace éligibles par mois. Les réservations directes sont exclues de ce calcul. Le seuil dépend uniquement des réservations marketplace éligibles.'],

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

  <div className="boly-card-interactive rounded-[22px] border border-[#e8e5dc] bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-[#193e30]/5">

    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f5f0] text-[#193e30]"><Icon size={21} strokeWidth={1.8} /></span>

    <h3 className="mt-5 text-[16px] font-semibold" style={{ color: C.ink }}>{title}</h3>

    <p className="mt-2 text-sm leading-6" style={{ color: C.muted }}>{description}</p>

  </div>

);



export const BecomeHostPage: React.FC<BecomeHostPageProps> = ({ isAuthenticated, onStart, onSignIn }) => {

  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  const [bookingVolume, setBookingVolume] = useState(350000);

  const standardCost = bookingVolume * STANDARD_COMMISSION;

  const savings = standardCost - BUSINESS_PRICE_TTC;

  const threshold = BUSINESS_PRICE_TTC / STANDARD_COMMISSION;




  return (

    <div className="boly-page min-w-0 overflow-x-clip bg-[#f8f7f3] text-[#26342c]">

      <div className="border-b border-[#e8e5dc] bg-white/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#193e30] font-serif text-xs font-bold text-white">TSN</span><div><p className="text-sm font-bold tracking-tight text-[#193e30]">TerangaSN</p><p className="text-[10px] text-[#68756d]">Solutions pour les hébergeurs</p></div></div>
          <nav aria-label="Navigation de la présentation hôte" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[#193e30]">
            <a href="#manager-features" className="hover:underline">Fonctionnalités</a>
            <a href="#host-pricing" className="hover:underline">Formules</a>
            <a href="#host-faq" className="hover:underline">Questions</a>
          </nav>
        </div>
      </div>

      {/* INTRODUCTION : LES BÉNÉFICES AVANT LES OFFRES */}

      <section className="relative isolate overflow-hidden bg-[#193e30] text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Cap-Skirring-Beach-2007.jpg" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-center opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#10281f]/95 via-[#10281f]/85 to-[#10281f]/65" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10281f]/60 via-transparent to-transparent" />
        </div>
        <div className="boly-container relative z-10 grid gap-12 py-16 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:items-center lg:gap-16 lg:py-24">

          <div>

            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-[#e8e5dc]"><span className="h-1.5 w-1.5 rounded-full bg-[#e5cba7]" /> BOLY · ESPACE HÔTE</span>

            <h1 className="mt-8 max-w-2xl font-serif text-[clamp(2.8rem,5.4vw,4.6rem)] font-medium leading-[1.08] tracking-[-0.035em]">

              Votre établissement.<br /><span className="text-[#F0D9B3]">Toute votre activité.</span><br />Un seul espace.

            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-white/75 sm:text-lg">Des réservations à l'accueil des voyageurs, simplifiez votre quotidien. Retrouvez vos chambres, votre calendrier, vos clients et vos paiements dans un outil pensé pour les professionnels de l'hébergement.</p>

            <div className="mt-9 flex flex-wrap items-center gap-3">

              <button type="button" onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f2e7d4] px-6 py-3.5 text-sm font-bold text-[#193e30] transition hover:bg-white">Créer mon espace hôte <ArrowRight size={17} /></button>

              <button type="button" onClick={() => document.getElementById('manager-features')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">Découvrir Manager <ArrowRight size={16} /></button>

            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/75">

              {['Vos réservations au même endroit', 'Un calendrier plus clair', 'Une gestion accessible partout'].map((item) => <span key={item} className="flex items-center gap-2"><Check size={15} className="text-[#e5cba7]" />{item}</span>)}

            </div>

            {!isAuthenticated && <button type="button" onClick={onSignIn} className="mt-7 text-xs font-medium text-white/75 underline underline-offset-4 hover:text-white">Vous avez déjà un compte ? Connectez-vous</button>}

          </div>

            {/* Aperçu fidèle aux rubriques du tableau de bord en cours de développement. */}

            <div className="relative mx-auto w-full max-w-[540px]">

              <div className="absolute -inset-5 rounded-[36px] border border-white/10 bg-white/5" />

              <div className="relative overflow-hidden rounded-[25px] border border-white/20 bg-[#f8f7f3] p-3 text-[#26342c] shadow-2xl shadow-black/20 sm:p-4">

                <div className="flex items-center justify-between border-b border-[#e8e5dc] pb-3">

                  <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#193e30] text-white"><LayoutDashboard size={18}/></span><div><p className="text-[9px] font-bold uppercase tracking-wider text-[#68756d]">TerangaSN Manager</p><h3 className="text-sm font-semibold">Vue d'ensemble</h3></div></div>

                  <span className="rounded-full bg-[#f2f5f0] px-2 py-1 text-[9px] font-semibold text-[#193e30]">Démonstration</span>

                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] text-[#68756d]">

                  {['Établissements', 'Réservations', 'Clients', 'Chambres & offres', 'Calendrier', 'Finances'].map((label) => <span key={label} className="rounded-md border border-[#e8e5dc] bg-white px-2 py-1.5">{label}</span>)}

                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">

                  {[{label:'Réservations',value:'12',icon:CalendarDays},{label:'Revenus enregistrés',value:'850 k',icon:Wallet},{label:'À venir',value:'240 k',icon:Clock3},{label:'Nuitées',value:'38',icon:BedDouble}].map(({label,value,icon:Icon}) => <div key={label} className="rounded-xl border border-[#e8e5dc] bg-white p-3"><Icon size={15} className="text-[#193e30]"/><p className="mt-2 text-lg font-semibold">{value}</p><p className="mt-1 text-[9px] leading-3 text-[#68756d]">{label}</p></div>)}

                </div>

                <div className="mt-3 rounded-xl border border-[#e8e5dc] bg-white p-3">

                  <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">Réservations récentes</p><span className="text-[9px] text-[#68756d]">Exemple fictif</span></div>

                  {[['Studio Confort','12–15 oct.','Confirmée'],['Suite familiale','17–20 oct.','En attente'],['Chambre 103','22–24 oct.','Confirmée']].map(([room,dates,status]) => <div key={room} className="mt-2 flex items-center justify-between gap-2 border-t border-[#e8e5dc] pt-2 text-[10px]"><div><p className="font-medium">{room}</p><p className="text-[#68756d]">{dates}</p></div><span className={status === 'Confirmée' ? 'rounded-full bg-[#f2f5f0] px-2 py-1 text-[#193e30]' : 'rounded-full bg-[#f2e7d4] px-2 py-1 text-[#806747]'}>{status}</span></div>)}

                </div>

                <p className="mt-3 text-center text-[9px] leading-4 text-[#68756d]">Aperçu non interactif inspiré des rubriques du tableau de bord réel. Chiffres fictifs.</p>

              </div>

            </div>

        </div>
        <p className="relative z-10 pb-3 text-center text-[10px] text-white/60">Photographie d’illustration : Cap Skirring · Bjørn Christian Tørrissen · Wikimedia Commons · CC BY-SA 3.0</p>
      </section>

      <section className="border-b border-[#e8e5dc] bg-white py-8"><div className="mx-auto max-w-7xl px-5 sm:px-8"><p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#68756d]">Pensé pour tous les types d'hébergements</p><div className="mt-5 flex flex-wrap justify-center gap-2">{['Hôtels', 'Résidences', 'Villas', 'Appartements', 'Lodges', 'Campements', 'Chambres d’hôtes'].map((type) => <span key={type} className="rounded-full border border-[#e8e5dc] bg-[#f8f7f3] px-4 py-2 text-xs font-medium text-[#4e5c52]">{type}</span>)}</div></div></section>



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

          ].map(([n, title, detail]) => <div key={n} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2f5f0] text-xs font-bold text-[#193e30]">{n}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#68756d]">{detail}</p></div></div>)}</div>

          <p className="mt-8 rounded-xl border border-[#e8e5dc] bg-[#f8f7f3] p-4 text-xs leading-6 text-[#68756d]">Les réservations externes sont saisies manuellement dans la première version. La synchronisation automatique avec Airbnb ou Booking.com n'est pas incluse dans le MVP.</p>

        </div>

        <div className="rounded-[28px] bg-[#193e30] p-6 text-white sm:p-9"><p className="text-xs font-semibold uppercase tracking-widest text-[#e5cba7]">Une journée mieux organisée</p><h3 className="mt-3 font-serif text-3xl">Un accueil plus serein.</h3><div className="mt-8 space-y-3">{[

          {icon: Clock3, title: '09:00 · Préparer les départs', desc: 'Consultez les séjours qui se terminent.'},

          {icon: BedDouble, title: '11:00 · Vérifier les chambres', desc: 'Repérez les unités à préparer.'},

          {icon: MessageCircle, title: '14:00 · Ajouter une réservation', desc: 'Une demande reçue par téléphone.'},

          {icon: CheckCircle2, title: '16:00 · Accueillir les arrivées', desc: 'Retrouvez les informations du séjour.'},

        ].map(({icon: Icon, title, desc}) => <div key={title} className="flex items-start gap-4 rounded-2xl border border-white/15 bg-white/10 p-4"><span className="rounded-xl bg-white/10 p-2.5"><Icon size={19} className="text-[#F0D9B3]" /></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-white/65">{desc}</p></div></div>)}</div><p className="mt-5 text-xs text-white/50">Scénario illustratif du fonctionnement prévu.</p></div>

      </div></section>



      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">

        <div><Heading eyebrow="Votre vitrine, votre relation client" title="Un lien de réservation à votre image." description="Présentez votre établissement avec ses photos, ses chambres et ses tarifs. Partagez votre vitrine avec vos clients habituels, sur WhatsApp ou sur vos réseaux sociaux." />

          <div className="mt-7 space-y-4">{[

            'Une page dédiée à votre établissement',

            'Un lien direct facile à partager',

            '0 % de commission sur les réservations attribuées à votre lien direct',

            'Une présentation essentielle, enrichie avec les options avancées',

          ].map((line) => <p key={line} className="flex items-start gap-3 text-sm leading-6"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#193e30]" />{line}</p>)}</div>

          <p className="mt-6 text-xs leading-6 text-[#68756d]">La vitrine et ses possibilités de personnalisation seront déployées progressivement. La réservation peut se faire sur TerangaSN : c’est l’origine du client qui détermine la commission. Les règles d’attribution seront précisées dans les conditions commerciales.</p>

        </div>

        <div className="overflow-hidden rounded-[26px] border border-[#e8e5dc] bg-white p-4 shadow-xl shadow-[#193e30]/5 sm:p-6">

          <div className="flex items-center gap-2 border-b border-[#e8e5dc] pb-4 text-xs text-[#68756d]">

            <Globe2 size={16} className="shrink-0 text-[#193e30]" />

            <span className="min-w-0 flex-1 truncate">TerangaSN · exemple de vitrine / les-palmiers</span>

            <span className="rounded-full bg-[#f2f5f0] px-2.5 py-1 text-[10px] font-semibold text-[#193e30]">Aperçu</span>

          </div>



          {/* Maquette illustrative d'une véritable fiche établissement. */}

          <div className="mt-4 grid grid-cols-3 gap-2">

            <div className="relative col-span-2 row-span-2 flex min-h-[188px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#B9C8B8] via-[#DCE6D7] to-[#e8e5dc] sm:min-h-[224px]">

              <div className="text-center text-[#193e30]"><Building2 size={43} className="mx-auto"/><p className="mt-3 px-2 text-[11px] font-medium">Photo principale</p></div>

              <span className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-[#193e30]">1 / 8 photos</span>

            </div>

            <div className="flex min-h-[90px] items-center justify-center rounded-xl bg-[#e8e5dc] text-center text-[10px] text-[#68756d] sm:min-h-[108px]">Chambre & suite</div>

            <div className="flex min-h-[90px] items-center justify-center rounded-xl bg-[#DCE6D7] text-center text-[10px] text-[#193e30] sm:min-h-[108px]">Piscine & espaces</div>

          </div>



          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">

            <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a1845f]">Résidence · Séjour & détente</p><h3 className="mt-1 font-serif text-2xl font-semibold">Résidence Les Palmiers</h3><p className="mt-1 text-xs text-[#68756d]">Saly, Petite Côte · Sénégal</p></div>

            <div className="rounded-xl bg-[#f2f5f0] px-3 py-2 text-center"><p className="text-sm font-bold text-[#193e30]">4,8 / 5</p><p className="text-[10px] text-[#68756d]">Note fictive</p></div>

          </div>



          <p className="mt-4 text-xs leading-6 text-[#68756d]">Une résidence paisible à proximité des plages, avec des espaces lumineux et des logements pensés pour les séjours en couple, en famille ou entre amis.</p>

          <div className="mt-4 flex flex-wrap gap-2">{['Wi-Fi', 'Piscine', 'Parking', 'Climatisation', 'Cuisine équipée'].map((t) => <span key={t} className="rounded-full bg-[#f8f7f3] px-3 py-1.5 text-[11px] text-[#26342c]">{t}</span>)}</div>



          <div className="mt-5 border-t border-[#e8e5dc] pt-5">

            <div className="flex items-center justify-between gap-3"><h4 className="font-serif text-lg font-semibold">Choisissez votre hébergement</h4><span className="text-[10px] text-[#68756d]">Tarifs indicatifs TTC</span></div>

            <div className="mt-3 space-y-3">

              {[

                { name: 'Studio Confort', detail: '2 voyageurs · 1 grand lit · 28 m²', price: '35 000 F CFA', tag: 'Idéal en couple' },

                { name: 'Suite familiale', detail: '4 voyageurs · 2 chambres · 55 m²', price: '65 000 F CFA', tag: 'Pour les familles' },

              ].map((room) => <div key={room.name} className="flex flex-col gap-3 rounded-xl border border-[#e8e5dc] p-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="min-w-0"><p className="text-sm font-semibold">{room.name}</p><p className="mt-1 text-[11px] text-[#68756d]">{room.detail}</p><p className="mt-2 text-[10px] font-medium text-[#193e30]">{room.tag}</p></div>

                <div className="shrink-0 sm:text-right"><p className="text-sm font-bold text-[#193e30]">{room.price}</p><p className="text-[10px] text-[#68756d]">par nuit</p></div>

              </div>)}

            </div>

          </div>



          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[#f8f7f3] p-4 text-[11px]">

            <div><p className="font-semibold text-[#26342c]">Arrivée</p><p className="mt-1 text-[#68756d]">À partir de 15 h</p></div>

            <div><p className="font-semibold text-[#26342c]">Départ</p><p className="mt-1 text-[#68756d]">Avant 11 h</p></div>

            <div><p className="font-semibold text-[#26342c]">Annulation</p><p className="mt-1 text-[#68756d]">Selon les conditions du séjour</p></div>

            <div><p className="font-semibold text-[#26342c]">Contact</p><p className="mt-1 text-[#68756d]">Messagerie de l'établissement</p></div>

          </div>



          <div className="mt-5 rounded-xl bg-[#193e30] py-3.5 text-center text-sm font-semibold text-white">Voir les disponibilités et réserver</div>

          <p className="mt-3 text-center text-[10px] leading-5 text-[#68756d]">Exemple fictif non interactif · Photos, tarifs, avis et informations présentés à titre d'illustration</p>

        </div>

      </section>



      {/* Les offres précèdent volontairement le comparatif détaillé. */}

      <section id="host-pricing" className="scroll-mt-20 border-y border-[#e8e5dc] bg-[#f8f7f3] py-20 lg:py-24">

        <div className="mx-auto max-w-7xl px-5 sm:px-8">

          <Heading eyebrow="Des formules adaptées à votre activité" title="Une gestion professionnelle, à votre rythme." description="Commencez avec les outils essentiels, développez votre activité avec Business ou construisez une solution adaptée à votre groupe avec Enterprise." center />

          <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-3 text-center text-xs font-semibold text-[#193e30]">
            <span className="rounded-full border border-[#dfe7dd] bg-white px-4 py-2">0 % sur les réservations directes, quelle que soit la formule</span>
            <span className="rounded-full border border-[#dfe7dd] bg-white px-4 py-2">Business rentable dès {money(threshold)} de réservations marketplace / mois</span>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3 lg:items-stretch">

            <article className="flex flex-col rounded-[26px] border border-[#e8e5dc] bg-white p-7 shadow-sm">

              <p className="text-[11px] font-bold uppercase tracking-widest text-[#68756d]">Pour démarrer</p>

              <h3 className="mt-3 font-serif text-3xl font-semibold">Standard</h3>

              <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#68756d]">La gestion quotidienne, sans abonnement mensuel.</p>

              <p className="mt-6 text-4xl font-semibold">0 F CFA <span className="text-xs font-normal text-[#68756d]">TTC / mois</span></p>

              <div className="mt-5 rounded-xl bg-[#f8f7f3] p-4"><p className="text-xl font-semibold">12 % TTC</p><p className="mt-1 text-xs text-[#68756d]">Sur les réservations marketplace éligibles uniquement</p></div>

              <ul className="mt-6 flex-1 space-y-3">{['1 établissement','Calendrier, chambres et réservations manuelles','Clients, paiements et exports','Vitrine essentielle et lien direct à 0 %','Suivi simple du ménage et promotions'].map(item => <li key={item} className="flex gap-2 text-sm leading-6"><Check size={17} className="mt-1 shrink-0 text-[#193e30]"/>{item}</li>)}</ul>

              <button type="button" onClick={onStart} className="mt-8 rounded-xl border border-[#193e30] px-5 py-3.5 text-sm font-semibold text-[#193e30] transition hover:bg-[#f2f5f0]">Créer mon espace</button>

            </article>

            <article className="relative flex flex-col rounded-[26px] border-2 border-[#193e30] bg-[#f2f5f0] p-7 shadow-lg shadow-[#193e30]/10">

              <span className="absolute -top-3 right-6 rounded-full bg-[#193e30] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">Pour aller plus loin</span>

              <p className="text-[11px] font-bold uppercase tracking-widest text-[#193e30]">Pour les professionnels en croissance</p>

              <h3 className="mt-3 font-serif text-3xl font-semibold">Business</h3>

              <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#68756d]">Plus d'autonomie, plus de collaboration et zéro commission marketplace.</p>

              <p className="mt-6 text-4xl font-semibold text-[#193e30]">39 900 F <span className="text-xs font-normal text-[#68756d]">CFA TTC / mois</span></p>

              <div className="mt-5 rounded-xl border border-[#dfe7dd] bg-white p-4"><p className="text-2xl font-semibold text-[#193e30]">0 %</p><p className="mt-1 text-xs text-[#68756d]">Commission TerangaSN sur les réservations marketplace</p></div>

              <ul className="mt-6 flex-1 space-y-3">{['Tout Standard inclus','Jusqu’à 3 établissements et 5 collaborateurs','Rôles et permissions','Statistiques, ménage et promotions avancés','Vitrine personnalisable et assistance prioritaire'].map(item => <li key={item} className="flex gap-2 text-sm leading-6"><Check size={17} className="mt-1 shrink-0 text-[#193e30]"/>{item}</li>)}</ul>

              <button type="button" onClick={onStart} className="mt-8 rounded-xl bg-[#193e30] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#10281f]">Créer mon espace</button>


            </article>

            <article className="flex flex-col rounded-[26px] bg-[#26342c] p-7 text-white shadow-sm">

              <div className="flex items-center gap-2 text-[#F0D9B3]"><BadgeCheck size={19}/><p className="text-[11px] font-bold uppercase tracking-widest">Statut spécial · Sur mesure</p></div>

              <h3 className="mt-3 font-serif text-3xl font-semibold">Enterprise</h3>

              <p className="mt-2 min-h-[48px] text-sm leading-6 text-white/70">Pour les groupes hôteliers et organisations complexes.</p>

              <p className="mt-6 text-3xl font-semibold">Sur devis</p>

              <div className="mt-5 rounded-xl border border-white/15 bg-white/10 p-4"><p className="text-lg font-semibold">Conditions négociées</p><p className="mt-1 text-xs text-white/70">Tarification, commissions et accompagnement selon contrat</p></div>

              <ul className="mt-6 flex-1 space-y-3">{['Nombre d’établissements sur mesure','Organisation multi-sites et rôles personnalisés','Rapports consolidés et campagnes coordonnées','Formation, déploiement et assistance dédiés','Intégrations étudiées selon faisabilité'].map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-white/85"><Check size={17} className="mt-1 shrink-0 text-[#F0D9B3]"/>{item}</li>)}</ul>

              <div className="mt-8 rounded-xl border border-[#a1845f]/60 bg-white/5 px-5 py-3.5 text-center text-sm font-semibold text-[#F0D9B3]" aria-label="Offre Enterprise disponible sur devis et contrat">Sur devis et contrat</div>

            </article>

          </div>

          <p className="mx-auto mt-7 max-w-4xl text-center text-xs leading-6 text-[#68756d]">Tarifs TTC et fonctionnalités envisagés, sous réserve de validation commerciale et fiscale. Le 0 % sur les réservations directes suppose une attribution vérifiée au lien de l’établissement. Les frais éventuels des prestataires de paiement sont distincts. Les fonctions avancées seront déployées progressivement.</p>

        </div>

      </section>



      <section className="bg-white py-20 lg:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Heading eyebrow="Comparaison détaillée" title="Des différences claires, au-delà du prix." description="Comparez les conditions financières, les opérations quotidiennes, le travail en équipe et les possibilités de croissance." center />

        <div className="mt-10 overflow-x-auto rounded-[20px] border border-[#e8e5dc]"><table className="w-full min-w-[760px] border-collapse text-left text-[13px]"><thead><tr className="bg-[#f8f7f3]"><th className="w-[34%] px-5 py-5 font-semibold">Fonctionnalité</th><th className="w-[22%] px-4 py-5 font-semibold">Standard</th><th className="w-[22%] bg-[#f2f5f0] px-4 py-5 font-semibold text-[#193e30]">Business</th><th className="w-[22%] px-4 py-5 font-semibold">Enterprise</th></tr></thead><tbody>{comparison.map((group) => <React.Fragment key={group.title}><tr><th colSpan={4} className="bg-[#e8e5dc]/55 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-[#193e30]">{group.title}</th></tr>{group.rows.map((r, i) => <tr key={r.name} className={`border-t border-[#e8e5dc] ${i % 2 ? 'bg-[#faf9f6]' : 'bg-white'}`}><th className="px-5 py-4 font-medium">{r.name}</th><td className="px-4 py-4 text-[#68756d]"><Feature value={r.standard}/></td><td className="bg-[#f2f5f0]/60 px-4 py-4 font-semibold text-[#193e30]"><Feature value={r.business}/></td><td className="px-4 py-4 text-[#68756d]"><Feature value={r.enterprise}/></td></tr>)}</React.Fragment>)}</tbody></table></div><p className="mt-4 text-xs leading-6 text-[#68756d]">* Le taux direct de 0 % suppose une attribution vérifiée au lien de l’établissement, même si la réservation est finalisée sur TerangaSN. Les limites Business affichées sont de 3 établissements et 5 collaborateurs ; les fonctionnalités avancées sont déployées progressivement. La mention « inclus » décrit le périmètre envisagé, pas une garantie de disponibilité immédiate. Les quotas d’établissements sont contrôlés côté serveur. Les fonctionnalités annoncées comme futures seront déployées progressivement.</p>

      </div></section>



      <section className="bg-[#f8f7f3] py-20 lg:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Heading eyebrow="Simulateur de coûts TTC" title="À quel moment Business devient-il avantageux ?" description="Comparez les coûts à partir du montant mensuel des réservations éligibles apportées par TerangaSN. Les réservations directes ne sont pas prises en compte." center />

        <div className="mx-auto mt-10 max-w-4xl rounded-[24px] border border-[#e8e5dc] bg-white p-6 sm:p-9"><label htmlFor="host-booking-volume" className="text-sm font-semibold">Volume mensuel de réservations marketplace</label><p className="mt-3 font-serif text-3xl font-semibold text-[#193e30] sm:text-4xl">{money(bookingVolume)}</p><div className="mt-5 flex flex-wrap gap-2" aria-label="Exemples de volumes mensuels">
              {[150000, 332500, 500000, 1000000].map((volume) => <button key={volume} type="button" onClick={() => setBookingVolume(volume)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${bookingVolume === volume ? 'border-[#193e30] bg-[#193e30] text-white' : 'border-[#e8e5dc] bg-white text-[#193e30] hover:bg-[#f2f5f0]'}`}>{money(volume)}</button>)}
            </div><input id="host-booking-volume" type="range" min={0} max={5000000} step={25000} value={bookingVolume} onChange={(e) => setBookingVolume(Number(e.target.value))} className="mt-7 w-full accent-[#193e30]"/><div className="mt-2 flex justify-between text-xs text-[#68756d]"><span>0 F</span><span>5 000 000 F</span></div><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[#f8f7f3] p-5"><p className="text-sm text-[#68756d]">Standard · commission 12 %</p><p className="mt-3 text-2xl font-semibold">{money(standardCost)}</p><p className="mt-2 text-xs text-[#68756d]">Coût estimé pour le mois</p></div><div className="rounded-2xl bg-[#f2f5f0] p-5"><p className="text-sm text-[#193e30]">Business · commission 0 %</p><p className="mt-3 text-2xl font-semibold text-[#193e30]">{money(BUSINESS_PRICE_TTC)}</p><p className="mt-2 text-xs text-[#68756d]">Abonnement mensuel TTC</p></div></div><div className="mt-7 border-t border-[#e8e5dc] pt-6"><p className="text-sm text-[#68756d]">{savings > 0 ? 'Économie mensuelle estimée avec Business' : savings < 0 ? 'Surcoût mensuel estimé avec Business' : 'Coût identique'}</p><p className="mt-2 text-3xl font-semibold" style={{color: savings > 0 ? C.forest : C.ink}}>{money(Math.abs(savings))}</p><p className="mt-3 text-sm leading-6 text-[#68756d]">{savings > 0 ? `À volume constant, cela représente ${money(savings * 12)} d'économies estimées sur douze mois.` : 'À ce volume, Standard est moins coûteux. Business peut néanmoins répondre à des besoins de gestion avancée.'}</p></div><p className="mt-7 rounded-xl bg-[#f8f7f3] p-4 text-sm leading-6"><strong>Point d'équilibre : {money(threshold)} / mois.</strong> Au-delà, Business est moins coûteux sur ce seul critère, selon les tarifs envisagés.</p><p className="mt-5 text-xs leading-5 text-[#68756d]">Simulation indicative, hors frais éventuels de paiement, annulations et ajustements. Elle ne constitue pas un devis.</p></div>

      </div></section>



      <section className="bg-white py-20 lg:py-24"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20"><div><Heading eyebrow="Collaboration" title="Une équipe coordonnée, des responsabilités claires." description="Pour les structures qui travaillent à plusieurs, les accès différenciés permettent d'organiser les tâches sans donner à chacun le contrôle de tout le compte." /><p className="mt-6 text-sm leading-7 text-[#68756d]">En Business, les rôles prévus incluent la direction, la réception, la comptabilité et l'entretien. Enterprise pourra proposer des circuits d'autorisation adaptés aux groupes.</p><div className="mt-6 flex items-start gap-3 rounded-xl bg-[#f2f5f0] p-4 text-xs leading-6 text-[#193e30]"><LockKeyhole size={19} className="mt-0.5 shrink-0"/>Les permissions devront être contrôlées côté serveur lors de l'intégration backend.</div></div><div className="overflow-hidden rounded-[24px] border border-[#e8e5dc] bg-[#f8f7f3]"><div className="flex items-center gap-3 border-b border-[#e8e5dc] bg-white px-6 py-5"><Users size={21} className="text-[#193e30]"/><h3 className="font-semibold">Exemples de rôles</h3></div>{[['Propriétaire', 'Compte et supervision générale'], ['Directeur', 'Gestion des opérations et de l’équipe'], ['Réceptionniste', 'Réservations, arrivées et départs'], ['Comptable', 'Paiements et rapports'], ['Agent d’entretien', 'Préparation des chambres']].map(([role, detail]) => <div key={role} className="border-b border-[#e8e5dc] px-6 py-4 last:border-0"><p className="text-sm font-semibold">{role}</p><p className="mt-1 text-xs text-[#68756d]">{detail}</p></div>)}</div></div></section>



      <section className="border-y border-[#e8e5dc] bg-[#f8f7f3] py-20 lg:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Heading eyebrow="Votre parcours" title="Démarrer simplement, évoluer à votre rythme." description="Un parcours guidé pour créer votre espace, renseigner votre activité et préparer votre établissement." center /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[

        {icon: KeyRound, n:'01', title:'Votre compte', detail:'Connectez-vous ou créez votre compte TerangaSN.'},

        {icon: BriefcaseBusiness, n:'02', title:'Votre rôle', detail:'Indiquez votre statut de propriétaire, gérant ou représentant.'},

        {icon: Building2, n:'03', title:'Votre établissement', detail:'Renseignez les informations de votre hébergement.'},

        {icon: ShieldCheck, n:'04', title:'Votre préparation', detail:'Complétez les éléments nécessaires avant publication.'},

      ].map(({icon: Icon, n, title, detail}) => <div key={n} className="rounded-[20px] border border-[#e8e5dc] bg-white p-6"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f5f0] text-[#193e30]"><Icon size={21}/></span><span className="font-serif text-3xl text-[#d4c9b8]">{n}</span></div><h3 className="mt-6 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#68756d]">{detail}</p></div>)}</div><div className="mt-9 text-center"><button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-[#193e30] px-7 py-3.5 text-sm font-semibold text-white hover:bg-[#10281f]">Commencer mon inscription <ArrowRight size={17}/></button></div></div></section>



      <section id="host-faq" className="scroll-mt-20 bg-white py-20 lg:py-24"><div className="mx-auto max-w-4xl px-5 sm:px-8"><Heading eyebrow="Questions fréquentes" title="Les réponses avant de commencer." center /><div className="mt-10 divide-y divide-[#e8e5dc] border-y border-[#e8e5dc]">{faq.map(([question, answer], i) => <div key={question}><button type="button" aria-expanded={openFAQ === i} onClick={() => setOpenFAQ(openFAQ === i ? null : i)} className="flex w-full items-center justify-between gap-5 py-5 text-left text-sm font-semibold sm:text-base"><span>{question}</span><ChevronDown size={19} className={`shrink-0 text-[#193e30] transition-transform ${openFAQ === i ? 'rotate-180' : ''}`}/></button>{openFAQ === i && <p className="max-w-3xl pb-6 pr-8 text-sm leading-7 text-[#68756d]">{answer}</p>}</div>)}</div></div></section>



      <section className="bg-[#193e30] py-16 text-white lg:py-20"><div className="mx-auto max-w-4xl px-5 text-center sm:px-8"><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e5cba7]">TerangaSN Manager</span><h2 className="mt-4 font-serif text-3xl font-medium leading-tight sm:text-5xl">Consacrez moins de temps à l'organisation.<br/>Plus de temps à l'accueil.</h2><p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/70">Créez votre espace, préparez votre établissement et gérez vos opérations depuis TerangaSN.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-[#f8f7f3] px-7 py-3.5 text-sm font-semibold text-[#193e30] hover:bg-white">{isAuthenticated ? 'Continuer vers mon espace hôte' : 'Créer mon espace hôte'} <ArrowRight size={17}/></button>{!isAuthenticated && <button type="button" onClick={onSignIn} className="rounded-xl border border-white/30 px-7 py-3.5 text-sm font-semibold hover:bg-white/10">J'ai déjà un compte</button>}</div></div></section>

    </div>

  );

};



export default BecomeHostPage;
