import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Handshake,
  Info,
  ReceiptText,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface HostTermsPageProps {
  onBack: () => void;
  onContinue: () => void;
  readOnly?: boolean;
}

interface TermSection {
  id: string;
  icon: React.ElementType;
  title: string;
  summary: string;
  content: React.ReactNode;
}

export const HostTermsPage: React.FC<
  HostTermsPageProps
> = ({
  onBack,
  onContinue,
  readOnly = false,
}) => {
  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

  const [
    acceptedAccuracy,
    setAcceptedAccuracy,
  ] = useState(false);

  const [
    acceptedAuthorization,
    setAcceptedAuthorization,
  ] = useState(false);

  const [
    openSection,
    setOpenSection,
  ] = useState<string | null>(
    'responsibility'
  );

  const termSections: TermSection[] =
    useMemo(
      () => {
        const sections = [
          {
            id: 'object',
            icon: FileCheck2,
            title: '1. Objet',
            summary: 'Règles applicables aux hôteliers et gestionnaires sur la plateforme.',
            paragraphs: [
              'Ces règles complètent les Conditions Générales d’Utilisation et s’appliquent aux comptes enregistrés comme hôteliers, gestionnaires, propriétaires ou responsables d’établissement.',
            ],
          },
          {
            id: 'accuracy',
            icon: CheckCircle2,
            title: '2. Véracité des informations',
            summary: 'Les informations sur l’établissement doivent être exactes.',
            paragraphs: [
              'L’hôtelier s’engage à fournir des informations exactes sur l’établissement : nom, localisation, services, tarifs, disponibilité, contact, photos et conditions d’accueil.',
            ],
          },
          {
            id: 'publication',
            icon: Building2,
            title: '3. Publication d’un hébergement',
            summary: 'Le contenu publié doit correspondre au service réellement proposé.',
            paragraphs: [
              'L’hôtelier est responsable du contenu qu’il publie. Il doit s’assurer que les informations sont loyales, complètes et conformes à la réalité. Les photos, descriptions et tarifs doivent être cohérents avec le service réellement proposé.',
            ],
          },
          {
            id: 'availability',
            icon: CalendarDays,
            title: '4. Disponibilités et réservations',
            summary: 'Tenir les disponibilités à jour et éviter les réservations incompatibles.',
            paragraphs: [
              'L’hôtelier s’engage à maintenir ses disponibilités à jour, à traiter les demandes raisonnablement et à confirmer, refuser ou modifier les réservations de manière claire et professionnelle. Il ne doit pas accepter plusieurs réservations incompatibles pour la même période.',
            ],
          },
          {
            id: 'payment',
            icon: ReceiptText,
            title: '5. Conditions de paiement et d’annulation',
            summary: 'Communiquer les règles applicables aux voyageurs.',
            paragraphs: [
              'L’hôtelier doit communiquer clairement les modalités de paiement, les conditions d’annulation et les politiques applicables aux réservations. Il s’engage à respecter les règles publiées sur sa fiche.',
            ],
          },
          {
            id: 'customer-service',
            icon: Handshake,
            title: '6. Service client',
            summary: 'Assurer un accueil professionnel et conforme à l’offre annoncée.',
            paragraphs: [
              'L’hôtelier doit accueillir les voyageurs avec professionnalisme et garantir un service conforme à l’expérience annoncée. Il est responsable de la qualité de l’accueil et de la gestion des demandes reçues.',
            ],
          },
          {
            id: 'traveler-protection',
            icon: UserCheck,
            title: '7. Protection des voyageurs',
            summary: 'Ne pas imposer de conditions abusives ou trompeuses.',
            paragraphs: [
              'L’hôtelier s’engage à ne pas imposer de conditions abusives, à ne pas demander de paiements non prévus, à ne pas modifier les règles après confirmation sans information claire, et à ne pas utiliser la plateforme à des fins trompeuses ou frauduleuses.',
            ],
          },
          {
            id: 'moderation',
            icon: AlertTriangle,
            title: '8. Modération et sanctions',
            summary: 'Les manquements peuvent entraîner des mesures sur le compte ou l’établissement.',
            paragraphs: [
              'Le non-respect de ces règles peut entraîner un avertissement, une suspension du compte, la suppression de la fiche d’établissement ou un retrait temporaire de l’accès à la plateforme.',
            ],
          },
          {
            id: 'responsibility',
            icon: ShieldCheck,
            title: '9. Responsabilité directe',
            summary: 'L’hôtelier reste responsable des services et engagements envers les voyageurs.',
            paragraphs: [
              'L’hôtelier est responsable de ses services, de son accueil, de la qualité de son offre et de ses engagements envers les voyageurs. La plateforme agit comme intermédiaire et n’exerce pas de contrôle direct sur l’exploitation de l’établissement, sauf en cas de faute de la plateforme.',
            ],
          },
        ];

        return sections.map((section) => ({
          ...section,
          content: (
            <div className="space-y-3">
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          ),
        }));
      },
      []
    );

  const canContinue =
    acceptedTerms &&
    acceptedAccuracy &&
    acceptedAuthorization;

  const toggleSection = (
    sectionId: string
  ) => {
    setOpenSection((current) =>
      current === sectionId
        ? null
        : sectionId
    );
  };

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }

    onContinue();
  };

  return (
    <div className="boly-page min-h-screen bg-[#f8f7f3] text-[#26342c]">
      {/* Retour intégré à la page : la navigation globale TerangaSN reste l’unique header. */}
      <section className="boly-container pb-8 pt-8 sm:pb-10 sm:pt-12">
        <button
          type="button"
          onClick={onBack}
          className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-[#193e30] transition hover:underline sm:mb-12"
        >
          <ArrowLeft size={17} />
          Retour
        </button>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe7dd] bg-[#f2f5f0] px-3 py-1.5 text-xs font-bold text-[#193e30]">
            <FileCheck2 size={15} />
            {readOnly ? 'Informations pour les hôtes' : 'Avant de commencer'}
          </div>

          <h1 className="mt-5 font-serif text-3xl font-medium leading-tight tracking-tight text-[#193e30] sm:text-4xl lg:text-5xl">
            {readOnly ? 'Conditions spécifiques aux hôteliers et gestionnaires' : 'Conditions spécifiques aux hôteliers et gestionnaires'}
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#68756d] sm:text-base">
            {readOnly
              ? 'Ces engagements complètent les conditions générales d’utilisation. Leur acceptation est demandée avant la création de votre espace hôte.'
              : 'Quelques règles essentielles permettent de protéger les hôtes, les voyageurs et la qualité des hébergements proposés sur la plateforme.'}
          </p>
          <p className="mt-3 text-xs text-[#68756d]">Dernière mise à jour : 24 septembre 2026</p>
        </div>

        {/* INFORMATION BOX */}
        {!readOnly && <div className="mt-7 flex gap-3 sm:gap-4 rounded-2xl border border-[#dfe7dd] bg-[#f2f5f0] p-4 sm:p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#193e30]">
            <Info size={18} />
          </div>

          <div>
            <p className="text-sm font-bold">
              Vous pourrez compléter votre
              hébergement progressivement
            </p>

            <p className="mt-1 text-xs leading-relaxed text-[#68756d] sm:text-sm">
              Accepter ces engagements ne publie
              pas automatiquement votre
              hébergement. Vous pourrez
              enregistrer votre progression et
              les vérifications nécessaires
              seront demandées au moment
              approprié.
            </p>
          </div>
        </div>}
      </section>

      {/* TERMS */}
      <section className="mx-auto max-w-5xl px-3 pb-8 sm:px-6 sm:pb-10">
        <div className="overflow-hidden rounded-[24px] border border-[#e8e5dc] bg-white shadow-sm">
          {termSections.map(
            (section, index) => {
              const Icon = section.icon;
              const isOpen =
                openSection === section.id;

              return (
                <div
                  key={section.id}
                  className={
                    index !==
                    termSections.length - 1
                      ? 'border-b border-[#e8e5dc]'
                      : ''
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleSection(
                        section.id
                      )
                    }
                    className="flex w-full items-start justify-between gap-3 sm:gap-5 px-4 py-4 text-left transition hover:bg-[#f8f7f3] sm:px-7 sm:py-6"
                  >
                    <div className="flex gap-3 sm:gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2f5f0] text-[#193e30]">
                        <Icon size={19} />
                      </div>

                      <div>
                        <h2 className="text-sm font-bold sm:text-base">
                          {section.title}
                        </h2>

                        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#68756d] sm:text-sm">
                          {section.summary}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 shrink-0 text-[#68756d]">
                      {isOpen ? (
                        <ChevronUp
                          size={18}
                        />
                      ) : (
                        <ChevronDown
                          size={18}
                        />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#e8e5dc] bg-[#f8f7f3]/60 px-4 py-4 sm:px-7 sm:py-5">
                      <div className="ml-0 max-w-3xl text-sm leading-relaxed text-[#4e5c52] sm:ml-14">
                        {section.content}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </section>

      {!readOnly && <section className="mx-auto max-w-5xl px-3 pb-12 sm:px-6 sm:pb-16">
        <div className="rounded-[24px] border border-[#e8e5dc] bg-white p-4 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f5f0] text-[#193e30] sm:flex">
              <CheckCircle2 size={21} />
            </div>

            <div className="flex-1">
              <h2 className="font-serif text-xl font-semibold text-[#193e30] sm:text-2xl">
                Confirmez vos engagements
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-[#68756d]">
                Ces confirmations sont
                nécessaires avant de poursuivre
                la création de votre espace hôte.
              </p>

              <div className="mt-7 space-y-4">
                {/* TERMS */}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e8e5dc] p-4 transition hover:border-[#a1845f]">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) =>
                      setAcceptedTerms(
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-[#193e30]"
                  />

                  <span className="text-sm leading-relaxed text-[#26342c]">
                    J’ai lu et j’accepte les
                    engagements présentés pour
                    l’utilisation de mon espace
                    hôte.
                  </span>
                </label>

                {/* ACCURACY */}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e8e5dc] p-4 transition hover:border-[#a1845f]">
                  <input
                    type="checkbox"
                    checked={
                      acceptedAccuracy
                    }
                    onChange={(event) =>
                      setAcceptedAccuracy(
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-[#193e30]"
                  />

                  <span className="text-sm leading-relaxed text-[#26342c]">
                    Je m’engage à fournir des
                    informations exactes et à
                    maintenir les informations de
                    mes hébergements à jour.
                  </span>
                </label>

                {/* AUTHORIZATION */}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e8e5dc] p-4 transition hover:border-[#a1845f]">
                  <input
                    type="checkbox"
                    checked={
                      acceptedAuthorization
                    }
                    onChange={(event) =>
                      setAcceptedAuthorization(
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-[#193e30]"
                  />

                  <span className="text-sm leading-relaxed text-[#26342c]">
                    Je confirme être autorisé à
                    gérer ou représenter les
                    hébergements que j’ajouterai
                    sur la plateforme.
                  </span>
                </label>
              </div>

              {/* CONTINUE */}
              <div className="mt-8 border-t border-[#e8e5dc] pt-6">
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={handleContinue}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition sm:w-auto ${
                    canContinue
                      ? 'bg-[#193e30] text-white shadow-sm hover:bg-[#10281f]'
                      : 'cursor-not-allowed bg-[#e8e5dc] text-[#68756d]'
                  }`}
                >
                  Accepter et continuer
                  <ArrowRight
                    size={17}
                  />
                </button>

                {!canContinue && (
                  <p className="mt-3 text-xs text-[#68756d]">
                    Cochez les trois
                    confirmations pour
                    continuer.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTNOTE */}
        <div className="mt-6 flex items-start gap-3 px-1 text-xs leading-relaxed text-[#68756d]">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0"
          />

          <p>
            Ces règles spécifiques complètent
            les Conditions Générales
            d’Utilisation de Teranga Booking
            Sénégal.
          </p>
        </div>
      </section>}
    </div>
  );
};

export default HostTermsPage;