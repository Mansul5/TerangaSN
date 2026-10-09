import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
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
      () => [
        {
          id: 'responsibility',
          icon: UserCheck,
          title:
            'Votre responsabilité en tant qu’hôte',
          summary:
            'Vous êtes responsable des informations et des hébergements que vous publiez.',
          content: (
            <div className="space-y-3">
              <p>
                En utilisant l’espace hôte,
                vous vous engagez à fournir
                des informations exactes,
                compréhensibles et à jour
                concernant votre activité et
                les hébergements que vous
                gérez.
              </p>

              <p>
                Les photos, descriptions,
                équipements, tarifs,
                disponibilités, règles et
                conditions présentés aux
                voyageurs doivent correspondre
                autant que possible à la
                réalité de l’hébergement.
              </p>

              <p>
                Vous êtes également responsable
                de la bonne gestion des
                réservations reçues et du
                respect des engagements pris
                envers les voyageurs.
              </p>
            </div>
          ),
        },
        {
          id: 'authorization',
          icon: Building2,
          title:
            'Droit de gérer l’hébergement',
          summary:
            'Vous devez être autorisé à proposer et gérer l’hébergement sur la plateforme.',
          content: (
            <div className="space-y-3">
              <p>
                Vous pouvez utiliser l’espace
                hôte en tant que propriétaire,
                gérant, mandataire ou
                représentant d’une entreprise
                autorisée à exploiter
                l’hébergement.
              </p>

              <p>
                Vous devez disposer des droits
                ou autorisations nécessaires
                pour proposer l’hébergement,
                recevoir des réservations et
                prendre les décisions liées à
                sa gestion.
              </p>

              <p>
                Des justificatifs pourront être
                demandés lorsque cela est
                nécessaire, notamment avant la
                publication ou pour certaines
                fonctionnalités sensibles.
              </p>
            </div>
          ),
        },
        {
          id: 'traveler',
          icon: Handshake,
          title:
            'Engagement envers les voyageurs',
          summary:
            'Les réservations confirmées doivent être honorées conformément aux conditions annoncées.',
          content: (
            <div className="space-y-3">
              <p>
                Lorsqu’une réservation est
                confirmée, vous vous engagez à
                accueillir le voyageur selon
                les informations et conditions
                communiquées au moment de la
                réservation.
              </p>

              <p>
                Toute modification importante
                susceptible d’affecter un séjour
                doit être communiquée dans les
                meilleurs délais.
              </p>

              <p>
                Les voyageurs doivent être
                traités avec respect, sans
                discrimination injustifiée, et
                dans des conditions conformes
                aux informations présentées sur
                la plateforme.
              </p>
            </div>
          ),
        },
        {
          id: 'pricing',
          icon: ReceiptText,
          title:
            'Tarifs, commissions et paiements',
          summary:
            'Les conditions financières applicables seront présentées clairement selon votre formule.',
          content: (
            <div className="space-y-3">
              <p>
                Les tarifs que vous configurez
                doivent être cohérents avec les
                conditions réellement proposées
                aux voyageurs.
              </p>

              <p>
                Selon la formule utilisée, des
                commissions, frais de paiement,
                abonnements ou autres frais
                clairement identifiés peuvent
                s’appliquer.
              </p>

              <p>
                Les montants et règles
                applicables doivent être
                présentés avant leur application.
                Certaines conditions peuvent
                varier selon le mode de paiement
                ou la formule choisie.
              </p>
            </div>
          ),
        },
        {
          id: 'verification',
          icon: ShieldCheck,
          title:
            'Identité et vérifications',
          summary:
            'Certaines vérifications peuvent être nécessaires pour sécuriser la plateforme.',
          content: (
            <div className="space-y-3">
              <p>
                La création de votre espace hôte
                ne signifie pas que tous les
                justificatifs doivent être
                fournis immédiatement.
              </p>

              <p>
                Des vérifications d’identité,
                de contact, d’activité ou du
                droit de gérer un hébergement
                peuvent toutefois être
                demandées progressivement.
              </p>

              <p>
                Certaines fonctionnalités,
                notamment la publication ou des
                opérations sensibles, peuvent
                rester limitées tant que les
                vérifications nécessaires ne
                sont pas terminées.
              </p>
            </div>
          ),
        },
        {
          id: 'conduct',
          icon: AlertTriangle,
          title:
            'Utilisation responsable de la plateforme',
          summary:
            'Les abus, fraudes ou comportements portant préjudice aux utilisateurs peuvent entraîner des restrictions.',
          content: (
            <div className="space-y-3">
              <p>
                Il est interdit d’utiliser la
                plateforme pour publier de
                fausses informations, tromper
                des voyageurs, contourner
                volontairement les règles de la
                plateforme ou mener une
                activité frauduleuse.
              </p>

              <p>
                En cas de problème sérieux,
                d’abus répétés ou de risque pour
                les utilisateurs, certaines
                fonctionnalités peuvent être
                temporairement limitées.
              </p>

              <p>
                Les mesures prises doivent
                dépendre de la nature et de la
                gravité de la situation, tout en
                tenant compte des réservations
                déjà confirmées et des voyageurs
                concernés.
              </p>
            </div>
          ),
        },
      ],
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
    <div className="min-h-screen bg-[#FAF9F6] text-[#2D2A26]">
      {/* HEADER */}
      <section className="border-b border-[#E6E2D3] bg-white">
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B6658] transition hover:text-[#3F6212]"
          >
            <ArrowLeft size={17} />
            Retour
          </button>
        </div>
      </section>

      {/* INTRO */}
      <section className="mx-auto max-w-5xl px-3 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-14">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ECF3E5] px-3 py-1.5 text-xs font-bold text-[#3F6212]">
            <FileCheck2 size={15} />
            Avant de commencer
          </div>

          <h1 className="mt-5 font-serif text-2xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Les engagements essentiels de
            votre espace hôte
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#6B6658] sm:text-base">
            Quelques règles essentielles
            permettent de protéger les hôtes,
            les voyageurs et la qualité des
            hébergements proposés sur la
            plateforme.
          </p>
        </div>

        {/* INFORMATION BOX */}
        <div className="mt-7 flex gap-3 sm:gap-4 rounded-2xl border border-[#D7E2C9] bg-[#F2F7ED] p-4 sm:p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#3F6212]">
            <Info size={18} />
          </div>

          <div>
            <p className="text-sm font-bold">
              Vous pourrez compléter votre
              hébergement progressivement
            </p>

            <p className="mt-1 text-xs leading-relaxed text-[#6B6658] sm:text-sm">
              Accepter ces engagements ne publie
              pas automatiquement votre
              hébergement. Vous pourrez
              enregistrer votre progression et
              les vérifications nécessaires
              seront demandées au moment
              approprié.
            </p>
          </div>
        </div>
      </section>

      {/* TERMS */}
      <section className="mx-auto max-w-5xl px-3 pb-8 sm:px-6 sm:pb-10">
        <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E6E2D3] bg-white shadow-sm">
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
                      ? 'border-b border-[#E6E2D3]'
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
                    className="flex w-full items-start justify-between gap-3 sm:gap-5 px-4 py-4 text-left transition hover:bg-[#FAF9F6] sm:px-7 sm:py-6"
                  >
                    <div className="flex gap-3 sm:gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF3E5] text-[#3F6212]">
                        <Icon size={19} />
                      </div>

                      <div>
                        <h2 className="text-sm font-bold sm:text-base">
                          {section.title}
                        </h2>

                        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#777166] sm:text-sm">
                          {section.summary}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 shrink-0 text-[#8C887D]">
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
                    <div className="border-t border-[#F0EDE4] bg-[#FAF9F6]/60 px-4 py-4 sm:px-7 sm:py-5">
                      <div className="ml-0 max-w-3xl text-sm leading-relaxed text-[#5F5A50] sm:ml-14">
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

      {/* ACCEPTANCE */}
      <section className="mx-auto max-w-5xl px-3 pb-12 sm:px-6 sm:pb-16">
        <div className="rounded-2xl sm:rounded-3xl border border-[#E6E2D3] bg-white p-4 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECF3E5] text-[#3F6212] sm:flex">
              <CheckCircle2 size={21} />
            </div>

            <div className="flex-1">
              <h2 className="font-serif text-xl sm:text-2xl font-bold">
                Confirmez vos engagements
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-[#6B6658]">
                Ces confirmations sont
                nécessaires avant de poursuivre
                la création de votre espace hôte.
              </p>

              <div className="mt-7 space-y-4">
                {/* TERMS */}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E6E2D3] p-4 transition hover:border-[#BAC9A8]">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) =>
                      setAcceptedTerms(
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-[#3F6212]"
                  />

                  <span className="text-sm leading-relaxed text-[#4F4A42]">
                    J’ai lu et j’accepte les
                    engagements présentés pour
                    l’utilisation de mon espace
                    hôte.
                  </span>
                </label>

                {/* ACCURACY */}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E6E2D3] p-4 transition hover:border-[#BAC9A8]">
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
                    className="mt-0.5 h-4 w-4 accent-[#3F6212]"
                  />

                  <span className="text-sm leading-relaxed text-[#4F4A42]">
                    Je m’engage à fournir des
                    informations exactes et à
                    maintenir les informations de
                    mes hébergements à jour.
                  </span>
                </label>

                {/* AUTHORIZATION */}
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E6E2D3] p-4 transition hover:border-[#BAC9A8]">
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
                    className="mt-0.5 h-4 w-4 accent-[#3F6212]"
                  />

                  <span className="text-sm leading-relaxed text-[#4F4A42]">
                    Je confirme être autorisé à
                    gérer ou représenter les
                    hébergements que j’ajouterai
                    sur la plateforme.
                  </span>
                </label>
              </div>

              {/* CONTINUE */}
              <div className="mt-8 border-t border-[#E6E2D3] pt-6">
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={handleContinue}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition sm:w-auto ${
                    canContinue
                      ? 'bg-[#3F6212] text-white shadow-sm hover:bg-[#365314]'
                      : 'cursor-not-allowed bg-[#E6E2D3] text-[#9B978D]'
                  }`}
                >
                  Accepter et continuer
                  <ArrowRight
                    size={17}
                  />
                </button>

                {!canContinue && (
                  <p className="mt-3 text-xs text-[#8C887D]">
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
        <div className="mt-6 flex items-start gap-3 px-1 text-xs leading-relaxed text-[#8C887D]">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0"
          />

          <p>
            Cette étape présente les
            engagements essentiels du parcours
            hôte. Les conditions contractuelles,
            financières et politiques
            applicables à la plateforme pourront
            être présentées séparément dans leur
            version complète et à jour.
          </p>
        </div>
      </section>
    </div>
  );
};

export default HostTermsPage;