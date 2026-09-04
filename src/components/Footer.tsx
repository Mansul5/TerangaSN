import React from 'react';
import { MapPin, ShieldCheck, HeartHandshake, PhoneCall, Sparkles } from 'lucide-react';
import { SENEGAL_REGIONS } from '@/src/types';

interface FooterProps {
  onSelectRegion: (regionName: string) => void;
  onOpenSupabaseModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectRegion, onOpenSupabaseModal }) => {
  return (
    <footer className="bg-[#2D2A26] text-[#D9D5C3] pt-14 pb-10 border-t border-[#3F3B35]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Teranga Value Props */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12 border-b border-[#3F3B35]">
          <div className="flex items-start gap-4 bg-[#39352F] p-5 rounded-2xl border border-[#48433C]">
            <div className="w-10 h-10 rounded-xl bg-[#ECF3E5] text-[#3F6212] flex items-center justify-center shrink-0 shadow-sm">
              <HeartHandshake size={20} />
            </div>
            <div>
              <h4 className="text-white font-serif font-bold text-base">L'Esprit de la Teranga</h4>
              <p className="text-xs text-[#B5B0A1] mt-1 leading-relaxed">
                Hospitalité chaleureuse sénégalaise. Réservation authentique en direct avec les hébergeurs locaux.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-[#39352F] p-5 rounded-2xl border border-[#48433C]">
            <div className="w-10 h-10 rounded-xl bg-[#F0EDE4] text-[#8B5E34] flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-white font-serif font-bold text-base">Paiement sur place à l'arrivée</h4>
              <p className="text-xs text-[#B5B0A1] mt-1 leading-relaxed">
                Aucune carte bancaire requise. Réglez en espèces (FCFA), Wave ou Orange Money directement à l'hôtel.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-[#39352F] p-5 rounded-2xl border border-[#48433C]">
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center shrink-0 shadow-sm">
              <PhoneCall size={20} />
            </div>
            <div>
              <h4 className="text-white font-serif font-bold text-base">Accompagnement Local</h4>
              <p className="text-xs text-[#B5B0A1] mt-1 leading-relaxed">
                Assistance pour vos séjours à Dakar, Saly, Casamance, Saint-Louis, Sine Saloum et tout le Sénégal.
              </p>
            </div>
          </div>
        </div>

        {/* Regions and Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-b border-[#3F3B35] text-xs">
          
          <div>
            <h5 className="font-serif font-bold text-white uppercase tracking-wider mb-3.5 text-sm">
              Destinations phares
            </h5>
            <ul className="space-y-2 text-[#B5B0A1]">
              {SENEGAL_REGIONS.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <button 
                    onClick={() => onSelectRegion(r.name)}
                    className="hover:text-amber-300 transition cursor-pointer text-left"
                  >
                    Hôtels & Lodges à {r.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="font-serif font-bold text-white uppercase tracking-wider mb-3.5 text-sm">
              Nature & Écotourisme
            </h5>
            <ul className="space-y-2 text-[#B5B0A1]">
              {SENEGAL_REGIONS.slice(4).map((r) => (
                <li key={r.id}>
                  <button 
                    onClick={() => onSelectRegion(r.name)}
                    className="hover:text-amber-300 transition cursor-pointer text-left"
                  >
                    Séjours à {r.name}
                  </button>
                </li>
              ))}
              <li>
                <button 
                  onClick={() => onSelectRegion('Somone')}
                  className="hover:text-amber-300 transition cursor-pointer text-left"
                >
                  Lagune de la Somone
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-serif font-bold text-white uppercase tracking-wider mb-3.5 text-sm">
              Types d'Hébergements
            </h5>
            <ul className="space-y-2 text-[#B5B0A1]">
              <li><span>Hôtels de luxe & Resorts</span></li>
              <li><span>Écolodges & Bolongs</span></li>
              <li><span>Campements traditionnels</span></li>
              <li><span>Résidences meublées & Villas</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-serif font-bold text-white uppercase tracking-wider mb-3.5 text-sm">
              Espace Hôtelier & Données
            </h5>
            <ul className="space-y-2 text-[#B5B0A1]">
              <li><span>Inscrire mon hébergement</span></li>
              <li><span>Gestion des disponibilités</span></li>
              <li><span>Tarifs et réservations directes</span></li>
              <li>
                <button
                  onClick={onOpenSupabaseModal}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 transition"
                >
                  <Sparkles size={14} />
                  <span>Schéma Supabase & SQL</span>
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8C887D] gap-4">
          <p>© {new Date().getFullYear()} Teranga Booking Sénégal. Tous droits réservés.</p>
          <p className="flex items-center gap-2 text-[#B5B0A1]">
            <span>Teranga & Sérénité au pays de la Teranga</span>
            <span>🇸🇳</span>
          </p>
        </div>

      </div>
    </footer>
  );
};
