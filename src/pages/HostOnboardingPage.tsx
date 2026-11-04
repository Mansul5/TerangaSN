import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2,
  ChevronRight, Crown, Home, Hotel, Info, MapPin, Sparkles, LockKeyhole, KeyRound,
  ShieldCheck, UserRound, UsersRound, Wallet,
} from 'lucide-react';

export type HostRelationship = 'owner' | 'authorized_tenant' | 'mandate_manager' | 'company_representative' | 'family_representative' | 'estate_representative' | 'other';
export type HostOnboardingLodgingType =
  | 'hotel' | 'villa' | 'appartement' | 'residence'
  | 'lodge' | 'campement' | 'chambre_hotes';
export type HostOnboardingMode = 'first-host' | 'add-lodging';
export type HostPlan = 'standard' | 'pro'; // Identifiant technique historique ; libellé commercial : Business

export interface HostOnboardingData {
  firstName: string;
  lastName: string;
  phone: string;
  relationship: HostRelationship | '';
  companyName: string;
  position: string;
  lodgingType: HostOnboardingLodgingType | '';
  lodgingName: string;
  region: string;
  city: string;
  address: string;
  description: string;
  /** Plan requested during initial host activation. Billing is handled later. */
  selectedPlan?: HostPlan;
}

interface HostOnboardingPageProps {
  onBack: () => void;
  onComplete: (data: HostOnboardingData) => void;
  mode?: HostOnboardingMode;
  initialData?: Partial<HostOnboardingData>;
}

type StepKey = 'responsible' | 'relationship' | 'type' | 'lodging' | 'plan' | 'summary';
interface StepDefinition {
  key: StepKey;
  shortLabel: string;
  title: string;
  description: string;
}

const FIRST_HOST_STEPS: StepDefinition[] = [
  { key: 'responsible', shortLabel: 'Responsable', title: 'Parlez-nous de vous', description: 'Identifions la personne qui sera responsable de cet hébergement.' },
  { key: 'relationship', shortLabel: 'Relation', title: 'Quel est votre lien avec cet hébergement ?', description: 'Précisez votre situation pour cet établissement. Chaque établissement possède son propre dossier juridique.' },
  { key: 'type', shortLabel: 'Type', title: 'Quel type d’hébergement souhaitez-vous ajouter ?', description: 'Sélectionnez la catégorie qui décrit le mieux votre établissement.' },
  { key: 'lodging', shortLabel: 'Établissement', title: 'Présentez votre hébergement', description: 'Commençons par les informations essentielles. Vous configurerez ensuite les chambres, les photos et les tarifs.' },
  { key: 'plan', shortLabel: 'Formule', title: 'Votre formule TerangaSN', description: 'Découvrez les offres. La formule Business n’est pas activée par une simple sélection.' },
  { key: 'summary', shortLabel: 'Résumé', title: 'Vérifiez les informations', description: 'Relisez les informations avant de poursuivre vers votre espace hôte.' },
];

const ADD_LODGING_STEPS: StepDefinition[] = [
  FIRST_HOST_STEPS[1], FIRST_HOST_STEPS[2], FIRST_HOST_STEPS[3], FIRST_HOST_STEPS[5],
];

const REGIONS = [
  'Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou',
  'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou',
  'Tambacounda', 'Thiès', 'Ziguinchor',
];

const LODGING_TYPES: Array<{
  value: HostOnboardingLodgingType;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { value: 'hotel', label: 'Hôtel', description: 'Établissement avec plusieurs chambres ou catégories de chambres.', icon: Hotel },
  { value: 'villa', label: 'Villa', description: 'Villa entière ou propriété indépendante proposée aux voyageurs.', icon: Home },
  { value: 'appartement', label: 'Appartement', description: 'Appartement meublé pour les courts ou moyens séjours.', icon: Building2 },
  { value: 'residence', label: 'Résidence', description: 'Résidence avec studios, chambres ou appartements.', icon: Building2 },
  { value: 'lodge', label: 'Lodge', description: 'Hébergement touristique dans un cadre naturel.', icon: Home },
  { value: 'campement', label: 'Campement', description: 'Campement touristique ou hébergement en espaces indépendants.', icon: Home },
  { value: 'chambre_hotes', label: 'Chambre d’hôtes', description: 'Chambre proposée dans une maison ou propriété.', icon: UsersRound },
];

const EMPTY_FORM: HostOnboardingData = {
  firstName: '', lastName: '', phone: '', relationship: '',
  companyName: '', position: '', lodgingType: '', lodgingName: '',
  region: '', city: '', address: '', description: '', selectedPlan: 'standard',
};

const PLAN_DETAILS = {
  standard: {
    label: 'Standard', price: '0 F CFA TTC / mois', commission: '12 % TTC',
    description: 'Le logiciel essentiel, sans abonnement mensuel.',
    features: [
      '1 établissement maximum',
      'Chambres et réservations manuelles illimitées',
      'Calendrier, check-in, check-out et suivi des paiements',
      'Exports CSV, Excel et PDF gratuits',
      'Site vitrine essentiel et réservations directes sans commission',
    ],
  },
  pro: {
    label: 'Business', price: '39 900 F CFA TTC / mois', commission: '0 %',
    description: 'Plus de liberté et aucun pourcentage prélevé par TerangaSN sur les réservations marketplace éligibles.',
    features: [
      'Tout Standard inclus',
      'Jusqu’à 3 établissements',
      'Jusqu’à 5 collaborateurs et rôles prédéfinis',
      'Site vitrine personnalisable avancé',
      'Statistiques, promotions et assistance prioritaires',
    ],
  },
} as const;

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="space-y-2">
    <label className="block text-sm font-bold text-[#26342c]">{label}</label>
    {children}
    {hint && <p className="text-xs leading-relaxed text-[#68756d]">{hint}</p>}
  </div>
);

const inputClass = 'w-full rounded-xl border border-[#e8e5dc] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#9aa69d] focus:border-[#193e30] focus:ring-2 focus:ring-[#193e30]/10';

const InfoBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 rounded-2xl border border-[#dfe7dd] bg-[#f2f5f0] p-4">
    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#193e30]" />
    <p className="text-sm leading-relaxed text-[#68756d]">{children}</p>
  </div>
);

const ChoiceCard: React.FC<{
  selected: boolean; icon: React.ElementType; title: string;
  description: string; onClick: () => void;
}> = ({ selected, icon: Icon, title, description, onClick }) => (
  <button type="button" onClick={onClick} aria-pressed={selected}
    className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition ${selected ? 'border-[#193e30] bg-[#f2f5f0]' : 'border-[#e8e5dc] bg-white hover:border-[#a8bdab]'}`}>
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-[#193e30] text-white' : 'bg-[#f2f5f0] text-[#68756d]'}`}><Icon size={19} /></span>
    <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="mt-1 block text-xs leading-relaxed text-[#68756d] sm:text-sm">{description}</span></span>
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-[#193e30] bg-[#193e30] text-white' : 'border-[#e8e5dc] text-transparent'}`}><Check size={13} /></span>
  </button>
);

const SummarySection: React.FC<{ title: string; onEdit: () => void; children: React.ReactNode }> = ({ title, onEdit, children }) => (
  <div className="overflow-hidden rounded-2xl border border-[#e8e5dc]">
    <div className="flex items-center justify-between border-b border-[#e8e5dc] bg-[#f8f7f3] px-5 py-4">
      <h3 className="font-bold">{title}</h3>
      <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-bold text-[#193e30] hover:underline">Modifier <ChevronRight size={14} /></button>
    </div>
    <div className="divide-y divide-[#e8e5dc] px-5">{children}</div>
  </div>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-5">
    <span className="text-xs font-semibold text-[#68756d]">{label}</span>
    <span className="break-words text-sm font-medium text-[#26342c]">{value || '—'}</span>
  </div>
);

export const HostOnboardingPage: React.FC<HostOnboardingPageProps> = ({
  onBack, onComplete, mode = 'first-host', initialData,
}) => {
  const isFirstHost = mode === 'first-host';
  const steps = isFirstHost ? FIRST_HOST_STEPS : ADD_LODGING_STEPS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState<HostOnboardingData>({ ...EMPTY_FORM, ...initialData });
  const [submitting, setSubmitting] = useState(false);
  const [visited, setVisited] = useState<StepKey[]>([]);
  const currentStep = steps[currentIndex];
  const currentKey = currentStep.key;
  const stepIndex = (key: StepKey) => steps.findIndex((step) => step.key === key);
  const goToStep = (key: StepKey) => {
    const index = stepIndex(key);
    if (index >= 0) setCurrentIndex(index);
  };
  const updateField = <K extends keyof HostOnboardingData>(field: K, value: HostOnboardingData[K]) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const canContinue = useMemo(() => {
    switch (currentKey) {
      case 'responsible':
        return Boolean(formData.firstName.trim() && formData.lastName.trim() && formData.phone.trim());
      case 'relationship':
        return Boolean(formData.relationship && (formData.relationship !== 'company_representative' || (formData.companyName.trim() && formData.position.trim())));
      case 'type':
        return Boolean(formData.lodgingType);
      case 'lodging':
        return Boolean(formData.lodgingName.trim() && formData.region && formData.city.trim() && formData.address.trim());
      case 'plan':
        return formData.selectedPlan === 'standard' || formData.selectedPlan === 'pro';
      case 'summary':
        return true;
    }
  }, [currentKey, formData]);

  const handlePrevious = () => {
    if (currentIndex === 0) onBack();
    else setCurrentIndex((index) => index - 1);
  };

  const handleNext = () => {
    if (!canContinue || submitting) return;
    if (currentIndex < steps.length - 1) {
      setVisited(previous => previous.includes(currentKey) ? previous : [...previous, currentKey]);
      setCurrentIndex((index) => index + 1);
      return;
    }
    // The parent owns persistence and billing. Do not claim success here.
    setSubmitting(true);
    try {
      const result = { ...formData };
      if (!isFirstHost) delete result.selectedPlan;
      onComplete(result);
    } finally {
      setSubmitting(false);
    }
  };

  const relationshipLabels: Record<HostRelationship, string> = {
    owner: 'Propriétaire',
    authorized_tenant: 'Locataire autorisé',
    mandate_manager: 'Gestionnaire mandaté',
    company_representative: 'Représentant d’une société',
    family_representative: 'Représentant familial',
    estate_representative: 'Représentant d’une succession',
    other: 'Autre situation',
  };
  const relationshipLabel = formData.relationship
    ? relationshipLabels[formData.relationship]
    : 'Non renseigné';
  const lodgingTypeLabel = LODGING_TYPES.find((type) => type.value === formData.lodgingType)?.label || 'Non renseigné';
  const plan = formData.selectedPlan || 'standard';

  return (
    <div className="boly-page min-h-screen bg-[#f8f7f3] text-[#26342c]">
      <div className="boly-container pt-6 sm:pt-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={handlePrevious} className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-[#193e30] transition hover:bg-[#e9eee7]"><ArrowLeft size={17} /> Retour</button>
          <span className="inline-flex items-center gap-2 text-xs text-[#68756d]"><Info size={15} /> Informations modifiables avant publication</span>
        </div>
          <div className="relative overflow-hidden rounded-[28px] bg-[#193e30] px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
            <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full border border-white/10" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#e5cba7]"><Sparkles size={15} /> TerangaSN · Espace professionnel</span>
              <h1 className="mt-3 font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{isFirstHost ? 'Votre activité mérite un bel accueil.' : 'Un nouvel établissement, une nouvelle histoire.'}</h1>
              <p className="mt-3 text-sm leading-relaxed text-white/75 sm:text-base">{isFirstHost ? 'Créez votre espace hôte et préparez votre première adresse, à votre rythme.' : 'Préparez votre nouvelle fiche sans la rendre visible aux voyageurs.'}</p>
            </div>
          </div>
        </div>
        <div className="boly-container grid gap-6 py-6 sm:py-9 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-10">
        <aside>
          <div className="lg:sticky lg:top-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f2f5f0] px-3 py-1.5 text-xs font-bold text-[#193e30]"><Building2 size={14} /> {isFirstHost ? 'Création de l’espace hôte' : 'Nouvel hébergement'}</span>
            <p className="mt-4 text-sm leading-relaxed text-[#68756d]">{isFirstHost ? 'Configurez votre profil, votre premier établissement et votre formule.' : 'Ajoutez un hébergement à votre espace hôte existant.'}</p>
            <div className="mt-5 rounded-2xl border border-[#e8e5dc] bg-white p-4">
              <div className="flex items-center justify-between text-xs font-semibold"><span>Votre progression</span><span>{Math.round(((currentIndex + 1) / steps.length) * 100)} %</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8e5dc]"><div className="h-full rounded-full bg-[#a1845f] transition-all" style={{width: `${((currentIndex + 1) / steps.length) * 100}%`}} /></div>
              <p className="mt-3 text-xs leading-relaxed text-[#68756d]">{steps.length - currentIndex - 1 === 0 ? 'Dernière étape : vérification' : `${steps.length - currentIndex - 1} étape(s) après celle-ci`}</p>
            </div>
            <div className="mt-6 hidden space-y-2 lg:block">
              {steps.map((step, index) => {
                const completed = visited.includes(step.key) || index < currentIndex;
                const active = index === currentIndex;
                return (
                  <div key={step.key} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${active ? 'bg-white shadow-sm' : ''}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${completed ? 'bg-[#193e30] text-white' : active ? 'border-2 border-[#193e30] bg-white text-[#193e30]' : 'border border-[#e8e5dc] text-[#8c978e]'}`}>{completed ? <Check size={15} /> : index + 1}</span>
                    <span className={`text-sm ${active ? 'font-bold' : completed ? 'font-semibold text-[#5E5A51]' : 'text-[#8c978e]'}`}>{step.shortLabel}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 lg:hidden">
              <div className="flex justify-between text-xs font-semibold text-[#68756d]"><span>Étape {currentIndex + 1} sur {steps.length}</span><span>{currentStep.shortLabel}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8e5dc]"><div className="h-full rounded-full bg-[#193e30] transition-all" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }} /></div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-[#e8e5dc] bg-white shadow-sm sm:rounded-3xl">
            <div className="border-b border-[#e8e5dc] px-5 py-6 sm:px-9 sm:py-9">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#193e30]">Étape {currentIndex + 1}</p>
              <h1 className="mt-3 font-serif text-2xl font-bold leading-tight sm:text-3xl">{currentStep.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#68756d]">{currentStep.description}</p>
            </div>

            <div className="px-5 py-6 sm:px-9 sm:py-9">
              {currentKey === 'responsible' && (
                <div className="space-y-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Prénom"><input className={inputClass} value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} placeholder="Votre prénom" autoComplete="given-name" /></Field>
                    <Field label="Nom"><input className={inputClass} value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} placeholder="Votre nom" autoComplete="family-name" /></Field>
                  </div>
                  <Field label="Numéro de téléphone" hint="Ce numéro pourra servir aux communications importantes liées à votre activité."><input type="tel" className={inputClass} value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+221 77 000 00 00" autoComplete="tel" /></Field>
                  <InfoBox>Vous pourrez être amené à confirmer votre identité ou vos coordonnées. Aucun document d’identité n’est demandé à cette étape.</InfoBox>
                </div>
              )}

              {currentKey === 'relationship' && (
                <div className="space-y-4">
                  {([
                    { value: 'owner', icon: Home, title: 'Je suis propriétaire', description: 'Vous possédez légalement cet hébergement.' },
                    { value: 'authorized_tenant', icon: KeyRound, title: 'Je suis locataire autorisé', description: 'Vous louez le bien et disposez de l’autorisation nécessaire pour l’exploiter.' },
                    { value: 'mandate_manager', icon: UserRound, title: 'Je suis gestionnaire mandaté', description: 'Le propriétaire ou l’exploitant vous a confié la gestion par mandat.' },
                    { value: 'company_representative', icon: Building2, title: 'Je représente une société', description: 'Vous agissez au nom de la société qui exploite cet hébergement.' },
                    { value: 'family_representative', icon: UsersRound, title: 'Je représente un membre de ma famille', description: 'Vous êtes habilité à agir pour le compte d’un membre de votre famille.' },
                    { value: 'estate_representative', icon: ShieldCheck, title: 'Je représente une succession', description: 'Vous êtes habilité à gérer le bien dans le cadre d’une succession.' },
                    { value: 'other', icon: Info, title: 'Autre situation', description: 'Votre situation ne correspond pas aux profils précédents ; elle sera examinée avec vos justificatifs.' },
                  ] as const).map((item) => (
                    <ChoiceCard key={item.value} selected={formData.relationship === item.value} icon={item.icon} title={item.title} description={item.description} onClick={() => updateField('relationship', item.value)} />
                  ))}
                  {formData.relationship === 'company_representative' && (
                    <div className="grid gap-5 rounded-2xl border border-[#e8e5dc] bg-[#f8f7f3] p-5 sm:grid-cols-2">
                      <Field label="Nom de l’entreprise"><input className={inputClass} value={formData.companyName} onChange={(e) => updateField('companyName', e.target.value)} placeholder="Nom de la société" /></Field>
                      <Field label="Votre fonction"><input className={inputClass} value={formData.position} onChange={(e) => updateField('position', e.target.value)} placeholder="Ex. Directeur" /></Field>
                    </div>
                  )}
                  <InfoBox>Les justificatifs propres à cette situation seront demandés après la création de l’établissement. Leur dépôt et leur vérification sont nécessaires avant publication. L’administrateur seul décide de leur validation.</InfoBox>
                </div>
              )}

              {currentKey === 'type' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {LODGING_TYPES.map((type) => {
                    const Icon = type.icon;
                    const selected = formData.lodgingType === type.value;
                    return (
                      <button key={type.value} type="button" aria-pressed={selected} onClick={() => updateField('lodgingType', type.value)} className={`flex min-h-[150px] flex-col items-start rounded-2xl border p-5 text-left transition ${selected ? 'border-[#193e30] bg-[#f2f5f0] shadow-sm' : 'border-[#e8e5dc] hover:border-[#a8bdab]'}`}>
                        <span className="flex w-full justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-[#193e30] text-white' : 'bg-[#f2f5f0] text-[#68756d]'}`}><Icon size={19} /></span>{selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#193e30] text-white"><Check size={14} /></span>}</span>
                        <span className="mt-4 font-bold">{type.label}</span>
                        <span className="mt-2 text-xs leading-relaxed text-[#68756d]">{type.description}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentKey === 'lodging' && (
                <div className="space-y-6">
                  <Field label="Nom de l’hébergement"><input className={inputClass} value={formData.lodgingName} onChange={(e) => updateField('lodgingName', e.target.value)} placeholder="Ex. Villa Baobab" /></Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Région"><select className={inputClass} value={formData.region} onChange={(e) => updateField('region', e.target.value)}><option value="">Sélectionnez</option>{REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}</select></Field>
                    <Field label="Ville ou localité"><input className={inputClass} value={formData.city} onChange={(e) => updateField('city', e.target.value)} placeholder="Ex. Saly" /></Field>
                  </div>
                  <Field label="Adresse" hint="Vous pourrez préciser la position sur la carte lors de la configuration complète."><div className="relative"><MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c978e]" /><input className={`${inputClass} pl-11`} value={formData.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Adresse ou indication précise" /></div></Field>
                  <Field label="Description (facultatif)"><textarea rows={5} className={`${inputClass} resize-y`} value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Présentez brièvement votre hébergement..." /></Field>
                  <InfoBox>Cette étape crée uniquement la fiche initiale. Les photos, équipements, chambres, tarifs et disponibilités seront configurés dans l’espace hôte avant toute demande de publication.</InfoBox>
                </div>
              )}

              {currentKey === 'plan' && (
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    {(['standard', 'pro'] as const).map((key) => {
                      const detail = PLAN_DETAILS[key];
                      const selected = plan === key;
                      return (
                        <button key={key} type="button" aria-pressed={selected} onClick={() => updateField('selectedPlan', key)} className={`flex flex-col rounded-2xl border-2 p-5 text-left transition ${selected ? 'border-[#193e30] bg-[#f2f5f0]' : 'border-[#e8e5dc] bg-white hover:border-[#a8bdab]'}`}>
                          <span className="flex w-full items-center justify-between gap-2"><span className="flex items-center gap-2 font-serif text-xl font-bold">{key === 'pro' && <Crown size={21} className="text-[#193e30]" />}{detail.label}</span><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-[#193e30] bg-[#193e30] text-white' : 'border-[#e8e5dc]'}`}>{selected && <Check size={14} />}</span></span>
                          <span className="mt-4 text-lg font-bold">{detail.price}</span>
                          <span className="mt-3 rounded-xl bg-white px-4 py-3 text-2xl font-bold text-[#193e30]">{detail.commission}<span className="mt-1 block text-xs font-normal text-[#68756d]">Commission marketplace TerangaSN</span></span>
                          <span className="mt-4 text-sm leading-relaxed text-[#68756d]">{detail.description}</span>
                          <span className="mt-5 space-y-3">{detail.features.map((feature) => <span key={feature} className="flex items-start gap-2 text-sm"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#193e30]" />{feature}</span>)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <InfoBox>Les réservations réellement directes (WhatsApp, téléphone, accueil ou lien direct de l’établissement) sont sans commission TerangaSN. Seules les réservations éligibles apportées par la marketplace sont commissionnées en Standard.</InfoBox>
                  <div className="rounded-2xl border border-[#e8e5dc] bg-[#f8f7f3] p-5">
                    <div className="flex items-start gap-3"><Wallet size={21} className="mt-0.5 shrink-0 text-[#193e30]" /><div><p className="font-bold">Aucun paiement maintenant</p><p className="mt-2 text-sm leading-relaxed text-[#68756d]">Vous exprimez une préférence de formule. Le paiement, l’activation effective de Business et la facturation seront configurés ultérieurement. Les tarifs sont TTC et restent à valider avant commercialisation.</p></div></div>
                  </div>
                  <p className="text-xs leading-relaxed text-[#68756d]">La sélection de Business ne débloque pas les droits Business. Le quota dépend de l’abonnement réellement actif, contrôlé par le serveur.</p>
                   <p className="text-xs leading-relaxed text-[#68756d]">Enterprise, sur devis et avec conditions négociées, fera l’objet d’un parcours commercial distinct.</p>
                </div>
              )}

              {currentKey === 'summary' && (
                <div className="space-y-6">
                  <div className="flex gap-3 rounded-2xl border border-[#dfe7dd] bg-[#f2f5f0] p-5"><CheckCircle2 size={21} className="mt-0.5 shrink-0 text-[#193e30]" /><div><p className="font-bold">Votre établissement est prêt pour la prochaine étape</p><p className="mt-1 text-sm leading-relaxed text-[#68756d]">Il ne sera pas publié automatiquement. Sa configuration et ses éventuelles vérifications restent à compléter.</p></div></div>
                  {isFirstHost && <>
                    <SummarySection title="Responsable" onEdit={() => goToStep('responsible')}><SummaryRow label="Nom" value={`${formData.firstName} ${formData.lastName}`} /><SummaryRow label="Téléphone" value={formData.phone} /></SummarySection>
                    <SummarySection title="Relation avec l’hébergement" onEdit={() => goToStep('relationship')}><SummaryRow label="Statut" value={relationshipLabel} />{formData.relationship === 'company_representative' && <><SummaryRow label="Entreprise" value={formData.companyName} /><SummaryRow label="Fonction" value={formData.position} /></>}</SummarySection>
                  </>}
                  <SummarySection title="Hébergement" onEdit={() => goToStep('type')}><SummaryRow label="Type" value={lodgingTypeLabel} /></SummarySection>
                  <SummarySection title="Informations principales" onEdit={() => goToStep('lodging')}><SummaryRow label="Nom" value={formData.lodgingName} /><SummaryRow label="Localisation" value={`${formData.city}, ${formData.region}`} /><SummaryRow label="Adresse" value={formData.address} />{formData.description.trim() && <SummaryRow label="Description" value={formData.description} />}</SummarySection>
                  {isFirstHost && <SummarySection title="Formule souhaitée" onEdit={() => goToStep('plan')}><SummaryRow label="Offre" value={PLAN_DETAILS[plan].label} /><SummaryRow label="Prix TTC" value={PLAN_DETAILS[plan].price} /><SummaryRow label="Commission marketplace" value={PLAN_DETAILS[plan].commission} /></SummarySection>}
                  <InfoBox>La création de cet établissement ne signifie pas qu’il est immédiatement vérifié ou publié. Si vous avez choisi Business, cela ne constitue pas une souscription payante : aucune facturation ne démarre à cette étape.</InfoBox>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#e8e5dc] bg-[#f8f7f3] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-9">
              <button type="button" onClick={handlePrevious} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e8e5dc] bg-white px-5 py-3 text-sm font-bold text-[#26342c] hover:bg-[#F4F2EC]"><ArrowLeft size={16} /> Retour</button>
              <button type="button" disabled={!canContinue || submitting} onClick={handleNext} className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition ${canContinue && !submitting ? 'bg-[#193e30] text-white shadow-sm hover:bg-[#10281f]' : 'cursor-not-allowed bg-[#e8e5dc] text-[#9aa69d]'}`}>
                {currentIndex === steps.length - 1 ? (isFirstHost ? 'Créer mon espace hôte' : 'Enregistrer le brouillon') : 'Continuer'}
                {currentIndex === steps.length - 1 ? <Check size={17} /> : <ArrowRight size={17} />}
              </button>
            </div>
          </div>
          <div className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-[#68756d]"><LockKeyhole size={15} className="mt-0.5 shrink-0" /> L’enregistrement n’entraîne aucune publication. La validation administrative intervient plus tard, après complétion du dossier.</div>
        </main>
      </div>
    </div>
  );
};

export default HostOnboardingPage;
