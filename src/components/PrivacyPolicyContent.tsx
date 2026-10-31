import React from 'react';

export const PrivacyPolicyContent: React.FC = () => (
  <div className="space-y-6 text-sm leading-6 text-[#53665A]">
    <section>
      <h2 className="font-semibold text-[#193E30]">1. Responsable du traitement</h2>
      <p className="mt-2">
        Le service TerangaSN est exploité par <strong>[nom légal de l’entreprise ou du responsable]</strong>,
        établi à <strong>[adresse à compléter]</strong>. Pour toute question relative à vos données,
        contactez <strong>[adresse e-mail de contact à compléter]</strong>. Ces coordonnées doivent être
        renseignées avant la publication définitive de cette politique.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">2. Données susceptibles d’être traitées</h2>
      <p className="mt-2">Selon les fonctionnalités que vous utilisez, TerangaSN peut traiter :</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>les données de compte et de contact, comme le nom, l’adresse e-mail et le numéro de téléphone ;</li>
        <li>les informations nécessaires à la recherche, aux réservations, aux favoris et au suivi des séjours ;</li>
        <li>pour les hôtes, les informations sur l’établissement et les justificatifs éventuellement transmis ;</li>
        <li>les données techniques nécessaires au fonctionnement, à la sécurité et au diagnostic du service.</li>
      </ul>
      <p className="mt-2">
        Ne transmettez pas de données sensibles qui ne sont pas demandées ou nécessaires à la fonctionnalité utilisée.
        La liste exacte des données et des pièces justificatives demandées devra être vérifiée et précisée.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">3. Pourquoi ces données sont utilisées</h2>
      <p className="mt-2">
        Les données peuvent être utilisées pour créer et sécuriser votre compte, fournir les fonctions de recherche
        et de réservation, gérer les demandes des voyageurs et des hôtes, répondre à vos messages, prévenir les abus
        et respecter les obligations légales applicables. Lorsque le traitement repose sur votre consentement,
        celui-ci est demandé séparément lorsque nécessaire et peut être retiré dans les conditions applicables.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">4. Accès aux données et prestataires</h2>
      <p className="mt-2">
        L’accès aux données est limité aux personnes qui en ont besoin pour fournir, administrer ou sécuriser le service.
        Certaines données peuvent être communiquées aux hébergements concernés par une réservation et à des prestataires
        techniques intervenant pour le compte de TerangaSN. Les prestataires effectivement utilisés, leurs rôles et les
        données concernées doivent être précisés dans la version définitive.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">5. Hébergement et transferts</h2>
      <p className="mt-2">
        Les données peuvent être hébergées ou traitées par des prestataires situés hors du Sénégal. Avant publication,
        TerangaSN doit confirmer les pays concernés, les prestataires utilisés et les garanties applicables aux éventuels
        transferts de données.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">6. Durée de conservation</h2>
      <p className="mt-2">
        Les données sont conservées pendant la durée nécessaire aux finalités annoncées, puis supprimées ou archivées
        lorsque leur conservation reste nécessaire à la gestion d’un litige ou au respect d’une obligation légale.
        Les durées précises par catégorie de données doivent être fixées et ajoutées avant la publication définitive.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">7. Vos droits et vos demandes</h2>
      <p className="mt-2">
        Selon la réglementation applicable, vous pouvez notamment demander l’accès à vos données, leur rectification
        ou exercer les autres droits qui vous sont reconnus. Pour exercer vos droits ou poser une question, écrivez à
        <strong> [adresse e-mail de contact à compléter]</strong>. Une vérification raisonnable de votre identité peut
        être nécessaire pour protéger votre compte. Vous pouvez également vous renseigner auprès de la Commission de
        Protection des Données Personnelles (CDP) du Sénégal.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">8. Cookies et technologies similaires</h2>
      <p className="mt-2">
        Le service peut utiliser des éléments techniques nécessaires à son fonctionnement et à la sécurité.
        Les outils de mesure d’audience ou de publicité, ainsi que les choix proposés aux utilisateurs,
        doivent être ajoutés ici s’ils sont utilisés.
      </p>
    </section>

    <section>
      <h2 className="font-semibold text-[#193E30]">9. Sécurité et mises à jour</h2>
      <p className="mt-2">
        TerangaSN met en œuvre des mesures destinées à protéger les données contre les accès non autorisés,
        la perte ou l’altération. Aucune transmission ou conservation électronique ne peut toutefois être garantie
        comme absolument sans risque. Cette politique sera mise à jour si les traitements ou les fonctionnalités évoluent.
      </p>
    </section>
  </div>
);

export default PrivacyPolicyContent;
