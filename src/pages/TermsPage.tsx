import React from 'react';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import { TermsContent } from '@/src/components/TermsContent';

interface TermsPageProps {
  onBack: () => void;
  onHostTerms: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack, onHostTerms }) => (
  <div className="min-h-screen bg-[#F7F5EF] text-[#30352F]">
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#193E30] hover:underline">
        <ArrowLeft size={17} aria-hidden="true" /> Retour
      </button>
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#EDF1EB] px-3 py-1.5 text-xs font-bold text-[#193E30]">
          <FileText size={15} aria-hidden="true" /> Conditions générales
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-[#193E30] sm:text-4xl">Conditions générales d’utilisation – TerangaSN</h1>
        <p className="mt-3 text-sm text-[#667268]">Dernière mise à jour : 24 septembre 2026</p>
      </header>
      <article className="rounded-3xl border border-[#E9E5DC] bg-white p-5 shadow-sm sm:p-8">
        <TermsContent />
        <div className="mt-8 border-t border-[#E9E5DC] pt-6">
          <button type="button" onClick={onHostTerms} className="inline-flex items-center gap-2 text-sm font-semibold text-[#193E30] hover:underline">
            Consulter les conditions supplémentaires pour les hôtes <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </article>
    </div>
  </div>
);

export default TermsPage;
