import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2,
  ChevronRight, Crown, Home, Hotel, Info, MapPin,
  ShieldCheck, UserRound, UsersRound, Wallet,
} from 'lucide-react';

export type HostRelationship = 'owner' | 'manager' | 'company';
export type HostOnboardingLodgingType =
  | 'hotel' | 'villa' | 'appartement' | 'residence'
  | 'lodge' | 'campement' | 'chambre_hotes';
export type HostOnboardingMode = 'first-host' | 'add-lodging';
export type HostPlan = 'standard' | 'pro';

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
  { key: 'relationship', shortLabel: 'Relation', title: 'Quel est votre lien avec cet hébergement ?', description: 'Vous pouvez être propriétaire, gérant, mandataire ou représentant d’une entreprise.' },
  { key: 'type', shortLabel: 'Type', title: 'Quel type d’hébergement souhaitez-vous ajouter ?', description: 'Sélectionnez la catégorie qui décrit le mieux votre établissement.' },
  { key: 'lodging', shortLabel: 'Établissement', title: 'Présentez votre hébergement', description: 'Commençons par les informations essentielles. Vous configurerez ensuite les chambres, les photos et les tarifs.' },
  { key: 'plan', shortLabel: 'Formule', title: 'Choisissez votre formule TerangaSN', description: 'Commencez avec Standard gratuitement ou préparez votre passage à Pro. Aucun paiement ne sera effectué ici.' },
  { key: 'summary', shortLabel: 'Résumé', title: 'Vérifiez les informations', description: 'Relisez les informations avant de poursuivre vers votre espace hôte.' },
];

const ADD_LODGING_STEPS: StepDefinition[] = [
  FIRST_HOST_STEPS[2], FIRST_HOST_STEPS[3], FIRST_HOST_STEPS[5],
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
    label: 'Standard', price: '0 F CFA TTC / mois', commission: '8 % TTC',
    description: 'Le logiciel essentiel, sans abonnement mensuel.',
    features: [
      '1 établissement actif',
      'Chambres et réservations manuelles illimitées',
      'Calendrier, check-in, check-out et suivi des paiements',
      'Exports CSV, Excel et PDF gratuits',
      'Site vitrine essentiel et réservations directes sans commission',
    ],
  },
  pro: {
    label: 'Pro', price: '39 900 F CFA TTC / mois', commission: '0 %',
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
    <label className="block text-sm font-bold text-[#3E3A34]">{label}</label>
    {children}
    {hint && <p className="text-xs leading-relaxed text-[#8C887D]">{hint}</p>}
  </div>
);

const inputClass = 'w-full rounded-xl border border-[#DCD8CC] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#AAA69C] focus:border-[#3F6212] focus:ring-2 focus:ring-[#3F6212]/10';

const InfoBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 rounded-2xl border border-[#D9E5CB] bg-[#F3F7EE] p-4">
    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#3F6212]" />
    <p className="text-sm leading-relaxed text-[#625E54]">{children}</p>
  </div>
);

const ChoiceCard: React.FC<{
  selected: boolean; icon: React.ElementType; title: string;
  description: string; onClick: () => void;
}> = ({ selected, icon: Icon, title, description, onClick }) => (
  <button type="button" onClick={onClick} aria-pressed={selected}
    className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition ${selected ? 'border-[#3F6212] bg-[#F3F7EE]' : 'border-[#E6E2D3] bg-white hover:border-[#BFCBAE]'}`}>
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-[#3F6212] text-white' : 'bg-[#F2F0E9] text-[#5F5A50]'}`}><Icon size={19} /></span>
    <span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="mt-1 block text-xs leading-relaxed text-[#777166] sm:text-sm">{description}</span></span>
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-[#3F6212] bg-[#3F6212] text-white' : 'border-[#D5D1C6] text-transparent'}`}><Check size={13} /></span>
  </button>
);

const SummarySection: React.FC<{ title: string; onEdit: () => void; children: React.ReactNode }> = ({ title, onEdit, children }) => (
  <div className="overflow-hidden rounded-2xl border border-[#E6E2D3]">
    <div className="flex items-center justify-between border-b border-[#EEEAE0] bg-[#FAF9F6] px-5 py-4">
      <h3 className="font-bold">{title}</h3>
      <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-bold text-[#3F6212] hover:underline">Modifier <ChevronRight size={14} /></button>
    </div>
    <div className="divide-y divide-[#EEEAE0] px-5">{children}</div>
  </div>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-5">
    <span className="text-xs font-semibold text-[#8C887D]">{label}</span>
    <span className="break-words text-sm font-medium text-[#3E3A34]">{value || '—'}</span>
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
        return Boolean(formData.relationship && (formData.relationship !== 'company' || (formData.companyName.trim() && formData.position.trim())));
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
    owner: 'Propriétaire', manager: 'Gérant ou mandataire',
    company: 'Représentant d’une entreprise',
  };
  const relationshipLabel = formData.relationship
    ? relationshipLabels[formData.relationship]
    : 'Non renseigné';
  const lodgingTypeLabel = LODGING_TYPES.find((type) => type.value === formData.lodgingType)?.label || 'Non renseigné';
  const plan = formData.selectedPlan || 'standard';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2D2A26]">
      <div className="border-b border-[#E6E2D3] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <button type="button" onClick={handlePrevious} className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B6658] hover:text-[#3F6212]"><ArrowLeft size={17} /> Retour</button>
          <div className="hidden items-center gap-2 text-xs font-semibold text-[#777166] sm:flex"><Info size={15} /> Informations modifiables avant publication</div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-9 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-12">
        <aside>
          <div className="lg:sticky lg:top-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ECF3E5] px-3 py-1.5 text-xs font-bold text-[#3F6212]"><Building2 size={14} /> {isFirstHost ? 'Création de l’espace hôte' : 'Nouvel hébergement'}</span>
            <p className="mt-4 text-sm leading-relaxed text-[#777166]">{isFirstHost ? 'Configurez votre profil, votre premier établissement et votre formule.' : 'Ajoutez un hébergement à votre espace hôte existant.'}</p>
            <div className="mt-6 hidden space-y-2 lg:block">
              {steps.map((step, index) => {
                const completed = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <div key={step.key} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${active ? 'bg-white shadow-sm' : ''}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${completed ? 'bg-[#3F6212] text-white' : active ? 'border-2 border-[#3F6212] bg-white text-[#3F6212]' : 'border border-[#D9D5C9] text-[#999489]'}`}>{completed ? <Check size={15} /> : index + 1}</span>
                    <span className={`text-sm ${active ? 'font-bold' : completed ? 'font-semibold text-[#5E5A51]' : 'text-[#999489]'}`}>{step.shortLabel}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 lg:hidden">
              <div className="flex justify-between text-xs font-semibold text-[#777166]"><span>Étape {currentIndex + 1} sur {steps.length}</span><span>{currentStep.shortLabel}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E6E2D3]"><div className="h-full rounded-full bg-[#3F6212] transition-all" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }} /></div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-[#E6E2D3] bg-white shadow-sm sm:rounded-3xl">
            <div className="border-b border-[#EEEAE0] px-5 py-6 sm:px-9 sm:py-9">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3F6212]">Étape {currentIndex + 1}</p>
              <h1 className="mt-3 font-serif text-2xl font-bold leading-tight sm:text-3xl">{currentStep.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#777166]">{currentStep.description}</p>
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
                  <ChoiceCard selected={formData.relationship === 'owner'} icon={Home} title="Je suis propriétaire" description="Vous possédez l’hébergement ou êtes directement habilité à l’exploiter." onClick={() => updateField('relationship', 'owner')} />
                  <ChoiceCard selected={formData.relationship === 'manager'} icon={UserRound} title="Je suis gérant ou mandataire" description="Vous gérez l’établissement pour le compte du propriétaire ou de l’exploitant." onClick={() => updateField('relationship', 'manager')} />
                  <ChoiceCard selected={formData.relationship === 'company'} icon={Building2} title="Je représente une entreprise" description="Vous agissez pour une société ou une organisation qui exploite l’hébergement." onClick={() => updateField('relationship', 'company')} />
                  {formData.relationship === 'company' && (
                    <div className="grid gap-5 rounded-2xl border border-[#E6E2D3] bg-[#FAF9F6] p-5 sm:grid-cols-2">
                      <Field label="Nom de l’entreprise"><input className={inputClass} value={formData.companyName} onChange={(e) => updateField('companyName', e.target.value)} placeholder="Nom de la société" /></Field>
                      <Field label="Votre fonction"><input className={inputClass} value={formData.position} onChange={(e) => updateField('position', e.target.value)} placeholder="Ex. Directeur" /></Field>
                    </div>
                  )}
                  <InfoBox>Une preuve de votre droit à gérer l’hébergement pourra être demandée avant sa publication ou certaines opérations sensibles.</InfoBox>
                </div>
              )}

              {currentKey === 'type' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {LODGING_TYPES.map((type) => {
                    const Icon = type.icon;
                    const selected = formData.lodgingType === type.value;
                    return (
                      <button key={type.value} type="button" aria-pressed={selected} onClick={() => updateField('lodgingType', type.value)} className={`flex min-h-[150px] flex-col items-start rounded-2xl border p-5 text-left transition ${selected ? 'border-[#3F6212] bg-[#F3F7EE] shadow-sm' : 'border-[#E6E2D3] hover:border-[#BFCBAE]'}`}>
                        <span className="flex w-full justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-[#3F6212] text-white' : 'bg-[#F2F0E9] text-[#5F5A50]'}`}><Icon size={19} /></span>{selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3F6212] text-white"><Check size={14} /></span>}</span>
                        <span className="mt-4 font-bold">{type.label}</span>
                        <span className="mt-2 text-xs leading-relaxed text-[#777166]">{type.description}</span>
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
                  <Field label="Adresse" hint="Vous pourrez préciser la position sur la carte lors de la configuration complète."><div className="relative"><MapPin size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999489]" /><input className={`${inputClass} pl-11`} value={formData.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Adresse ou indication précise" /></div></Field>
                  <Field label="Description (facultatif)"><textarea rows={5} className={`${inputClass} resize-y`} value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Présentez brièvement votre hébergement..." /></Field>
                  <InfoBox>Les photos, équipements, chambres, tarifs, disponibilités et règles de séjour seront ajoutés ensuite depuis votre espace hôte.</InfoBox>
                </div>
              )}

              {currentKey === 'plan' && (
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    {(['standard', 'pro'] as const).map((key) => {
                      const detail = PLAN_DETAILS[key];
                      const selected = plan === key;
                      return (
                        <button key={key} type="button" aria-pressed={selected} onClick={() => updateField('selectedPlan', key)} className={`flex flex-col rounded-2xl border-2 p-5 text-left transition ${selected ? 'border-[#3F6212] bg-[#F3F7EE]' : 'border-[#E6E2D3] bg-white hover:border-[#BFCBAE]'}`}>
                          <span className="flex w-full items-center justify-between gap-2"><span className="flex items-center gap-2 font-serif text-xl font-bold">{key === 'pro' && <Crown size={21} className="text-[#3F6212]" />}{detail.label}</span><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-[#3F6212] bg-[#3F6212] text-white' : 'border-[#D5D1C6]'}`}>{selected && <Check size={14} />}</span></span>
                          <span className="mt-4 text-lg font-bold">{detail.price}</span>
                          <span className="mt-3 rounded-xl bg-white px-4 py-3 text-2xl font-bold text-[#3F6212]">{detail.commission}<span className="mt-1 block text-xs font-normal text-[#6B6658]">Commission marketplace TerangaSN</span></span>
                          <span className="mt-4 text-sm leading-relaxed text-[#6B6658]">{detail.description}</span>
                          <span className="mt-5 space-y-3">{detail.features.map((feature) => <span key={feature} className="flex items-start gap-2 text-sm"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#3F6212]" />{feature}</span>)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <InfoBox>Les réservations réellement directes (WhatsApp, téléphone, accueil ou lien direct de l’établissement) sont sans commission TerangaSN. Seules les réservations éligibles apportées par la marketplace sont commissionnées en Standard.</InfoBox>
                  <div className="rounded-2xl border border-[#E6E2D3] bg-[#FAF9F6] p-5">
                    <div className="flex items-start gap-3"><Wallet size={21} className="mt-0.5 shrink-0 text-[#3F6212]" /><div><p className="font-bold">Aucun paiement maintenant</p><p className="mt-2 text-sm leading-relaxed text-[#6B6658]">Vous exprimez une préférence de formule. Le paiement, l’activation effective de Pro et la facturation seront configurés ultérieurement. Les tarifs sont TTC et restent à valider avant commercialisation.</p></div></div>
                  </div>
                  <p className="text-xs leading-relaxed text-[#8C887D]">Enterprise, sur devis et avec conditions négociées, fera l’objet d’un parcours commercial distinct.</p>
                </div>
              )}

              {currentKey === 'summary' && (
                <div className="space-y-6">
                  <div className="flex gap-3 rounded-2xl border border-[#D9E5CB] bg-[#F3F7EE] p-5"><CheckCircle2 size={21} className="mt-0.5 shrink-0 text-[#3F6212]" /><div><p className="font-bold">Votre établissement est prêt pour la prochaine étape</p><p className="mt-1 text-sm leading-relaxed text-[#6B6658]">Il ne sera pas publié automatiquement. Sa configuration et ses éventuelles vérifications restent à compléter.</p></div></div>
                  {isFirstHost && <>
                    <SummarySection title="Responsable" onEdit={() => goToStep('responsible')}><SummaryRow label="Nom" value={`${formData.firstName} ${formData.lastName}`} /><SummaryRow label="Téléphone" value={formData.phone} /></SummarySection>
                    <SummarySection title="Relation avec l’hébergement" onEdit={() => goToStep('relationship')}><SummaryRow label="Statut" value={relationshipLabel} />{formData.relationship === 'company' && <><SummaryRow label="Entreprise" value={formData.companyName} /><SummaryRow label="Fonction" value={formData.position} /></>}</SummarySection>
                  </>}
                  <SummarySection title="Hébergement" onEdit={() => goToStep('type')}><SummaryRow label="Type" value={lodgingTypeLabel} /></SummarySection>
                  <SummarySection title="Informations principales" onEdit={() => goToStep('lodging')}><SummaryRow label="Nom" value={formData.lodgingName} /><SummaryRow label="Localisation" value={`${formData.city}, ${formData.region}`} /><SummaryRow label="Adresse" value={formData.address} />{formData.description.trim() && <SummaryRow label="Description" value={formData.description} />}</SummarySection>
                  {isFirstHost && <SummarySection title="Formule souhaitée" onEdit={() => goToStep('plan')}><SummaryRow label="Offre" value={PLAN_DETAILS[plan].label} /><SummaryRow label="Prix TTC" value={PLAN_DETAILS[plan].price} /><SummaryRow label="Commission marketplace" value={PLAN_DETAILS[plan].commission} /></SummarySection>}
                  <InfoBox>La création de cet établissement ne signifie pas qu’il est immédiatement vérifié ou publié. Si vous avez choisi Pro, cela ne constitue pas une souscription payante : aucune facturation ne démarre à cette étape.</InfoBox>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#EEEAE0] bg-[#FCFBF8] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-9">
              <button type="button" onClick={handlePrevious} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCD8CC] bg-white px-5 py-3 text-sm font-bold text-[#4F4A42] hover:bg-[#F4F2EC]"><ArrowLeft size={16} /> Retour</button>
              <button type="button" disabled={!canContinue || submitting} onClick={handleNext} className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition ${canContinue && !submitting ? 'bg-[#3F6212] text-white shadow-sm hover:bg-[#365314]' : 'cursor-not-allowed bg-[#E6E2D3] text-[#9B978D]'}`}>
                {currentIndex === steps.length - 1 ? (isFirstHost ? 'Continuer vers mon espace hôte' : 'Ajouter cet établissement') : 'Continuer'}
                {currentIndex === steps.length - 1 ? <Check size={17} /> : <ArrowRight size={17} />}
              </button>
            </div>
          </div>
          <p className="mt-5 text-center text-xs leading-relaxed text-[#999489]">Vous pourrez compléter et modifier votre établissement avant sa publication.</p>
        </main>
      </div>
    </div>
  );
};

export default HostOnboardingPage;
