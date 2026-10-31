import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PrivacyPolicyContent } from '@/src/components/PrivacyPolicyContent';

interface PrivacyPolicyPageProps {
  onBack: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onBack }) => (
  <div className="min-h-screen bg-[#F7F5EF] text-[#30352F]">
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#193E30] hover:underline">
        <ArrowLeft size={17} aria-hidden="true" /> Retour
      </button>
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#EDF1EB] px-3 py-1.5 text-xs font-bold text-[#193E30]">
          <ShieldCheck size={15} aria-hidden="true" /> Protection des données
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-[#193E30] sm:text-4xl">Politique de confidentialité</h1>
      </header>
      <div role="note" className="mb-6 rounded-2xl border border-[#D8BE8A] bg-[#FFF9E9] p-4 text-sm leading-6 text-[#594820]">
        <strong>Document de base à compléter avant publication.</strong> Les passages entre crochets et les
        informations sur les prestataires, les durées de conservation et les transferts doivent être confirmés
        selon les pratiques réelles de TerangaSN. Ce texte ne constitue pas un avis juridique ni une déclaration
        de conformité validée.
      </div>
      <article className="rounded-3xl border border-[#E9E5DC] bg-white p-5 shadow-sm sm:p-8">
        <PrivacyPolicyContent />
      </article>
    </div>
  </div>
);

export default PrivacyPolicyPage;
