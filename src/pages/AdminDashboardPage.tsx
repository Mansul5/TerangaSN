import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Building2, 
  Users, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Trash2, 
  Star, 
  Loader2, 
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Check,
  EyeOff
} from 'lucide-react';
import { Hotel, Booking, Review, Profile } from '@/src/types';
import { fetchAdminStats, fetchHotels, fetchHotelReviews, updateHotel, deleteHotel } from '@/src/lib/supabase/api';
import { formatFCFA, formatDate, getCategoryLabel } from '@/src/lib/formatters';
import { useAuth } from '@/src/context/AuthContext';

interface AdminDashboardPageProps {
  onOpenAuth: () => void;
  onOpenSupabaseModal: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onOpenAuth,
  onOpenSupabaseModal,
}) => {
  const { user, role } = useAuth();

  const [stats, setStats] = useState<{
    totalHotels: number;
    totalBookings: number;
    totalVolume: number;
    totalCommission: number;
    pendingBookings: number;
  }>({
    totalHotels: 0,
    totalBookings: 0,
    totalVolume: 0,
    totalCommission: 0,
    pendingBookings: 0,
  });

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'hotels'>('overview');

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, hotelsRes] = await Promise.all([
        fetchAdminStats(),
        fetchHotels({}),
      ]);
      setStats(statsRes);
      setHotels(hotelsRes.data || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleTogglePublish = async (hotel: Hotel) => {
    try {
      const newStatus = !hotel.is_published;
      const { error } = await updateHotel(hotel.id, { is_published: newStatus });
      if (error) throw error;
      setHotels(prev => prev.map(h => h.id === hotel.id ? { ...h, is_published: newStatus } : h));
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDeleteHotel = async (hotelId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet établissement ?')) return;
    try {
      const { error } = await deleteHotel(hotelId);
      if (error) throw error;
      setHotels(prev => prev.filter(h => h.id !== hotelId));
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-20">
      
      {/* Header */}
      <div className="bg-[#3F6212] text-white px-4 sm:px-6 py-6 shadow-xs border-b border-[#365314]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] animate-pulse" />
              <span className="text-xs font-bold text-[#E6E2D3] uppercase tracking-widest">
                Administration Plateforme
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold mt-1">
              Supervision Teranga Booking Sénégal
            </h1>
          </div>

          <button
            type="button"
            onClick={onOpenSupabaseModal}
            className="px-3.5 py-2 bg-[#2D450D] hover:bg-[#23370A] text-[#FAF9F6] border border-[#4D7C0F] text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
          >
            <span>Schéma & Clés Supabase</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* KPI Platform Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[#6B6658]">
              <span className="text-xs font-bold uppercase tracking-wider">Volume d'Affaires Brut</span>
              <div className="w-8 h-8 rounded-lg bg-[#ECF3E5] text-[#3F6212] flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#2D2A26]">
              {formatFCFA(stats.totalVolume)}
            </p>
            <p className="text-[11px] text-[#8C887D]">Total réservations brutes</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[#6B6658]">
              <span className="text-xs font-bold uppercase tracking-wider">Commissions Plateforme (10%)</span>
              <div className="w-8 h-8 rounded-lg bg-[#F0EDE4] text-[#8B5E34] flex items-center justify-center">
                <Percent size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#8B5E34]">
              {formatFCFA(stats.totalCommission)}
            </p>
            <p className="text-[11px] text-[#8C887D]">Revenus nets Teranga Booking</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[#6B6658]">
              <span className="text-xs font-bold uppercase tracking-wider">Établissements Inscrits</span>
              <div className="w-8 h-8 rounded-lg bg-[#ECF3E5] text-[#3F6212] flex items-center justify-center">
                <Building2 size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#2D2A26]">
              {stats.totalHotels} hôtels
            </p>
            <p className="text-[11px] text-[#8C887D]">Toutes régions confondues</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[#6B6658]">
              <span className="text-xs font-bold uppercase tracking-wider">Réservations Globales</span>
              <div className="w-8 h-8 rounded-lg bg-[#F0EDE4] text-[#8B5E34] flex items-center justify-center">
                <Calendar size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#2D2A26]">
              {stats.totalBookings}
            </p>
            <p className="text-[11px] text-[#8C887D]">{stats.pendingBookings} en attente</p>
          </div>

        </div>

        {/* Hotels Moderation Table */}
        <div className="bg-white rounded-2xl border border-[#E6E2D3] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D3]">
            <div>
              <h3 className="font-serif font-bold text-base text-[#2D2A26]">Gestion & Modération des Établissements</h3>
              <p className="text-xs text-[#6B6658]">Activez ou suspendez la visibilité publique d'un hébergement</p>
            </div>
            <span className="text-xs font-bold bg-[#FAF9F6] border border-[#E6E2D3] px-3 py-1 rounded-full text-[#6B6658]">
              {hotels.length} hébergements
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="animate-spin text-[#3F6212] mx-auto" size={32} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] text-[#6B6658] uppercase font-bold border-b border-[#E6E2D3]">
                  <tr>
                    <th className="px-4 py-3">Établissement</th>
                    <th className="px-4 py-3">Région / Ville</th>
                    <th className="px-4 py-3">Catégorie</th>
                    <th className="px-4 py-3">Note / Avis</th>
                    <th className="px-4 py-3">Statut Publication</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E2D3]">
                  {hotels.map((h) => (
                    <tr key={h.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="px-4 py-3">
                        <span className="font-bold text-[#2D2A26] block">{h.name}</span>
                        <span className="text-[11px] text-[#8C887D] truncate max-w-xs block">{h.address}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#2D2A26]">{h.city}</span>
                        <span className="text-[11px] text-[#6B6658] block">{h.region}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#3F6212]">
                        {getCategoryLabel(h.category)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-serif font-bold text-[#8B5E34]">{h.rating?.toFixed(1) || '8.5'} / 10</span>
                        <span className="text-[11px] text-[#8C887D] block">{h.reviews_count || 0} avis</span>
                      </td>
                      <td className="px-4 py-3">
                        {h.is_published ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECF3E5] text-[#3F6212] border border-[#D1DBC2]">
                            En ligne
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF9F6] text-[#6B6658] border border-[#E6E2D3]">
                            Suspendu / Masqué
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(h)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                              h.is_published 
                                ? 'bg-[#F0EDE4] text-[#8B5E34] hover:bg-[#E6E2D3] border border-[#E6E2D3]' 
                                : 'bg-[#3F6212] text-white hover:bg-[#365314]'
                            }`}
                          >
                            {h.is_published ? 'Masquer' : 'Mettre en ligne'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHotel(h.id)}
                            className="p-1 text-[#8C887D] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
