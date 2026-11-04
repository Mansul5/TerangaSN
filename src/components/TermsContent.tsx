import React from 'react';

const sections = [
  {
    title: '1. Objet',
    paragraphs: [
      'La plateforme TerangaSN permet de rechercher, comparer et réserver des hébergements au Sénégal. Elle met en relation des voyageurs et des hôteliers, propriétaires ou gestionnaires d’établissements.',
    ],
  },
  {
    title: '2. Acceptation',
    paragraphs: [
      'L’utilisation de la plateforme implique l’acceptation pleine et entière des présentes Conditions Générales d’Utilisation (CGU). En créant un compte, en effectuant une réservation ou en publiant un hébergement, l’utilisateur confirme avoir lu, compris et accepté ces conditions.',
    ],
  },
  {
    title: '3. Comptes utilisateurs',
    paragraphs: [
      'Les utilisateurs peuvent créer un compte en tant que voyageur, hôtelier ou administrateur. Chaque compte est personnel et ne doit pas être partagé. L’utilisateur s’engage à fournir des informations exactes et à les tenir à jour.',
    ],
  },
  {
    title: '4. Voyages et réservations',
    paragraphs: [
      'Les voyageurs peuvent consulter les hébergements, rechercher selon les critères, enregistrer leurs favoris et soumettre des demandes de réservation. Ils s’engagent à fournir des informations vraies et à respecter les modalités affichées par chaque hébergement.',
    ],
  },
  {
    title: '5. Hôteliers et gestionnaires',
    paragraphs: [
      'Les hôteliers peuvent publier leurs établissements, gérer les chambres, les disponibilités et les tarifs, et traiter les réservations. Ils s’engagent à fournir des informations exactes, à maintenir leurs offres à jour et à respecter les conditions de réservation qu’ils publient.',
    ],
  },
  {
    title: '6. Contenu utilisateur',
    paragraphs: [
      'L’utilisateur est responsable du contenu qu’il publie sur la plateforme, notamment les photos, descriptions, tarifs, disponibilités, avis et messages. La plateforme peut retirer un contenu illégal, trompeur, offensant ou non conforme aux règles.',
    ],
  },
  {
    title: '7. Paiements et frais',
    paragraphs: [
      'Les modalités de paiement sont définies par chaque établissement. La plateforme peut appliquer une commission sur les réservations validées dans les conditions publiées dans la plateforme.',
    ],
  },
  {
    title: '8. Responsabilité',
    paragraphs: [
      'La plateforme agit comme intermédiaire technique et de mise en relation. Elle ne garantit pas la qualité réelle des services offerts par les hébergements, mais s’engage à mettre en place des moyens raisonnables pour assurer le bon fonctionnement de la plateforme.',
    ],
  },
  {
    title: '9. Données personnelles',
    paragraphs: [
      'Les données personnelles sont traitées dans le respect de la réglementation en vigueur et de la politique de confidentialité applicable.',
    ],
  },
  {
    title: '10. Modération et suspension',
    paragraphs: [
      'La plateforme peut suspendre ou supprimer un compte en cas de non-respect des règles, d’abus, de fraude ou de contenu illégal.',
    ],
  },
  {
    title: '11. Modifications',
    paragraphs: [
      'Les présentes CGU peuvent être modifiées à tout moment. L’utilisateur est lié par la version en vigueur au moment de son acceptation.',
    ],
  },
  {
    title: '12. Loi applicable',
    paragraphs: [
      'Les présentes conditions sont soumises à la législation applicable et à la compétence des juridictions compétentes.',
    ],
  },
];

export const TermsContent: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className={compact ? 'space-y-4' : 'space-y-6'}>
    {sections.map(section => (
      <section key={section.title}>
        <h2 className="font-semibold text-[#193E30]">{section.title}</h2>
        <div className="mt-2 space-y-2 text-sm leading-6 text-[#53665A]">
          {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </section>
    ))}
  </div>
);
