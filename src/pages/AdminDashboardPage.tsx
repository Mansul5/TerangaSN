import React, { useEffect, useMemo, useState } from 'react';

import {

  AlertTriangle,

  BarChart3,

  Building2,

  CalendarDays,

  CheckCircle2,

  ChevronRight,

  CircleDollarSign,

  Clock3,

  Gavel,

  LayoutDashboard,

  Loader2,

  MessageSquareText,

  Percent,

  RefreshCw,

  Search,

  Settings,

  ShieldAlert,

  ShieldCheck,

  Star,

  Users,

  WalletCards,

  XCircle,

} from 'lucide-react';



import { Lodging, Review } from '@/src/types';

import {

  fetchAdminStats,

  fetchAllHotelsAdmin,

  fetchAllReviewsAdmin,

  fetchHotelReviewDossier,
  approveHotelDossier,
  rejectHotelDossier,

  updateReviewStatus,

} from '@/src/lib/supabase/api';

import { formatFCFA, formatDate, getCategoryLabel } from '@/src/lib/formatters';

import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase/client';



interface AdminDashboardPageProps {

  onOpenAuth: () => void;

  onOpenSupabaseModal: () => void;
  onReturnToSite: () => void;

}



type AdminSection =

  | 'overview'
  | 'analytics'

  | 'lodgings'

  | 'users'

  | 'bookings'

  | 'reports'

  | 'finances'

  | 'reviews'

  | 'settings'
  | 'assistance'
  | 'team';



type AdminStats = {

  totalHotels: number;

  totalBookings: number;

  totalVolume: number;

  totalCommission: number;

  pendingBookings: number;

};



const EMPTY_STATS: AdminStats = {

  totalHotels: 0,

  totalBookings: 0,

  totalVolume: 0,

  totalCommission: 0,

  pendingBookings: 0,

};



const sectionLabels: Record<AdminSection, string> = {

  overview: "Vue d'ensemble",
  analytics: "Statistiques avancées",

  lodgings: 'Hébergements',

  users: 'Utilisateurs',

  bookings: 'Réservations',

  reports: 'Direction / Supervision administrative',

  finances: 'Finances & abonnements',

  reviews: 'Avis & modération',

  settings: 'Paramètres',
  assistance: 'Centre d’assistance',
  team: 'Équipe & permissions',

};



const navItems: Array<{

  id: AdminSection;

  label: string;

  icon: React.ElementType;

}> = [

  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },

  { id: 'lodgings', label: 'Hébergements', icon: Building2 },

  { id: 'bookings', label: 'Réservations', icon: CalendarDays },

  { id: 'users', label: 'Utilisateurs', icon: Users },

  { id: 'reviews', label: 'Avis & modération', icon: MessageSquareText },

  { id: 'assistance', label: 'Centre d’assistance', icon: MessageSquareText },

  { id: 'finances', label: 'Finances & abonnements', icon: WalletCards },

  { id: 'reports', label: 'Direction / Supervision administrative', icon: BarChart3 },

  { id: 'team', label: 'Équipe & permissions', icon: Users },

  { id: 'settings', label: 'Paramètres', icon: Settings },

];

const sectionPermissions: Partial<Record<AdminSection, string>> = {
  analytics: 'supervision',
  lodgings: 'verification',
  users: 'users',
  bookings: 'bookings',
  reports: 'supervision',
  finances: 'finance',
  reviews: 'moderation',
  settings: 'settings',
  assistance: 'support',
};



const cx = (...classes: Array<string | false | null | undefined>) =>

  classes.filter(Boolean).join(' ');



const getErrorMessage = (error: unknown) => {

  if (error instanceof Error) return error.message;

  if (typeof error === 'string') return error;

  return 'Une erreur inattendue est survenue.';

};



const getLodgingStatusLabel = (status: Lodging['status']) => {

  // Les statuts approved/unpublished existent dans Supabase,
  // mais ne figurent pas encore dans l'union TypeScript historique.
  switch (String(status)) {

    case 'published':

      return 'Publié';

    case 'approved':

      return 'Approuvé · à publier par l’hôte';

    case 'unpublished':

      return 'Dépublié';

    case 'pending':

      return 'À valider';

    case 'rejected':

      return 'Rejeté';

    case 'draft':

      return 'Brouillon';

    default:

      return status;

  }

};



const getReviewStatusLabel = (status: Review['status']) => {

  switch (status) {

    case 'approved':

      return 'Approuvé';

    case 'pending':

      return 'À modérer';

    case 'rejected':

      return 'Rejeté';

    default:

      return status;

  }

};



const getStatusClasses = (status: string) => {

  if (status === 'published' || status === 'approved') {

    return 'border-[#C8D9CD] bg-[#E9F1EA] text-[#284C3B]';

  }

  if (status === 'pending') {

    return 'border-amber-200 bg-amber-50 text-amber-800';

  }

  if (status === 'rejected') {

    return 'border-rose-200 bg-rose-50 text-rose-700';

  }

  return 'border-[#E9E2D5] bg-[#F7F5EF] text-[#647267]';

};



const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({

  onOpenAuth,

  onOpenSupabaseModal,
  onReturnToSite,

}) => {

  const { user, role, hasAdminStaffAccess, adminStaffPermissions, adminStaffPresence, setAdminStaffPresence } = useAuth();
  const isAdministrator = role === 'admin';
  const canUseSupport = hasAdminStaffAccess
    && (adminStaffPermissions.includes('support') || adminStaffPermissions.includes('disputes'));
  const visibleNavItems = isAdministrator
    ? navItems
    : navItems.filter(item => {
      if (item.id === 'assistance') return canUseSupport;
      const requiredPermission = sectionPermissions[item.id];
      return Boolean(requiredPermission && adminStaffPermissions.includes(requiredPermission));
    });
  const firstAllowedSection: AdminSection = visibleNavItems[0]?.id || 'overview';



  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    try {
      const saved = window.sessionStorage.getItem('terangasn.adminSection.v1');
      return saved && visibleNavItems.some(item => item.id === saved)
        ? saved as AdminSection : firstAllowedSection;
    } catch { return 'overview'; }
  });
  useEffect(() => {
    if (!visibleNavItems.some(item => item.id === activeSection)) {
      setActiveSection(firstAllowedSection);
    }
    try { window.sessionStorage.setItem('terangasn.adminSection.v1', activeSection); }
    catch { /* stockage indisponible */ }
  }, [activeSection, firstAllowedSection, visibleNavItems]);

  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);

  const [lodgings, setLodgings] = useState<Lodging[]>([]);

  const [reviews, setReviews] = useState<Review[]>([]);

  // Consultation administrative en lecture seule : pas de mutation sensible implicite.
  const [adminBookings, setAdminBookings] = useState<any[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<any[]>([]);
  const [adminPlans, setAdminPlans] = useState<any[]>([]);
  const [adminSubscriptions, setAdminSubscriptions] = useState<any[]>([]);
  const [adminSubscriptionRequests, setAdminSubscriptionRequests] = useState<any[]>([]);
  const [adminInvoices, setAdminInvoices] = useState<any[]>([]);
  const [adminPayments, setAdminPayments] = useState<any[]>([]);
  const [adminEnterpriseContracts, setAdminEnterpriseContracts] = useState<any[]>([]);
  const [bookingLoadError, setBookingLoadError] = useState('');
  const [profileLoadError, setProfileLoadError] = useState('');
  const [financeLoadError, setFinanceLoadError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingOrigin, setBookingOrigin] = useState('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [profileSearch, setProfileSearch] = useState('');
  const [openedBooking, setOpenedBooking] = useState<string | null>(null);
  const [openedProfile, setOpenedProfile] = useState<string | null>(null);
  const [enterpriseOwnerId, setEnterpriseOwnerId] = useState('');
  const [enterpriseAmount, setEnterpriseAmount] = useState('0');
  const [enterpriseCommission, setEnterpriseCommission] = useState('0');
  const [enterpriseStartDate, setEnterpriseStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [enterpriseEndDate, setEnterpriseEndDate] = useState('');
  const [enterpriseTerms, setEnterpriseTerms] = useState('');
  const [enterprisePaymentContractId, setEnterprisePaymentContractId] = useState('');
  const [enterprisePaymentAmount, setEnterprisePaymentAmount] = useState('');
  const [enterprisePaymentReference, setEnterprisePaymentReference] = useState('');
  const [paymentAccountHolder, setPaymentAccountHolder] = useState('');
  const [paymentBankName, setPaymentBankName] = useState('');
  const [paymentAccountReference, setPaymentAccountReference] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [financeActionBusy, setFinanceActionBusy] = useState(false);
  const [financeActionNotice, setFinanceActionNotice] = useState('');
  const [subscriptionProofLinks, setSubscriptionProofLinks] = useState<Record<string, string>>({});

  const loadAdminBookings = async () => {
    setBookingLoading(true);
    setBookingLoadError('');
    try {
      const { data, error } = await supabase.from('bookings')
        .select('*, hotel:hotels(id,name,city,region), room_type:room_types(id,name)')
        .order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      setAdminBookings(data || []);
    } catch (error) { setBookingLoadError(getErrorMessage(error)); }
    finally { setBookingLoading(false); }
  };

  const loadAdminProfiles = async () => {
    setProfileLoading(true);
    setProfileLoadError('');
    try {
      const { data, error } = await supabase.from('profiles')
        .select('id,full_name,email,phone,role,created_at')
        .order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      setAdminProfiles(data || []);
    } catch (error) { setProfileLoadError(getErrorMessage(error)); }
    finally { setProfileLoading(false); }
  };

  const loadAdminFinance = async () => {
    setFinanceLoading(true);
    setFinanceLoadError('');
    try {
      const [plans, subscriptions, requests, invoices, payments, contracts, instructions] = await Promise.all([
        supabase.from('saas_plans')
          .select('code,label,monthly_price_xof,marketplace_commission_pct,max_active_lodgings,max_collaborators')
          .order('monthly_price_xof', {ascending:true,nullsFirst:false}),
        supabase.from('owner_subscriptions')
          .select('owner_id,plan_code,status,current_period_start,current_period_end,custom_marketplace_commission_pct,custom_max_active_lodgings,custom_max_collaborators')
          .order('current_period_end', {ascending:true,nullsFirst:false}).limit(1000),
        supabase.from('subscription_change_requests')
          .select('id,owner_id,reference,amount_xof,proof_path,status,submitted_at,proof_submitted_at,reviewed_at,review_note')
          .order('submitted_at', {ascending:false}).limit(1000),
        supabase.from('subscription_invoices')
          .select('id,owner_id,enterprise_contract_id,invoice_number,invoice_type,amount_xof,status,issued_at,paid_at')
          .order('issued_at', {ascending:false}).limit(1000),
        supabase.from('subscription_payments')
          .select('id,invoice_id,payment_reference,confirmed_at,confirmed_by')
          .order('confirmed_at', {ascending:false}).limit(1000),
        supabase.from('enterprise_contracts')
          .select('id,owner_id,contract_reference,status,monthly_amount_xof,marketplace_commission_pct,starts_at,ends_at,terms')
          .order('created_at', {ascending:false}).limit(1000),
        supabase.from('subscription_payment_instructions')
          .select('account_holder,bank_name,account_reference,instructions').eq('id', 1).maybeSingle(),
      ]);
      if (plans.error) throw plans.error;
      if (subscriptions.error) throw subscriptions.error;
      if (requests.error) throw requests.error;
      if (invoices.error) throw invoices.error;
      if (payments.error) throw payments.error;
      if (contracts.error) throw contracts.error;
      if (instructions.error) throw instructions.error;
      setAdminPlans(plans.data || []);
      setAdminSubscriptions(subscriptions.data || []);
      setAdminSubscriptionRequests(requests.data || []);
      setAdminInvoices(invoices.data || []);
      setAdminPayments(payments.data || []);
      setAdminEnterpriseContracts(contracts.data || []);
      setPaymentAccountHolder(instructions.data?.account_holder || '');
      setPaymentBankName(instructions.data?.bank_name || '');
      setPaymentAccountReference(instructions.data?.account_reference || '');
      setPaymentInstructions(instructions.data?.instructions || '');
    } catch (error) {
      setFinanceLoadError(getErrorMessage(error));
    } finally {
      setFinanceLoading(false);
    }
  };

  const reviewBusinessRequest = async (requestId: string, approve: boolean) => {
    const request = adminSubscriptionRequests.find(item => item.id === requestId);
    if (!request || request.status !== 'pending') return;
    if (approve && !window.confirm(`Confirmez-vous que le virement de 39 900 FCFA (référence ${request.reference}) a bien été reçu sur le compte officiel TerangaSN ?`)) return;
    setFinanceActionBusy(true);
    setFinanceActionNotice('');
    setFinanceLoadError('');
    try {
      const { error } = await supabase.rpc('admin_review_business_subscription', {
        p_request_id: requestId,
        p_approve: approve,
        p_note: approve ? 'Paiement vérifié par l’équipe finance.' : 'Justificatif ou paiement non validé.',
      });
      if (error) throw error;
      setFinanceActionNotice(approve ? 'Paiement confirmé : la facture a été émise et la formule Business activée.' : 'Demande refusée ; la formule du compte reste inchangée.');
      await loadAdminFinance();
    } catch (actionError) {
      setFinanceLoadError(getErrorMessage(actionError));
    } finally {
      setFinanceActionBusy(false);
    }
  };

  const openSubscriptionProof = async (path: string) => {
    setFinanceLoadError('');
    try {
      const { data, error } = await supabase.storage
        .from('subscription-proofs')
        .createSignedUrl(path, 300);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Lien temporaire du justificatif indisponible.');
      setSubscriptionProofLinks(previous => ({ ...previous, [path]: data.signedUrl }));
    } catch (proofError) {
      setFinanceLoadError(getErrorMessage(proofError));
    }
  };

  const createEnterpriseContract = async (event: React.FormEvent) => {
    event.preventDefault();
    setFinanceActionBusy(true);
    setFinanceActionNotice('');
    setFinanceLoadError('');
    try {
      const { error } = await supabase.rpc('admin_create_enterprise_contract', {
        p_owner_id: enterpriseOwnerId.trim(),
        p_monthly_amount_xof: Number(enterpriseAmount),
        p_marketplace_commission_pct: Number(enterpriseCommission),
        p_starts_at: new Date(`${enterpriseStartDate}T00:00:00`).toISOString(),
        p_ends_at: enterpriseEndDate ? new Date(`${enterpriseEndDate}T00:00:00`).toISOString() : null,
        p_terms: enterpriseTerms.trim(),
      });
      if (error) throw error;
      setEnterpriseOwnerId('');
      setEnterpriseTerms('');
      setFinanceActionNotice('Contrat Enterprise enregistré et formule associée mise à jour.');
      await loadAdminFinance();
    } catch (actionError) {
      setFinanceLoadError(getErrorMessage(actionError));
    } finally {
      setFinanceActionBusy(false);
    }
  };

  const recordEnterprisePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setFinanceActionBusy(true);
    setFinanceActionNotice('');
    setFinanceLoadError('');
    try {
      const { error } = await supabase.rpc('admin_record_enterprise_payment', {
        p_contract_id: enterprisePaymentContractId,
        p_amount_xof: Number(enterprisePaymentAmount),
        p_payment_reference: enterprisePaymentReference.trim(),
      });
      if (error) throw error;
      setEnterprisePaymentContractId('');
      setEnterprisePaymentAmount('');
      setEnterprisePaymentReference('');
      setFinanceActionNotice('Paiement Enterprise enregistré ; sa facture payée est intégrée aux encaissements généraux.');
      await loadAdminFinance();
    } catch (actionError) {
      setFinanceLoadError(getErrorMessage(actionError));
    } finally {
      setFinanceActionBusy(false);
    }
  };

  const savePaymentInstructions = async (event: React.FormEvent) => {
    event.preventDefault();
    setFinanceActionBusy(true);
    setFinanceActionNotice('');
    setFinanceLoadError('');
    try {
      const { error } = await supabase.rpc('admin_set_business_payment_instructions', {
        p_account_holder: paymentAccountHolder.trim(),
        p_bank_name: paymentBankName.trim(),
        p_account_reference: paymentAccountReference.trim(),
        p_instructions: paymentInstructions.trim(),
      });
      if (error) throw error;
      setFinanceActionNotice('Coordonnées officielles de paiement enregistrées.');
      await loadAdminFinance();
    } catch (actionError) {
      setFinanceLoadError(getErrorMessage(actionError));
    } finally {
      setFinanceActionBusy(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (activeSection === 'bookings' && (isAdministrator || adminStaffPermissions.includes('bookings'))) void loadAdminBookings();
    if (activeSection === 'users' && (isAdministrator || adminStaffPermissions.includes('users'))) void loadAdminProfiles();
    if (activeSection === 'finances' && (isAdministrator || adminStaffPermissions.includes('finance'))) void loadAdminFinance();
    if (activeSection === 'lodgings' && !isAdministrator && adminStaffPermissions.includes('verification')) {
      void fetchAllHotelsAdmin().then(result => {
        if (result.error) setErrorMessage(result.error.message);
        else setLodgings(result.data || []);
      });
    }
    if (activeSection === 'reviews' && !isAdministrator && adminStaffPermissions.includes('moderation')) {
      void fetchAllReviewsAdmin().then(result => {
        if (result.error) setErrorMessage(result.error.message);
        else setReviews(result.data || []);
      });
    }
  }, [activeSection, user?.id, role, adminStaffPermissions]);

  // Une origine absente ne constitue PAS une réservation marketplace.
  const bookingSource = (booking: any): 'manual' | 'marketplace' | 'direct' | 'unknown' => {
    const value = String(booking.source ?? booking.booking_source ?? booking.origin ?? '').toLowerCase().trim();
    if (booking.is_manual === true || booking.manual_channel || ['manual','manuel','telephone','phone','whatsapp','sur_place','walk_in'].includes(value)) return 'manual';
    if (['marketplace','platform','terangasn'].includes(value)) return 'marketplace';
    if (['direct','direct_link','lien_direct'].includes(value)) return 'direct';
    return 'unknown';
  };
  const sourceName = (value: ReturnType<typeof bookingSource>) =>
    ({manual:'Manuelle', marketplace:'Marketplace', direct:'Lien direct', unknown:'Origine non renseignée'})[value];


  // Assistance interne : les autorisations sont vérifiées par les règles RLS.
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<any[]>([]);
  const [caseSanctions, setCaseSanctions] = useState<any[]>([]);
  const [supportRatings, setSupportRatings] = useState<any[]>([]);
  const [supportPerformance, setSupportPerformance] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [supportError, setSupportError] = useState('');
  const [presenceError, setPresenceError] = useState('');
  const [governanceError, setGovernanceError] = useState('');
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [supportNotice, setSupportNotice] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportSearch, setSupportSearch] = useState('');
  const [supportStatusFilter, setSupportStatusFilter] = useState('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportAttachments, setSupportAttachments] = useState<any[]>([]);
  const [supportRequester, setSupportRequester] = useState<any | null>(null);
  const [newMessageBody, setNewMessageBody] = useState('');
  const [newMessageInternal, setNewMessageInternal] = useState(true);
  const [newSanctionTargetId, setNewSanctionTargetId] = useState('');
  const [newSanctionType, setNewSanctionType] = useState('warning');
  const [newSanctionReason, setNewSanctionReason] = useState('');
  const [newSanctionAmount, setNewSanctionAmount] = useState('');
  const [newSanctionEndsAt, setNewSanctionEndsAt] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');

  const loadInternalSupport = async () => {
    setSupportError('');
    const canReadSanctions = isAdministrator || adminStaffPermissions.includes('disputes');
    const canReadSupportMetrics = isAdministrator || adminStaffPermissions.includes('support');
    const [t, a, r, p, s] = await Promise.all([
      supabase.from('support_tickets').select('*').order('created_at', {ascending:false}).limit(500),
      isAdministrator
        ? supabase.from('admin_staff_members').select('*').order('created_at', {ascending:false}).limit(200)
        : Promise.resolve({ data: [], error: null }),
      canReadSupportMetrics
        ? supabase.from('support_ticket_ratings').select('ticket_id,rated_by,rating,comment,created_at').order('created_at', {ascending:false}).limit(1000)
        : Promise.resolve({ data: [], error: null }),
      canReadSupportMetrics
        ? supabase.rpc('get_support_agent_performance')
        : Promise.resolve({ data: [], error: null }),
      canReadSanctions ? supabase.from('admin_sanctions')
        .select('id,support_ticket_id,target_user_id,sanction_type,reason,amount_xof,starts_at,ends_at,created_by,created_at')
        .order('created_at', {ascending:false}).limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (t.error || a.error || r.error || p.error || s.error) { setSupportError((t.error || a.error || r.error || p.error || s.error)?.message || 'Chargement impossible'); return; }
    setSupportTickets(t.data || []);
    setStaffAssignments(a.data || []);
    setSupportRatings(r.data || []);
    setSupportPerformance(p.data || []);
    setCaseSanctions(s.data || []);
  };
  const loadGovernanceData = async () => {
    setGovernanceLoading(true);
    setGovernanceError('');
    try {
      const [logs, sanctions] = await Promise.all([
        isAdministrator
          ? supabase.from('admin_audit_logs')
            .select('id,actor_id,actor_name,action,entity_type,entity_id,support_ticket_id,old_data,new_data,reason,created_at')
            .order('created_at', {ascending:false}).limit(200)
          : Promise.resolve({ data: [], error: null }),
        (isAdministrator || adminStaffPermissions.includes('disputes')) ? supabase.from('admin_sanctions')
          .select('id,support_ticket_id,target_user_id,sanction_type,reason,amount_xof,starts_at,ends_at,created_by,created_at')
          .order('created_at',{ascending:false}).limit(500)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (logs.error) throw logs.error;
      if (sanctions.error) throw sanctions.error;
      setAuditLogs(logs.data || []);
      setCaseSanctions(sanctions.data || []);
    } catch (error) {
      setGovernanceError(getErrorMessage(error));
    } finally {
      setGovernanceLoading(false);
    }
  };
  useEffect(() => {
    if (user && (role === 'admin' || canUseSupport) && (activeSection === 'assistance' || activeSection === 'team')) void loadInternalSupport();
  }, [activeSection,role,user?.id,canUseSupport,adminStaffPermissions]);
  useEffect(() => {
    if (user && (role === 'admin' || adminStaffPermissions.includes('supervision')) && activeSection === 'reports') void loadGovernanceData();
  }, [activeSection,role,user?.id,adminStaffPermissions]);
  useEffect(() => {
    if (!selectedTicketId || activeSection !== 'assistance') {
      setSupportMessages([]);
      setSupportAttachments([]);
      setSupportRequester(null);
      return;
    }
    let active = true;
    void Promise.all([
      supabase.from('support_ticket_messages').select('*').eq('ticket_id',selectedTicketId)
        .order('created_at',{ascending:true}),
      supabase.from('support_ticket_attachments').select('id,storage_path,file_name,content_type,file_size,created_at')
        .eq('ticket_id',selectedTicketId).order('created_at',{ascending:true}),
      supabase.rpc('get_support_requester_details', { p_ticket_id: selectedTicketId }),
    ]).then(([messages,attachments,requester]) => {
      if (!active) return;
      if (messages.error || attachments.error || requester.error) setSupportError((messages.error || attachments.error || requester.error)?.message || 'Chargement du dossier impossible.');
      else {
        setSupportMessages(messages.data || []);
        setSupportAttachments(attachments.data || []);
        setSupportRequester(requester.data);
      }
    }).catch(error => {
      if (active) setSupportError(getErrorMessage(error));
    });
    return () => {active=false};
  }, [selectedTicketId,activeSection]);
  const supportAction = async (work: () => Promise<{error:any}>, done: string) => {
    if (supportBusy) return;
    setSupportBusy(true);setSupportError('');setSupportNotice('');
    try { const result=await work(); if (result.error) throw result.error;
      setSupportNotice(done); await loadInternalSupport();
      if (selectedTicketId) {
        const [messages,attachments]=await Promise.all([
          supabase.from('support_ticket_messages').select('*').eq('ticket_id',selectedTicketId).order('created_at',{ascending:true}),
          supabase.from('support_ticket_attachments').select('id,storage_path,file_name,content_type,file_size,created_at').eq('ticket_id',selectedTicketId).order('created_at',{ascending:true}),
        ]);
        if (messages.error || attachments.error) setSupportError((messages.error || attachments.error)?.message || 'Actualisation du dossier impossible.');
        else {
          setSupportMessages(messages.data || []);
          setSupportAttachments(attachments.data || []);
        }
      }
    } catch(e) {setSupportError(getErrorMessage(e));} finally {setSupportBusy(false);}
  };

  const [isLoading, setIsLoading] = useState(role === 'admin');

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  const [notice, setNotice] = useState('');

  const [lodgingSearch, setLodgingSearch] = useState('');

  const [lodgingStatus, setLodgingStatus] = useState<'all' | Lodging['status']>('all');

  const [reviewSearch, setReviewSearch] = useState('');

  const [reviewStatus, setReviewStatus] = useState<'all' | Review['status']>('all');

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedDossier, setSelectedDossier] = useState<Lodging | null>(null);
  const [legalDossier, setLegalDossier] = useState<any | null>(null);
  const [legalDocuments, setLegalDocuments] = useState<any[]>([]);
  const [legalRequirements, setLegalRequirements] = useState<any[]>([]);
  const [legalError, setLegalError] = useState('');
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalOpening, setLegalOpening] = useState<string | null>(null);
  const [legalAction, setLegalAction] = useState<null | { type: 'document' | 'dossier'; id: string; label: string; decision: 'verified' | 'rejected' | 'changes_requested' }>(null);
  const [legalDecisionNote, setLegalDecisionNote] = useState('');
  const [legalBusy, setLegalBusy] = useState(false);
  const [legalHistory, setLegalHistory] = useState<any[]>([]);
  const [legalDocumentHistory, setLegalDocumentHistory] = useState<any[]>([]);
  const [legalNotice, setLegalNotice] = useState('');
  const [galleryType, setGalleryType] = useState<string | null>(null);
  const [galleryDocumentId, setGalleryDocumentId] = useState<string | null>(null);
  const [galleryUrl, setGalleryUrl] = useState<string | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [galleryReviewedDocumentId, setGalleryReviewedDocumentId] = useState<string | null>(null);
  const openLegalGallery = (type: string) => {
    const docs = legalDocuments.filter((d: any) => d.document_type === type);
    setGalleryReviewedDocumentId(null);
    setGalleryType(type);
    setGalleryDocumentId(docs[0]?.id || null);
    setGalleryUrl(null);
    setGalleryError('');
  };
  useEffect(() => {
    if (!galleryType || !galleryDocumentId) return;
    const doc = legalDocuments.find((d: any) => d.id === galleryDocumentId && d.document_type === galleryType);
    if (!doc) return;
    let active = true;
    setGalleryLoading(true);
    setGalleryReviewedDocumentId(null);
    setGalleryUrl(null);
    setGalleryError('');
    void supabase.storage.from('hotel-legal-documents').createSignedUrl(doc.storage_path, 300).then(({data,error}) => {
      if (!active) return;
      if (error || !data?.signedUrl) setGalleryError(error?.message || 'Impossible de charger cet aperçu.');
      else setGalleryUrl(data.signedUrl);
      setGalleryLoading(false);
    }).catch((e: unknown) => { if (active) { setGalleryError(getErrorMessage(e)); setGalleryLoading(false); } });
    return () => { active = false; };
  }, [galleryType, galleryDocumentId, legalDocuments]);

  const reviewableLegal = legalDossier && ['submitted','under_review'].includes(legalDossier.status);
  const isExpired = (value: unknown) => typeof value === 'string' && value.slice(0,10) < new Date().toISOString().slice(0,10);
  // Un dépôt plus récent remplace l'ancien pour la décision finale, sans effacer l'historique.
  // Les pièces refusées antérieures ne doivent pas bloquer une correction validée.
  const legalLatestDocuments = [...legalDocuments]
    .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id).localeCompare(String(a.id)))
    .filter((document: any, index: number, array: any[]) =>
      array.findIndex((item: any) => item.document_type === document.document_type) === index);
  const legalMissing = legalRequirements.filter((r: any) => r.is_required &&
    !legalLatestDocuments.some((d: any) => d.document_type === r.document_type && d.status === 'verified' && !isExpired(d.document_valid_until)));
  const legalUnreviewed = legalLatestDocuments.filter((d: any) => d.status !== 'verified' || isExpired(d.document_valid_until));
  const legalCanVerify = Boolean(reviewableLegal && legalRequirements.length && legalLatestDocuments.length && !legalMissing.length && !legalUnreviewed.length);
  const legalReviewSteps = [
    { done: Boolean(legalDossier && reviewableLegal), label: 'Dossier soumis et en cours d’examen', info: 'L’hôtelier doit soumettre son dossier avant toute décision.' },
    { done: Boolean(legalRequirements.length), label: 'Liste réglementaire disponible', info: 'Aucune règle active pour ce profil : vérifiez la configuration.' },
    { done: !legalMissing.length && Boolean(legalRequirements.length), label: 'Justificatifs obligatoires couverts', info: `${legalMissing.length} catégorie(s) obligatoire(s) sans pièce courante validée et non expirée.` },
    { done: !legalUnreviewed.length && Boolean(legalLatestDocuments.length), label: 'Toutes les pièces courantes examinées', info: `${legalUnreviewed.length} catégorie(s) encore en attente, refusée(s) ou expirée(s).` },
  ];

  const startLegalDecision = (type: 'document' | 'dossier', id: string, label: string, decision: 'verified' | 'rejected' | 'changes_requested') => {
    setLegalError('');
    setLegalDecisionNote('');
    setLegalAction({ type, id, label, decision });
  };
  const confirmLegalDecision = async () => {
    if (!legalAction || legalBusy) return;
    if (!reviewableLegal || (legalAction.type === 'dossier' && legalAction.decision === 'verified' && !legalCanVerify)) {
      setLegalError('Décision indisponible : réexaminez les exigences et le statut du dossier.');
      return;
    }
    if (legalAction.type === 'document') {
      const target = legalDocuments.find((d: any) => d.id === legalAction.id);
      if (!target || target.status !== 'pending') { setLegalError('Seuls les documents en attente peuvent recevoir une nouvelle décision.'); return; }
      if (galleryReviewedDocumentId !== target.id || !galleryUrl || galleryLoading || galleryError) {
        setLegalError('Ouvrez la pièce dans la galerie et confirmez son examen avant de décider.'); return;
      }
      if (legalAction.decision === 'verified' && isExpired(target.document_valid_until)) {
        setLegalError('Ce justificatif est expiré et ne peut pas être validé.'); return;
      }
    }
    if (legalAction.decision !== 'verified' && legalDecisionNote.trim().length < 10) {
      setLegalError('Veuillez fournir un motif clair de 10 caractères minimum.');
      return;
    }
    setLegalBusy(true);
    setLegalError('');
    try {
      const params = legalAction.type === 'document'
        ? { p_document_id: legalAction.id, p_decision: legalAction.decision, p_reason: legalDecisionNote.trim() || null }
        : { p_dossier_id: legalAction.id, p_decision: legalAction.decision, p_reason: legalDecisionNote.trim() || null };
      const rpcName = legalAction.type === 'document' ? 'admin_review_hotel_document' : 'admin_decide_hotel_legal_dossier';
      const { error } = await supabase.rpc(rpcName, params);
      if (error) throw error;
      const lodgingId = selectedDossier?.id;
      setLegalAction(null);
      setLegalDecisionNote('');
      setGalleryReviewedDocumentId(null);
      // Actualiser les données sans refermer le dossier ni la galerie en cours.
      if (lodgingId) await openDossier(lodgingId, true);
      setLegalNotice('Décision enregistrée et dossier actualisé.');
    } catch (error) {
      setLegalError(getErrorMessage(error));
    } finally {
      setLegalBusy(false);
    }
  };
  const openLegalFile = async (document: any) => {
    setLegalOpening(document.id);
    setLegalError('');
    try {
      const { data, error } = await supabase.storage.from('hotel-legal-documents').createSignedUrl(document.storage_path, 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Lien temporaire indisponible.');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setLegalError(getErrorMessage(error));
    } finally {
      setLegalOpening(null);
    }
  };
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingDecision, setPendingDecision] = useState<{
    kind: 'review';
    id: string;
    name: string;
    status: 'rejected' | 'pending' | 'approved';
  } | null>(null);

  const confirmDecision = async () => {
    if (!pendingDecision || busyAction) return;
    const decision = pendingDecision;
    setPendingDecision(null);
    const review = reviews.find((item) => item.id === decision.id);
    if (review) await handleReviewStatus(review, decision.status as 'approved' | 'rejected' | 'pending');
  };



  const loadAdminData = async (refresh = false) => {

    if (refresh) setIsRefreshing(true);

    else setIsLoading(true);



    setErrorMessage('');



    try {

      const [statsRes, lodgingsRes, reviewsRes] = await Promise.all([

        fetchAdminStats(),

        fetchAllHotelsAdmin(),

        fetchAllReviewsAdmin(),

      ]);



      setStats(statsRes);



      if (lodgingsRes.error) {

        throw lodgingsRes.error;

      }



      if (reviewsRes.error) {

        throw reviewsRes.error;

      }



      setLodgings(lodgingsRes.data || []);

      setReviews(reviewsRes.data || []);

    } catch (error) {

      console.error('Failed to load admin data:', error);

      setErrorMessage(getErrorMessage(error));

    } finally {

      setIsLoading(false);

      setIsRefreshing(false);

    }

  };



  useEffect(() => {

    if (user && role === 'admin') void loadAdminData();
    else setIsLoading(false);

  }, [user?.id, role]);



  useEffect(() => {

    if (!notice) return;

    const timeout = window.setTimeout(() => setNotice(''), 3500);

    return () => window.clearTimeout(timeout);

  }, [notice]);



  const pendingLodgings = useMemo(

    () => lodgings.filter((lodging) => lodging.status === 'pending'),

    [lodgings]

  );



  const publishedLodgings = useMemo(

    () => lodgings.filter((lodging) => lodging.status === 'published'),

    [lodgings]

  );



  const pendingReviews = useMemo(

    () => reviews.filter((review) => review.status === 'pending'),

    [reviews]

  );



  const approvedReviews = useMemo(

    () => reviews.filter((review) => review.status === 'approved'),

    [reviews]

  );



  const rejectedReviews = useMemo(

    () => reviews.filter((review) => review.status === 'rejected'),

    [reviews]

  );



  const filteredLodgings = useMemo(() => {

    const query = lodgingSearch.trim().toLowerCase();



    return lodgings.filter((lodging) => {

      const matchesStatus =

        lodgingStatus === 'all' || lodging.status === lodgingStatus;



      const owner = lodging.owner;

      const haystack = [

        lodging.name,

        lodging.city,

        lodging.region,

        lodging.address,

        owner?.full_name || '',

        owner?.email || '',

        owner?.phone || '',

      ]

        .join(' ')

        .toLowerCase();



      return matchesStatus && (!query || haystack.includes(query));

    });

  }, [lodgings, lodgingSearch, lodgingStatus]);



  const filteredReviews = useMemo(() => {

    const query = reviewSearch.trim().toLowerCase();



    return reviews.filter((review) => {

      const matchesStatus =

        reviewStatus === 'all' || review.status === reviewStatus;



      const haystack = [

        review.guest_name,

        review.comment,

        review.hotel?.name || '',

        review.hotel?.region || '',

      ]

        .join(' ')

        .toLowerCase();



      return matchesStatus && (!query || haystack.includes(query));

    });

  }, [reviews, reviewSearch, reviewStatus]);



  const openDossier = async (lodgingId: string, preserveNavigation = false) => {
    // Une décision sur une pièce n'est pas une navigation : conserver les fenêtres
    // et le défilement pendant la synchronisation des statuts avec Supabase.
    if (!preserveNavigation) {
      setDossierLoading(true);
      setSelectedDossier(null);
      setLegalDossier(null);
      setLegalDocuments([]);
      setLegalRequirements([]);
      setLegalHistory([]);
      setLegalDocumentHistory([]);
      setLegalNotice('');
      setGalleryType(null);
      setGalleryDocumentId(null);
    }
    setLegalLoading(true);
    setDossierError('');
    setLegalError('');
    try {
      const result = await fetchHotelReviewDossier(lodgingId);
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Dossier introuvable.');
      setSelectedDossier(result.data);
      const { data: legal, error: legalQueryError } = await supabase
        .from('hotel_legal_dossiers')
        .select('id,relationship_type,relationship_details,status,submitted_at,reviewed_at,review_note')
        .eq('hotel_id', lodgingId).maybeSingle();
      if (legalQueryError) throw legalQueryError;
      setLegalDossier(legal);
      if (legal) {
        const [docs, requirements, history] = await Promise.all([
          supabase.from('hotel_documents')
            .select('id,document_type,original_filename,storage_path,status,review_note,created_at,document_reference,document_valid_until,document_notes')
            .eq('dossier_id', legal.id).order('created_at', { ascending: false }),
          supabase.from('legal_document_requirements')
            .select('document_type,label_fr,guidance_fr,is_required')
            .eq('relationship_type', legal.relationship_type).eq('is_active', true),
          supabase.from('hotel_legal_dossier_reviews')
            .select('id,decision,reason,reviewer_id,created_at').eq('dossier_id', legal.id).order('created_at', { ascending: false }).limit(40),
        ]);
        if (docs.error) throw docs.error;
        if (requirements.error) throw requirements.error;
        if (history.error) {
          // La migration du journal de dossiers n'est peut-être pas encore appliquée.
          console.warn('Historique juridique indisponible :', history.error.message);
        }
        setLegalDocuments(docs.data || []);
        setLegalRequirements(requirements.data || []);
        setLegalHistory(history.data || []);
        const ids = (docs.data || []).map((d: any) => d.id);
        if (ids.length) {
          const reviews = await supabase.from('hotel_document_reviews')
            .select('id,document_id,reviewer_id,decision,reason,created_at')
            .in('document_id', ids).order('created_at', { ascending: false }).limit(100);
          if (reviews.error) throw reviews.error;
          setLegalDocumentHistory(reviews.data || []);
        }
      }
    } catch (error) {
      if (!preserveNavigation) setDossierError(getErrorMessage(error));
      setLegalError(getErrorMessage(error));
    } finally {
      setDossierLoading(false);
      setLegalLoading(false);
    }
  };

  const decideDossier = async (decision: 'approved' | 'rejected') => {
    if (!selectedDossier || selectedDossier.status !== 'pending' || busyAction) return;
    if (decision === 'approved' && (legalError || !legalDossier || legalDossier.status !== 'verified')) {
      setDossierError('Le dossier juridique doit être vérifié avant toute approbation.');
      return;
    }
    const reason = decision === 'approved'
      ? window.prompt('Indiquez la justification de l’approbation (5 caractères minimum).')?.trim() || ''
      : rejectionReason.trim();
    if (reason.length < 5 || reason.length > 2000) {
      setDossierError('Une justification de décision de 5 à 2000 caractères est obligatoire.');
      return;
    }
    setBusyAction(`lodging-${selectedDossier.id}-${decision}`);
    setDossierError('');
    try {
      const result = decision === 'approved'
        ? await approveHotelDossier(selectedDossier.id, reason)
        : await rejectHotelDossier(selectedDossier.id, reason);
      if (result.error) throw result.error;
      setSelectedDossier(null);
      setRejectionReason('');
      setNotice(decision === 'approved'
        ? 'Dossier approuvé. La publication appartient désormais à l’hébergeur.'
        : 'Dossier rejeté avec motif enregistré.');
      await loadAdminData(true);
    } catch (error) {
      setDossierError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleReviewStatus = async (

    review: Review,

    status: 'approved' | 'rejected' | 'pending'

  ) => {

    const actionKey = `review-${review.id}-${status}`;
    const reason = window.prompt('Indiquez la justification de cette décision de modération (5 caractères minimum).')?.trim();
    if (!reason) return;
    if (reason.length < 5 || reason.length > 2000) {
      setErrorMessage('La justification de modération doit contenir 5 à 2000 caractères.');
      return;
    }

    setBusyAction(actionKey);

    setErrorMessage('');



    try {

      const { error } = await updateReviewStatus(review.id, status, reason);

      if (error) throw error;



      setReviews((current) =>

        current.map((item) =>

          item.id === review.id ? { ...item, status } : item

        )

      );



      setNotice(

        status === 'approved'

          ? 'Avis approuvé.'

          : status === 'rejected'

            ? 'Avis rejeté.'

            : 'Avis replacé dans la file de modération.'

      );

    } catch (error) {

      setErrorMessage(getErrorMessage(error));

    } finally {

      setBusyAction(null);

    }

  };



  if (!user) {

    return (

      <div className="min-h-screen bg-[#F7F5EF] px-3 py-10 sm:px-4 sm:py-16">

        <div className="mx-auto max-w-xl rounded-[26px] border border-[#E9E2D5] bg-white p-5 sm:p-8 text-center shadow-sm">

          <ShieldAlert className="mx-auto text-[#967644]" size={42} />

          <h1 className="mt-4 font-serif text-2xl font-bold text-[#30352F]">

            Espace d'administration

          </h1>

          <p className="mt-2 text-sm leading-6 text-[#647267]">

            Une session administrateur est nécessaire pour accéder à cette console.

          </p>

          <button

            type="button"

            onClick={onOpenAuth}

            className="mt-6 rounded-xl bg-[#193E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1B382D]"

          >

            Se connecter

          </button>

        </div>

      </div>

    );

  }



  if (role !== 'admin' && !hasAdminStaffAccess) {

    return (

      <div className="min-h-screen bg-[#F7F5EF] px-3 py-10 sm:px-4 sm:py-16">

        <div className="mx-auto max-w-xl rounded-[26px] border border-rose-200 bg-white p-5 sm:p-8 text-center shadow-sm">

          <ShieldAlert className="mx-auto text-rose-600" size={42} />

          <h1 className="mt-4 font-serif text-2xl font-bold text-[#30352F]">

            Accès administrateur requis

          </h1>

          <p className="mt-2 text-sm leading-6 text-[#647267]">

            Ce compte n'a pas l'autorisation d'accéder à la console d'administration.

            Les privilèges administrateur doivent être attribués côté serveur.

          </p>

        </div>

      </div>

    );

  }



  const renderLoading = () => (

    <div className="flex min-h-[320px] items-center justify-center">

      <div className="text-center">

        <Loader2 className="mx-auto animate-spin text-[#284C3B]" size={34} />

        <p className="mt-3 text-sm text-[#647267]">

          Chargement des données d'administration…

        </p>

      </div>

    </div>

  );



  const renderAdminBookings = () => {
    const search = bookingSearch.trim().toLocaleLowerCase('fr');
    const visible = adminBookings.filter(b => {
      if (bookingOrigin !== 'all' && bookingSource(b) !== bookingOrigin) return false;
      if (bookingStatusFilter !== 'all' && b.status !== bookingStatusFilter) return false;
      return !search || [b.id,b.booking_number,b.guest_name,b.guest_email,b.guest_phone,b.hotel?.name,b.room_type?.name]
        .some(v => String(v ?? '').toLocaleLowerCase('fr').includes(search));
    });
    const origins = ['manual','marketplace','direct','unknown'] as const;
    return <section className="space-y-5">
      <SectionHeading title="Réservations" description="Supervision en lecture seule des réservations réellement présentes dans Supabase. Origine non renseignée ≠ marketplace." badge="Données réelles" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Dossiers chargés" value={String(adminBookings.length)} caption="Maximum 1 000 derniers enregistrements" icon={CalendarDays}/>
        <StatCard title="Manuelles identifiées" value={String(adminBookings.filter(b => bookingSource(b)==='manual').length)} caption="Canaux hors marketplace" icon={Users}/>
        <StatCard title="Marketplace identifiées" value={String(adminBookings.filter(b => bookingSource(b)==='marketplace').length)} caption="Seulement si l'origine est explicite" icon={Building2}/>
        <StatCard title="Origine à vérifier" value={String(adminBookings.filter(b => bookingSource(b)==='unknown').length)} caption="Ne pas attribuer de commission par défaut" icon={AlertTriangle}/>
      </div>
      <div className="rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-serif text-lg font-bold">Registre des réservations</h3><button type="button" onClick={() => void loadAdminBookings()} disabled={bookingLoading} className="rounded-xl border px-4 py-2 text-xs font-bold disabled:opacity-50">Actualiser les réservations</button></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input aria-label="Rechercher une réservation" value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} placeholder="Référence, client, hôtel..." className="min-w-0 rounded-xl border px-3 py-3 text-sm"/>
          <select aria-label="Filtrer les origines" value={bookingOrigin} onChange={e=>setBookingOrigin(e.target.value)} className="rounded-xl border px-3 py-3 text-sm"><option value="all">Toutes les origines</option>{origins.map(o=><option key={o} value={o}>{sourceName(o)}</option>)}</select>
          <select aria-label="Filtrer les statuts" value={bookingStatusFilter} onChange={e=>setBookingStatusFilter(e.target.value)} className="rounded-xl border px-3 py-3 text-sm"><option value="all">Tous les statuts</option>{['pending','confirmed','completed','cancelled'].map(o=><option key={o} value={o}>{o}</option>)}</select>
        </div>
        {bookingLoadError && <p role="alert" className="mt-3 text-sm text-rose-700">{bookingLoadError} — Vérifie les droits de lecture administrateur.</p>}
        {bookingLoading ? <p className="mt-5 text-sm">Chargement des réservations…</p> : <div className="mt-4 space-y-2">{visible.length===0 ? <p className="text-sm text-[#647267]">Aucune réservation correspondant aux filtres.</p> : visible.map(b=><article key={b.id} className="rounded-xl border border-[#E9E2D5] p-3 sm:p-4">
          <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 text-left" onClick={()=>setOpenedBooking(v=>v===b.id?null:b.id)} aria-expanded={openedBooking===b.id}>
            <div className="min-w-0"><p className="break-words text-sm font-bold">{b.guest_name || 'Voyageur'} · {b.hotel?.name || 'Hébergement non renseigné'}</p><p className="mt-1 text-xs text-[#647267]">{b.booking_number || String(b.id).slice(0,8)} · {sourceName(bookingSource(b))} · {b.status || 'Statut inconnu'}</p></div>
            <span className="text-xs font-bold text-[#193E30]">{openedBooking===b.id?'Masquer':'Détails'}</span>
          </button>
          {openedBooking===b.id && <div className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2"><p><strong>Créée :</strong> {b.created_at?new Date(b.created_at).toLocaleString('fr-FR'):'Non renseignée'}</p><p><strong>Origine :</strong> {sourceName(bookingSource(b))}</p><p><strong>Arrivée :</strong> {b.check_in?formatDate(b.check_in):'—'}</p><p><strong>Départ :</strong> {b.check_out?formatDate(b.check_out):'—'}</p><p><strong>Offre :</strong> {b.room_type?.name||'—'}</p><p><strong>Chambres :</strong> {b.rooms_count??'—'}</p><p><strong>Téléphone :</strong> {b.guest_phone||'—'}</p><p><strong>Email :</strong> {b.guest_email||'—'}</p><p><strong>Montant du séjour :</strong> {formatFCFA(Number(b.total_price)||0)} (non encaissé par défaut)</p><p><strong>Commission enregistrée :</strong> {b.commission_amount==null?'Non renseignée':formatFCFA(Number(b.commission_amount))}</p><p><strong>État paiement :</strong> {b.payment_status||'Non renseigné'}</p><p><strong>Demande particulière :</strong> {b.special_requests||'Aucune'}</p><p className="break-all sm:col-span-2"><strong>Identifiant :</strong> {b.id}</p></div>}
        </article>)}</div>}
      </div>
    </section>;
  };

  const renderAdminUsers = () => {
    const search = profileSearch.trim().toLocaleLowerCase('fr');
    const visible = adminProfiles.filter(p=>!search||[p.full_name,p.email,p.phone,p.id,p.role].some(v=>String(v??'').toLocaleLowerCase('fr').includes(search)));
    return <section className="space-y-5">
      <SectionHeading title="Utilisateurs" description="Comptes et informations réellement accessibles à l'administration. Aucune suspension ni modification de rôle depuis cette vue." badge="Lecture seule"/>
      <div className="rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-serif text-lg font-bold">Annuaire des profils ({adminProfiles.length})</h3><button type="button" onClick={()=>void loadAdminProfiles()} disabled={profileLoading} className="rounded-xl border px-4 py-2 text-xs font-bold disabled:opacity-50">Actualiser</button></div>
        <input aria-label="Rechercher un utilisateur" value={profileSearch} onChange={e=>setProfileSearch(e.target.value)} placeholder="Nom, email, téléphone, rôle..." className="mt-4 w-full max-w-lg rounded-xl border px-3 py-3 text-sm"/>
        {profileLoadError && <p role="alert" className="mt-3 text-sm text-rose-700">{profileLoadError} — Vérifie les droits de lecture administrateur.</p>}
        {profileLoading ? <p className="mt-5 text-sm">Chargement des profils…</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{visible.length===0 ? <p className="text-sm text-[#647267]">Aucun profil correspondant.</p> : visible.map(p=><article key={p.id} className="rounded-xl border p-4">
          <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={()=>setOpenedProfile(v=>v===p.id?null:p.id)} aria-expanded={openedProfile===p.id}><span className="min-w-0"><strong className="block truncate">{p.full_name||'Profil sans nom'}</strong><span className="block truncate text-xs text-[#647267]">{p.email||'Email non renseigné'} · {p.role||'Rôle inconnu'}</span></span><span className="text-xs font-bold text-[#193E30]">{openedProfile===p.id?'Masquer':'Voir'}</span></button>
          {openedProfile===p.id && <div className="mt-3 space-y-2 border-t pt-3 text-sm"><p><strong>Téléphone :</strong> {p.phone||'—'}</p><p><strong>Création :</strong> {p.created_at?new Date(p.created_at).toLocaleString('fr-FR'):'—'}</p><p className="break-all"><strong>Identifiant :</strong> {p.id}</p><p className="text-xs text-[#647267]">Historique de séjours, contrôles d'identité et journal d'audit non chargés sur cette fiche.</p></div>}
        </article>)}</div>}
      </div>
    </section>;
  };

  // Analyses calculées exclusivement à partir des établissements et avis réellement
  // chargés dans la console. Aucun chiffre de paiement ou no-show n'est inventé.
  const analytics = useMemo(() => {
    const statuses = [
      { key: 'draft', label: 'Brouillons' },
      { key: 'pending', label: 'En attente de vérification' },
      { key: 'approved', label: 'Approuvés, non publiés' },
      { key: 'published', label: 'Publiés' },
      { key: 'unpublished', label: 'Dépubliés' },
      { key: 'rejected', label: 'Refusés' },
      { key: 'suspended', label: 'Suspendus' },
    ];
    const counts = statuses.map(item => ({ ...item, count: lodgings.filter(h => String(h.status) === item.key).length }));
    const otherCount = Math.max(0, lodgings.length - counts.reduce((sum, item) => sum + item.count, 0));
    if (otherCount) counts.push({ key: 'other', label: 'Autres statuts', count: otherCount });
    const regions = Object.entries(lodgings.reduce<Record<string, number>>((acc, item) => {
      const name = String(item.region || 'Région non renseignée').trim() || 'Région non renseignée';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})).sort((a,b) => b[1] - a[1]);
    const categories = Object.entries(lodgings.reduce<Record<string, number>>((acc, item) => {
      const name = getCategoryLabel(String(item.category || ''));
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})).sort((a,b) => b[1] - a[1]);
    const reviewCounts = { pending: pendingReviews.length, approved: approvedReviews.length, rejected: rejectedReviews.length };
    const reviewTotal = reviews.length;
    const publicationRate = lodgings.length ? 100 * publishedLodgings.length / lodgings.length : 0;
    return { counts, regions, categories, reviewCounts, reviewTotal, publicationRate };
  }, [lodgings, reviews, pendingReviews, approvedReviews, rejectedReviews, publishedLodgings]);

  const renderAnalytics = () => (
    <div className="space-y-6">
      <SectionHeading title="Statistiques avancées" description="Indicateurs vérifiables issus des fiches établissements et de la modération. Les données non connectées ne sont pas simulées." badge="Données Supabase" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Établissements publiés" value={String(publishedLodgings.length)} caption={`${analytics.publicationRate.toFixed(1)} % du catalogue enregistré`} icon={Building2} />
        <StatCard title="Approbations en attente" value={String(pendingLodgings.length)} caption="Établissements en statut pending" icon={Clock3} />
        <StatCard title="Avis à modérer" value={String(pendingReviews.length)} caption={`${analytics.reviewTotal} avis chargés`} icon={MessageSquareText} />
        <StatCard title="Réservations enregistrées" value={String(stats.totalBookings)} caption={`${stats.pendingBookings} en attente · origines à auditer`} icon={CalendarDays} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <h3 className="font-serif text-lg font-bold text-[#193E30]">Cycle de vie des établissements</h3>
          <p className="mt-1 text-xs text-[#647267]">Répartition par statut actuel, sans compter deux fois un établissement.</p>
          <div className="mt-5 space-y-4">
            {analytics.counts.map(item => <div key={item.key}>
              <div className="mb-1 flex justify-between gap-2 text-xs"><span>{item.label}</span><strong>{item.count}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#F1EEE6]"><div className="h-full rounded-full bg-[#284C3B]" style={{ width: `${lodgings.length ? item.count / lodgings.length * 100 : 0}%` }} /></div>
            </div>)}
          </div>
          <button type="button" onClick={() => setActiveSection('lodgings')} className="mt-5 rounded-xl border border-[#C8D9CD] px-4 py-2 text-xs font-bold text-[#284C3B]">Examiner les établissements</button>
        </section>
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <h3 className="font-serif text-lg font-bold text-[#193E30]">Implantation géographique</h3>
          <p className="mt-1 text-xs text-[#647267]">Nombre d'établissements par région renseignée.</p>
          <div className="mt-5 space-y-4">
            {analytics.regions.length ? analytics.regions.map(([name,count]) => <div key={name}>
              <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate">{name}</span><strong>{count}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#F1EEE6]"><div className="h-full rounded-full bg-[#9F8863]" style={{ width: `${count / Math.max(1, analytics.regions[0][1]) * 100}%` }} /></div>
            </div>) : <p className="text-sm text-[#647267]">Aucune région disponible.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <h3 className="font-serif text-lg font-bold text-[#193E30]">Types d'hébergement</h3>
          <div className="mt-4 space-y-3">{analytics.categories.length ? analytics.categories.map(([name,count]) => <div key={name} className="flex items-center justify-between gap-4 rounded-xl bg-[#F7F5EF] px-3 py-3 text-sm"><span>{name}</span><strong>{count}</strong></div>) : <p className="text-sm text-[#647267]">Aucun établissement.</p>}</div>
        </section>
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <h3 className="font-serif text-lg font-bold text-[#193E30]">Qualité et modération</h3>
          <div className="mt-4 space-y-3">
            {[{label:'Avis approuvés', count: analytics.reviewCounts.approved},{label:'Avis en attente', count: analytics.reviewCounts.pending},{label:'Avis rejetés', count: analytics.reviewCounts.rejected}].map(item => <div key={item.label} className="flex items-center justify-between rounded-xl bg-[#F7F5EF] px-3 py-3 text-sm"><span>{item.label}</span><strong>{item.count}</strong></div>)}
          </div>
          <button type="button" onClick={() => setActiveSection('reviews')} className="mt-5 rounded-xl border border-[#C8D9CD] px-4 py-2 text-xs font-bold text-[#284C3B]">Ouvrir les avis</button>
        </section>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
        <strong>Limites des données :</strong> les no-shows, revenus réellement encaissés, revenus d'abonnement, taux de conversion et origines des réservations ne sont pas calculables de façon sûre avec les sources actuelles. Ils resteront indisponibles jusqu'à la connexion et à l'audit des données correspondantes. Le volume de réservations n'est pas un encaissement.
      </div>
    </div>
  );

  const renderOverview = () => (

    <div className="space-y-6">

      <SectionHeading

        title="Vue d'ensemble"

        description="Supervision générale de l'activité disponible dans la base actuelle."

        badge="Administration"

      />



      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">

        <StatCard

          title="Volume brut enregistré"

          value={formatFCFA(stats.totalVolume)}

          caption={`${stats.totalBookings} réservation${stats.totalBookings > 1 ? 's' : ''} enregistrée${stats.totalBookings > 1 ? 's' : ''}`}

          icon={BarChart3}

        />

        <StatCard

          title="Commissions enregistrées"

          value={formatFCFA(stats.totalCommission)}

          caption="Montant remonté par les réservations"

          icon={CircleDollarSign}

        />

        <StatCard

          title="Hébergements"

          value={String(stats.totalHotels)}

          caption={`${pendingLodgings.length} en attente · ${publishedLodgings.length} publiés`}

          icon={Building2}

        />

        <StatCard

          title="Réservations"

          value={String(stats.totalBookings)}

          caption={`${stats.pendingBookings} en attente`}

          icon={CalendarDays}

        />

      </div>



      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 sm:px-5 py-4">

        <div className="flex items-start gap-3">

          <Percent className="mt-0.5 shrink-0 text-amber-700" size={18} />

          <p className="text-xs leading-5 text-amber-900">

            Standard : 12 % TTC sur les réservations issues de la marketplace. Business : 0 % de commission ; Enterprise : taux négocié. Réservations directes et saisies manuelles : 0 %. Les montants affichés proviennent du service de statistiques actuel et restent à rapprocher des écritures financières.

          </p>

        </div>

      </div>



      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

        <div className="rounded-[26px] border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

          <div className="flex flex-col gap-3 border-b border-[#E9E2D5] pb-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h3 className="font-serif text-lg font-bold text-[#30352F]">

                Alertes & tâches prioritaires

              </h3>

              <p className="mt-1 text-xs text-[#647267]">

                Éléments qui demandent actuellement l'attention d'un administrateur.

              </p>

            </div>


            <button

              type="button"

              onClick={() => void loadAdminData(true)}

              disabled={isRefreshing}

              className="inline-flex items-center gap-2 rounded-xl border border-[#C8D9CD] bg-[#E9F1EA] px-3 py-2 text-xs font-bold text-[#284C3B] transition hover:bg-[#DDEAE0] disabled:opacity-60"

            >

              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />

              Actualiser

            </button>

          </div>



          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <QueueCard

              title="Hébergements à valider"

              count={pendingLodgings.length}

              description="Approbation ou rejet motivé ; publication par l’hébergeur."

              action="Ouvrir les hébergements"

              onClick={() => setActiveSection('lodgings')}

              icon={Building2}

            />

            <QueueCard

              title="Avis à modérer"

              count={pendingReviews.length}

              description="Validation ou rejet des commentaires clients."

              action="Ouvrir la modération"

              onClick={() => setActiveSection('reviews')}

              icon={MessageSquareText}

            />
            <QueueCard

              title="Réservations en attente"

              count={stats.pendingBookings}

              description="Vérifier le statut, l’origine et les éventuelles anomalies."

              action="Ouvrir les réservations"

              onClick={() => setActiveSection('bookings')}

              icon={CalendarDays}

            />

          </div>

        </div>



        <div className="rounded-[26px] border border-[#E9E2D5] bg-[#193E30] p-4 sm:p-6 text-white shadow-sm">

          <ShieldCheck size={30} className="text-[#E3EDE4]" />

          <h3 className="mt-5 font-serif text-xl font-bold">

            Console à accès restreint

          </h3>

          <p className="mt-2 text-sm leading-6 text-[#E9E2D5]">

            Les fonctions sensibles doivent rester protégées par des droits

            administrateur côté serveur, pas uniquement par l'interface.

          </p>

          <div className="mt-6 space-y-3 text-xs text-[#E9E2D5]">

            <div className="flex items-center gap-2">

              <CheckCircle2 size={15} />

              Modération hébergements connectée

            </div>

            <div className="flex items-center gap-2">

              <CheckCircle2 size={15} />

              Modération avis connectée

            </div>

            <div className="flex items-center gap-2">

              <Clock3 size={15} />

              Journal central, litiges et sanctions rattachées aux dossiers à connecter

            </div>

          </div>

        </div>

      </div>



      <div className="grid gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3">

        <MiniMetric

          label="Avis approuvés"

          value={approvedReviews.length}

          icon={CheckCircle2}

        />

        <MiniMetric

          label="Avis rejetés"

          value={rejectedReviews.length}

          icon={XCircle}

        />

        <MiniMetric

          label="Avis en attente"

          value={pendingReviews.length}

          icon={Clock3}

        />

      </div>

    </div>

  );



  const renderLodgings = () => (

    <div className="space-y-6">

      <SectionHeading

        title="Hébergements"

        description="Validation, rejet et suivi des logements enregistrés sur la plateforme."

        badge={`${lodgings.length} au total`}

      />



      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">

        <MiniMetric label="Total" value={lodgings.length} icon={Building2} />

        <MiniMetric

          label="À valider"

          value={pendingLodgings.length}

          icon={Clock3}

        />

        <MiniMetric

          label="Publiés"

          value={publishedLodgings.length}

          icon={CheckCircle2}

        />

        <MiniMetric

          label="Rejetés"

          value={lodgings.filter((item) => item.status === 'rejected').length}

          icon={XCircle}

        />

      </div>



      <div className="rounded-[26px] border border-[#E9E2D5] bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-[#E9E2D5] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">

          <div className="relative w-full lg:max-w-md">

            <Search

              size={16}

              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#788176]"

            />

            <input

              value={lodgingSearch}

              onChange={(event) => setLodgingSearch(event.target.value)}

              placeholder="Nom, ville, région, propriétaire…"

              className="w-full rounded-xl border border-[#E9E2D5] bg-[#F7F5EF] py-2.5 pl-9 pr-3 text-sm text-[#30352F] outline-none transition focus:border-[#284C3B]"

            />

          </div>



          <select

            value={lodgingStatus}

            onChange={(event) =>

              setLodgingStatus(

                event.target.value as 'all' | Lodging['status']

              )

            }

            className="w-full lg:w-auto rounded-xl border border-[#E9E2D5] bg-white px-3 py-2.5 text-sm font-semibold text-[#30352F] outline-none focus:border-[#284C3B]"

          >

            <option value="all">Tous les statuts</option>

            <option value="pending">À valider</option>

            <option value="approved">Approuvés</option>
            <option value="published">Publiés</option>
            <option value="unpublished">Dépubliés</option>

            <option value="rejected">Rejetés</option>

            <option value="draft">Brouillons</option>

          </select>

        </div>



        <div className="overflow-x-auto">

          <table className="w-full min-w-[1000px] text-left text-xs">

            <thead className="border-b border-[#E9E2D5] bg-[#F7F5EF] uppercase text-[#647267]">

              <tr>

                <th className="px-5 py-3">Hébergement</th>

                <th className="px-5 py-3">Propriétaire / gestionnaire</th>

                <th className="px-5 py-3">Localisation</th>

                <th className="px-5 py-3">Catégorie</th>

                <th className="px-5 py-3">Note</th>

                <th className="px-5 py-3">Statut</th>

                <th className="px-5 py-3 text-right">Actions</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-[#E9E2D5]">

              {filteredLodgings.map((lodging) => (

                <tr key={lodging.id} className="align-top hover:bg-[#FCFBF8]">

                  <td className="px-5 py-4">

                    <p className="font-bold text-[#30352F]">{lodging.name}</p>

                    <p className="mt-1 max-w-[220px] truncate text-[11px] text-[#788176]">

                      {lodging.address || 'Adresse non renseignée'}

                    </p>

                  </td>

                  <td className="px-5 py-4">

                    <p className="font-semibold text-[#30352F]">

                      {lodging.owner?.full_name || 'Profil propriétaire'}

                    </p>

                    <p className="mt-1 text-[11px] text-[#788176]">

                      {lodging.owner?.email || lodging.email || 'Email non disponible'}

                    </p>

                  </td>

                  <td className="px-5 py-4">

                    <p className="font-semibold text-[#30352F]">{lodging.city}</p>

                    <p className="mt-1 text-[11px] text-[#788176]">

                      {lodging.region}

                    </p>

                  </td>

                  <td className="px-5 py-4 font-semibold text-[#284C3B]">

                    {getCategoryLabel(lodging.category)}

                  </td>

                  <td className="px-5 py-4">

                    {lodging.reviews_count > 0 && Number(lodging.rating) >= 1 && Number(lodging.rating) <= 5 ? (

                      <>

                        <div className="flex items-center gap-1 font-bold text-[#967644]">

                          <Star size={13} fill="currentColor" />

                          {Number(lodging.rating || 0).toFixed(1)}

                        </div>

                        <p className="mt-1 text-[11px] text-[#788176]">

                          {lodging.reviews_count} avis

                        </p>

                      </>

                    ) : (

                      <span className="text-[#788176]">Aucun avis</span>

                    )}

                  </td>

                  <td className="px-5 py-4">

                    <StatusBadge

                      label={getLodgingStatusLabel(lodging.status)}

                      status={lodging.status}

                    />

                  </td>

                  <td className="px-5 py-4">

                                         <div className="flex justify-end gap-2">
                       <ActionButton
                         label="Examiner le dossier"
                         loading={dossierLoading}
                         onClick={() => { setRejectionReason(''); void openDossier(lodging.id); }}
                         variant="primary"
                       />
                     </div>

                  </td>

                </tr>

              ))}



              {filteredLodgings.length === 0 && (

                <tr>

                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-[#788176]">

                    Aucun hébergement ne correspond aux filtres.

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );



  const renderReviews = () => (

    <div className="space-y-6">

      <SectionHeading

        title="Avis & modération"

        description="Contrôle des avis clients avant ou après publication."

        badge={`${pendingReviews.length} à modérer`}

      />



      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4">

        <MiniMetric

          label="En attente"

          value={pendingReviews.length}

          icon={Clock3}

        />

        <MiniMetric

          label="Approuvés"

          value={approvedReviews.length}

          icon={CheckCircle2}

        />

        <MiniMetric

          label="Rejetés"

          value={rejectedReviews.length}

          icon={XCircle}

        />

      </div>



      <div className="rounded-[26px] border border-[#E9E2D5] bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-[#E9E2D5] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">

          <div className="relative w-full lg:max-w-md">

            <Search

              size={16}

              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#788176]"

            />

            <input

              value={reviewSearch}

              onChange={(event) => setReviewSearch(event.target.value)}

              placeholder="Client, commentaire, hébergement…"

              className="w-full rounded-xl border border-[#E9E2D5] bg-[#F7F5EF] py-2.5 pl-9 pr-3 text-sm text-[#30352F] outline-none transition focus:border-[#284C3B]"

            />

          </div>



          <select

            value={reviewStatus}

            onChange={(event) =>

              setReviewStatus(event.target.value as 'all' | Review['status'])

            }

            className="w-full lg:w-auto rounded-xl border border-[#E9E2D5] bg-white px-3 py-2.5 text-sm font-semibold text-[#30352F] outline-none focus:border-[#284C3B]"

          >

            <option value="all">Tous les statuts</option>

            <option value="pending">À modérer</option>

            <option value="approved">Approuvés</option>

            <option value="rejected">Rejetés</option>

          </select>

        </div>



        <div className="divide-y divide-[#E9E2D5]">

          {filteredReviews.map((review) => (

            <article key={review.id} className="p-4 sm:p-5">

              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">

                <div className="min-w-0 flex-1">

                  <div className="flex flex-col min-[380px]:flex-row min-[380px]:flex-wrap min-[380px]:items-center gap-2">

                    <p className="font-bold text-[#30352F]">

                      {review.guest_name || 'Voyageur'}

                    </p>

                    <StatusBadge

                      label={getReviewStatusLabel(review.status)}

                      status={review.status}

                    />

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#967644]">

                      <Star size={13} fill="currentColor" />

                      {review.rating}/5

                    </span>

                  </div>



                  <p className="mt-2 text-xs text-[#788176]">

                    {review.hotel?.name || 'Hébergement'} ·{' '}

                    {formatDate(review.created_at)}

                  </p>



                  <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-[#4A463F]">

                    {review.comment || 'Aucun commentaire.'}

                  </p>



                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#647267]">

                    {review.cleanliness != null && (

                      <ScorePill label="Propreté" value={review.cleanliness} />

                    )}

                    {review.comfort != null && (

                      <ScorePill label="Confort" value={review.comfort} />

                    )}

                    {review.location != null && (

                      <ScorePill label="Emplacement" value={review.location} />

                    )}

                    {review.staff != null && (

                      <ScorePill label="Personnel" value={review.staff} />

                    )}

                  </div>

                </div>



                <div className="flex shrink-0 flex-wrap gap-2">

                  {review.status !== 'approved' && (

                    <ActionButton

                      label="Approuver"

                      loading={busyAction === `review-${review.id}-approved`}

                      onClick={() =>

                        setPendingDecision({ kind: 'review', id: review.id, name: review.guest_name || 'Voyageur', status: 'approved' })

                      }

                      variant="primary"

                    />

                  )}

                  {review.status !== 'rejected' && (

                    <ActionButton

                      label="Rejeter"

                      loading={busyAction === `review-${review.id}-rejected`}

                      onClick={() =>

                        setPendingDecision({ kind: 'review', id: review.id, name: review.guest_name || 'Voyageur', status: 'rejected' })

                      }

                      variant="danger"

                    />

                  )}

                  {review.status !== 'pending' && (

                    <ActionButton

                      label="Réexaminer"

                      loading={busyAction === `review-${review.id}-pending`}

                      onClick={() =>

                        setPendingDecision({ kind: 'review', id: review.id, name: review.guest_name || 'Voyageur', status: 'pending' })

                      }

                      variant="secondary"

                    />

                  )}

                </div>

              </div>

            </article>

          ))}



          {filteredReviews.length === 0 && (

            <div className="px-5 py-14 text-center text-sm text-[#788176]">

              Aucun avis ne correspond aux filtres.

            </div>

          )}

        </div>

      </div>

    </div>

  );



  const renderReports = () => (
    <div className="space-y-6">
      <SectionHeading
        title="Direction / Supervision administrative"
        description="Journal des actions réservé à la direction, contrôle des opérations de l’équipe et rapports d’activité."
        badge={isAdministrator ? 'Direction' : 'Supervision'}
      />
      {isAdministrator && <div className="flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" />
        <div>
          <h3 className="font-semibold text-[#1B382D]">Journal administratif</h3>
          <p className="mt-1 text-sm leading-6 text-[#647267]">
            Les mutations sensibles sont enregistrées par la base. L’accès à l’historique global est réservé à la direction.
          </p>
        </div>
      </div>}
      {governanceError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{governanceError} — Vérifiez que la migration admin est appliquée et que votre compte a le rôle administrateur.</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#647267]">Les sanctions sont immuables et toujours rattachées à un dossier de litige.</p>
        <button type="button" onClick={() => void loadGovernanceData()} disabled={governanceLoading} className="rounded-xl border border-[#C8D9CD] px-4 py-2 text-xs font-bold text-[#284C3B] disabled:opacity-50">
          {governanceLoading ? 'Actualisation…' : 'Actualiser le journal'}
        </button>
      </div>
      <section className="overflow-hidden rounded-2xl border border-[#E9E2D5] bg-white">
        <div className="border-b border-[#E9E2D5] p-4">
          <h3 className="font-serif text-lg font-bold text-[#193E30]">Historique central des actions</h3>
          <p className="mt-1 text-xs text-[#647267]">200 dernières opérations enregistrées automatiquement par la base.</p>
        </div>
        <div className="divide-y divide-[#E9E2D5]">
          {!isAdministrator ? <p className="p-4 text-sm text-[#647267]">La consultation globale du journal est réservée à la direction.</p> : auditLogs.length === 0 ? <p className="p-4 text-sm text-[#647267]">{governanceLoading ? 'Chargement du journal…' : 'Aucune action enregistrée.'}</p> : auditLogs.map(log => (
            <article key={log.id} className="grid gap-1 p-4 text-xs sm:grid-cols-[1fr_auto] sm:items-center">
              <div><p className="font-semibold text-[#30352F]">{String(log.action).replace(/_/g, ' ')}</p><p className="mt-1 break-all text-[#647267]">{log.entity_type} · {log.entity_id}{log.support_ticket_id ? ` · Dossier ${log.support_ticket_id}` : ''} · Auteur {log.actor_name ? `${log.actor_name} (${String(log.actor_id || 'inconnu')})` : String(log.actor_id || 'inconnu')}</p>{log.reason&&<p className="mt-1 text-[#647267]">Justification : {log.reason}</p>}{(log.old_data||log.new_data)&&<p className="mt-1 break-all text-[#647267]">Modifications : {JSON.stringify({avant:log.old_data,après:log.new_data})}</p>}</div>
              <time className="text-[#647267]">{new Date(log.created_at).toLocaleString('fr-FR')}</time>
              {log.support_ticket_id&&<button type="button" className="text-left font-semibold text-[#284C3B] underline" onClick={()=>{setSelectedTicketId(log.support_ticket_id);setActiveSection('assistance');}}>Ouvrir le dossier lié</button>}
            </article>
          ))}
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#E9E2D5] bg-white">
        <div className="border-b border-[#E9E2D5] p-4">
          <h3 className="font-serif text-lg font-bold text-[#193E30]">Sanctions rattachées aux litiges</h3>
          <p className="mt-1 text-xs text-[#647267]">Historique permanent des mesures, motifs et dossiers concernés.</p>
        </div>
        <div className="divide-y divide-[#E9E2D5]">
          {caseSanctions.length === 0 ? <p className="p-4 text-sm text-[#647267]">Aucune sanction enregistrée.</p> : caseSanctions.map(sanction => (
            <article key={sanction.id} className="grid gap-2 p-4 text-xs sm:grid-cols-[1fr_auto] sm:items-center">
              <div><p className="font-semibold text-[#30352F]">{sanction.sanction_type.replace(/_/g, ' ')} · compte {sanction.target_user_id}</p><p className="mt-1 text-[#647267]">Dossier {sanction.support_ticket_id} · {sanction.reason}{sanction.amount_xof ? ` · ${formatFCFA(sanction.amount_xof)}` : ''}</p></div>
              <time className="text-[#647267]">{new Date(sanction.created_at).toLocaleString('fr-FR')}</time>
            </article>
          ))}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <div className="flex items-center gap-3">
            <Clock3 size={20} className="text-[#284C3B]" />
            <h3 className="font-semibold text-[#1B382D]">Historique centralisé des actions</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#647267]">
            Le journal conserve l’identifiant de l’auteur, l’horodatage, l’entité,
            les valeurs avant/après et les justifications disponibles.
          </p>
        </section>
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#284C3B]" />
            <h3 className="font-semibold text-[#1B382D]">Contrôle de l’équipe</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#647267]">
            Les affectations et droits des collaborateurs sont consultables dans l’espace dédié.
          </p>
          <button type="button" onClick={() => setActiveSection('team')} className="mt-4 rounded-xl border border-[#C8D9CD] px-4 py-2 text-xs font-bold text-[#284C3B]">
            Ouvrir Équipe & permissions
          </button>
        </section>
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <div className="flex items-center gap-3">
            <BarChart3 size={20} className="text-[#284C3B]" />
            <h3 className="font-semibold text-[#1B382D]">Rapports d’activité</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#647267]">
            Les statistiques disponibles sont calculées à partir des données réelles chargées par la console.
          </p>
          <button type="button" onClick={() => setActiveSection('analytics')} className="mt-4 rounded-xl border border-[#C8D9CD] px-4 py-2 text-xs font-bold text-[#284C3B]">
            Consulter les statistiques
          </button>
        </section>
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <div className="flex items-center gap-3">
            <Gavel size={20} className="text-[#284C3B]" />
            <h3 className="font-semibold text-[#1B382D]">Sanctions rattachées aux dossiers</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#647267]">
            Toute mesure est enregistrée dans le dossier concerné — notamment un litige —
            avec son motif et sa durée, puis apparaît dans l’historique centralisé.
          </p>
          <button type="button" onClick={() => setActiveSection('assistance')} className="mt-4 rounded-xl border border-[#C8D9CD] px-4 py-2 text-xs font-bold text-[#284C3B]">
            Accéder aux dossiers d’assistance et litiges
          </button>
        </section>
      </div>
    </div>
  );

  const renderFinances = () => (

    <div className="space-y-6">

      <SectionHeading

        title="Finances & abonnements"

        description="Formules, commissions, factures, règlements et échéances : les chiffres ci-dessous restent limités aux données disponibles."

        badge="Partiellement connecté"

      />



      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">

        <StatCard

          title="Volume brut"

          value={formatFCFA(stats.totalVolume)}

          caption="Montants des réservations remontés par le service"

          icon={BarChart3}

        />

        <StatCard

          title="Commission remontée"

          value={formatFCFA(stats.totalCommission)}

          caption="À fiabiliser pendant la passe backend"

          icon={CircleDollarSign}

        />

        <StatCard

          title="Réservations"

          value={String(stats.totalBookings)}

          caption={`${stats.pendingBookings} en attente`}

          icon={CalendarDays}

        />

        <StatCard

          title="Taux commercial"

          value="Selon origine"

          caption="Standard : 12 % TTC marketplace · Business : 0 % · Direct : 0 %"

          icon={Percent}

        />

      </div>

      {financeLoadError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{financeLoadError} — Vérifiez les droits de lecture administrateur sur les formules et abonnements.</p>}
      <section className="space-y-4 rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-serif text-lg font-bold text-[#193E30]">Formules & abonnements enregistrés</h3><p className="mt-1 text-xs text-[#647267]">Informations lues depuis saas_plans et owner_subscriptions.</p></div>
          <button type="button" onClick={() => void loadAdminFinance()} disabled={financeLoading} className="rounded-xl border border-[#C8D9CD] px-4 py-2 text-xs font-bold text-[#284C3B] disabled:opacity-50">{financeLoading ? 'Actualisation…' : 'Actualiser'}</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {adminPlans.map(plan=><article key={plan.code} className="rounded-xl border border-[#E9E2D5] bg-[#FCFBF8] p-4">
            <h4 className="font-semibold text-[#193E30]">{plan.label}</h4>
            <p className="mt-2 text-sm">{plan.monthly_price_xof == null ? 'Prix sur devis' : `${formatFCFA(Number(plan.monthly_price_xof))} / mois`}</p>
            <p className="mt-1 text-xs text-[#647267]">Commission : {plan.marketplace_commission_pct == null ? 'Négociée' : `${plan.marketplace_commission_pct} %`}</p>
            <p className="mt-1 text-xs text-[#647267]">Établissements : {plan.max_active_lodgings ?? 'Illimité'} · Collaborateurs : {plan.max_collaborators ?? 'Illimité'}</p>
          </article>)}
          {!financeLoading && adminPlans.length===0 && <p className="text-sm text-[#647267]">Aucune formule accessible.</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-[#E9E2D5] bg-[#F7F5EF] text-[#647267]"><tr><th className="p-3">Compte hôte</th><th className="p-3">Formule</th><th className="p-3">Statut</th><th className="p-3">Début de période</th><th className="p-3">Prochaine échéance</th></tr></thead>
            <tbody className="divide-y divide-[#E9E2D5]">
              {adminSubscriptions.map(subscription=><tr key={subscription.owner_id}>
                <td className="break-all p-3 font-mono">{subscription.owner_id}</td>
                <td className="p-3">{adminPlans.find(plan=>plan.code===subscription.plan_code)?.label || subscription.plan_code}</td>
                <td className="p-3">{subscription.status}</td>
                <td className="p-3">{subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="p-3">{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : 'Non définie'}</td>
              </tr>)}
              {!financeLoading && adminSubscriptions.length===0 && <tr><td className="p-4 text-[#647267]" colSpan={5}>Aucun abonnement enregistré.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {financeActionNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{financeActionNotice}</p>}
      <section className="rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <h3 className="font-serif text-lg font-bold text-[#193E30]">Coordonnées officielles pour les virements Business</h3>
        <p className="mt-1 text-xs text-[#647267]">Ces coordonnées sont affichées aux hôtes avant la création de leur référence de paiement.</p>
        <form onSubmit={savePaymentInstructions} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#284C3B]">Nom du bénéficiaire
            <input required minLength={2} maxLength={200} value={paymentAccountHolder} onChange={event => setPaymentAccountHolder(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B]">Banque / opérateur
            <input required minLength={2} maxLength={200} value={paymentBankName} onChange={event => setPaymentBankName(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B] sm:col-span-2">Numéro / référence de compte
            <input required minLength={2} maxLength={200} value={paymentAccountReference} onChange={event => setPaymentAccountReference(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B] sm:col-span-2">Instructions pour le transfert
            <textarea maxLength={2000} rows={3} value={paymentInstructions} onChange={event => setPaymentInstructions(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] p-2.5 text-sm" />
          </label>
          <button type="submit" disabled={financeActionBusy} className="rounded-xl bg-[#284C3B] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 sm:col-span-2">Enregistrer les coordonnées</button>
        </form>
      </section>
      <section className="space-y-4 rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <div>
          <h3 className="font-serif text-lg font-bold text-[#193E30]">Demandes Business à vérifier</h3>
          <p className="mt-1 text-xs text-[#647267]">La formule reste inchangée tant qu’un membre finance n’a pas confirmé le virement reçu.</p>
        </div>
        {adminSubscriptionRequests.filter(request => request.status === 'pending').length === 0 ? (
          <p className="text-sm text-[#647267]">Aucune demande en attente.</p>
        ) : <div className="space-y-3">
          {adminSubscriptionRequests.filter(request => request.status === 'pending').map(request => <article key={request.id} className="rounded-xl border border-[#E9E2D5] bg-[#FCFBF8] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-[#193E30]">{request.reference}</p>
                <p className="mt-1 break-all text-xs text-[#647267]">Compte hôte : {request.owner_id}</p>
                <p className="mt-1 text-xs text-[#647267]">{formatFCFA(Number(request.amount_xof))} · justificatif transmis le {formatDate(request.proof_submitted_at || request.submitted_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {subscriptionProofLinks[request.proof_path]
                  ? <a href={subscriptionProofLinks[request.proof_path]} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[#C8D9CD] px-3 py-2 text-xs font-bold text-[#284C3B]">Ouvrir le justificatif</a>
                  : <button type="button" onClick={() => void openSubscriptionProof(request.proof_path)} className="rounded-xl border border-[#C8D9CD] px-3 py-2 text-xs font-bold text-[#284C3B]">Charger le justificatif</button>}
                <button type="button" disabled={financeActionBusy} onClick={() => void reviewBusinessRequest(request.id, false)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Refuser</button>
                <button type="button" disabled={financeActionBusy} onClick={() => void reviewBusinessRequest(request.id, true)} className="rounded-xl bg-[#284C3B] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmer le paiement</button>
              </div>
            </div>
          </article>)}
        </div>}
      </section>

      <section className="space-y-4 rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#193E30]">Contrats Enterprise</h3>
            <p className="mt-1 text-xs text-[#647267]">Gestion dédiée des termes et statistiques contractuelles ; seuls les règlements confirmés comptent comme revenus encaissés.</p>
          </div>
          <div className="rounded-xl bg-[#EFF3ED] px-4 py-3 text-xs text-[#284C3B]">
            Contrats : <strong>{adminEnterpriseContracts.length}</strong>
            <span className="mx-2">·</span>
            Encaissé Enterprise : <strong>{formatFCFA(adminInvoices.filter(invoice => invoice.invoice_type === 'enterprise_contract' && invoice.status === 'paid').reduce((total, invoice) => total + Number(invoice.amount_xof), 0))}</strong>
          </div>
        </div>
        <form onSubmit={createEnterpriseContract} className="grid gap-3 rounded-xl border border-[#E9E2D5] bg-[#FCFBF8] p-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-semibold text-[#284C3B]">UUID du compte hôte
            <input required value={enterpriseOwnerId} onChange={event => setEnterpriseOwnerId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] bg-white p-2.5 text-sm" placeholder="UUID du profil" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B]">Montant mensuel (FCFA)
            <input required type="number" min="0" step="1" value={enterpriseAmount} onChange={event => setEnterpriseAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] bg-white p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B]">Commission marketplace (%)
            <input required type="number" min="0" max="100" step="0.01" value={enterpriseCommission} onChange={event => setEnterpriseCommission(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] bg-white p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B]">Début du contrat
            <input required type="date" value={enterpriseStartDate} onChange={event => setEnterpriseStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] bg-white p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B]">Fin (facultative)
            <input type="date" value={enterpriseEndDate} onChange={event => setEnterpriseEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D5DFD3] bg-white p-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#284C3B] sm:col-span-2 xl:col-span-3">Conditions et notes contractuelles
            <textarea required minLength={1} maxLength={10000} value={enterpriseTerms} onChange={event => setEnterpriseTerms(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[#D5DFD3] bg-white p-2.5 text-sm" />
          </label>
          <button type="submit" disabled={financeActionBusy} className="rounded-xl bg-[#284C3B] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 sm:col-span-2 xl:col-span-3">Créer le contrat Enterprise</button>
        </form>
        {adminEnterpriseContracts.length === 0 ? <p className="text-sm text-[#647267]">Aucun contrat Enterprise enregistré.</p> : <div className="space-y-3">
          {adminEnterpriseContracts.map(contract => {
            const contractRevenue = adminInvoices
              .filter(invoice => invoice.enterprise_contract_id === contract.id && invoice.status === 'paid')
              .reduce((total, invoice) => total + Number(invoice.amount_xof), 0);
            return <article key={contract.id} className="rounded-xl border border-[#E9E2D5] p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-[#193E30]">{contract.contract_reference}</p>
                  <p className="mt-1 break-all text-xs text-[#647267]">Compte : {contract.owner_id}</p>
                  <p className="mt-1 text-xs text-[#647267]">{formatFCFA(Number(contract.monthly_amount_xof))} / mois · {contract.marketplace_commission_pct}% marketplace · encaissé : {formatFCFA(contractRevenue)}</p>
                  <p className="mt-1 text-xs text-[#647267]">{formatDate(contract.starts_at)}{contract.ends_at ? ` → ${formatDate(contract.ends_at)}` : ' · sans échéance définie'} · {contract.status}</p>
                </div>
                <details className="max-w-2xl text-xs">
                  <summary className="cursor-pointer font-bold text-[#284C3B]">Voir les conditions</summary>
                  <p className="mt-2 whitespace-pre-wrap leading-5 text-[#59645B]">{contract.terms}</p>
                </details>
              </div>
              {contract.status === 'active' && <form onSubmit={recordEnterprisePayment} className="mt-4 grid gap-2 border-t border-[#E9E2D5] pt-3 sm:grid-cols-4">
                <input type="hidden" value={enterprisePaymentContractId} readOnly />
                <label className="text-xs font-semibold text-[#284C3B]">Montant encaissé
                  <input required type="number" min="1" step="1" value={enterprisePaymentContractId === contract.id ? enterprisePaymentAmount : ''} onChange={event => { setEnterprisePaymentContractId(contract.id); setEnterprisePaymentAmount(event.target.value); }} className="mt-1 w-full rounded-lg border border-[#D5DFD3] p-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-[#284C3B] sm:col-span-2">Référence du paiement reçu
                  <input required value={enterprisePaymentContractId === contract.id ? enterprisePaymentReference : ''} onChange={event => { setEnterprisePaymentContractId(contract.id); setEnterprisePaymentReference(event.target.value); }} className="mt-1 w-full rounded-lg border border-[#D5DFD3] p-2 text-sm" />
                </label>
                <button type="submit" disabled={financeActionBusy || enterprisePaymentContractId !== contract.id} className="self-end rounded-xl border border-[#C8D9CD] px-3 py-2 text-xs font-bold text-[#284C3B] disabled:opacity-50">Enregistrer l’encaissement</button>
              </form>}
            </article>;
          })}
        </div>}
      </section>

      <section className="space-y-4 rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div><h3 className="font-serif text-lg font-bold text-[#193E30]">Encaissements d’abonnements et contrats</h3><p className="mt-1 text-xs text-[#647267]">Le total général inclut Business et les contrats Enterprise, uniquement après confirmation.</p></div>
          <p className="rounded-xl bg-[#EFF3ED] px-4 py-3 text-sm font-bold text-[#284C3B]">Total encaissé : {formatFCFA(adminInvoices.filter(invoice => invoice.status === 'paid').reduce((total, invoice) => total + Number(invoice.amount_xof), 0))}</p>
        </div>
        {adminInvoices.length === 0 ? <p className="text-sm text-[#647267]">Aucun encaissement d’abonnement enregistré.</p> : <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-[#E9E2D5] bg-[#F7F5EF] text-[#647267]"><tr><th className="p-3">Facture</th><th className="p-3">Compte hôte</th><th className="p-3">Type</th><th className="p-3">Montant</th><th className="p-3">Référence paiement</th><th className="p-3">Statut</th><th className="p-3">Date d’encaissement</th></tr></thead>
            <tbody className="divide-y divide-[#E9E2D5]">{adminInvoices.map(invoice => <tr key={invoice.id}>
              <td className="p-3 font-mono">{invoice.invoice_number}</td><td className="break-all p-3 font-mono">{invoice.owner_id}</td>
              <td className="p-3">{invoice.invoice_type === 'enterprise_contract' ? 'Enterprise' : 'Business'}</td>
              <td className="p-3">{formatFCFA(Number(invoice.amount_xof))}</td><td className="p-3 font-mono">{adminPayments.find(payment => payment.invoice_id === invoice.id)?.payment_reference || '—'}</td><td className="p-3">{invoice.status === 'paid' ? 'Payée' : 'Annulée'}</td>
              <td className="p-3">{invoice.paid_at ? formatDate(invoice.paid_at) : '—'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">

        <div className="rounded-[26px] border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

          <h3 className="font-serif text-lg font-bold text-[#30352F]">

            Ce qui est disponible maintenant

          </h3>

          <div className="mt-5 space-y-4">

            <FinanceRow

              label="Volume brut des réservations"

              value={formatFCFA(stats.totalVolume)}

            />

            <FinanceRow

              label="Commission retournée par le service"

              value={formatFCFA(stats.totalCommission)}

            />

            <FinanceRow

              label="Réservations en attente"

              value={String(stats.pendingBookings)}

            />

          </div>

        </div>



        <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 sm:p-6">

          <AlertTriangle className="text-amber-700" size={24} />

          <h3 className="mt-4 font-serif text-lg font-bold text-[#30352F]">

            Backend financier à finaliser

          </h3>

          <p className="mt-2 text-sm leading-6 text-[#647267]">

            Les formules et périodes d’abonnement sont connectées. Les factures,
            reçus de paiement, reversements hôtes, frais PSP et soldes réellement dus
            ne sont pas encore fournis par l'API Admin actuelle.

          </p>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-white/70 p-4 text-xs leading-5 text-[#647267]">

            La console ne calcule donc pas un faux revenu net et n'affiche aucun

            taux commercial provisoire comme s'il était définitif.

          </div>

        </div>

      </div>

    </div>

  );



  const renderSettings = () => (

    <div className="space-y-6">

      <SectionHeading

        title="Paramètres"

        description="Configuration générale et état des connexions de la console."

        badge="Interne"

      />



      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">

        <div className="rounded-[26px] border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

          <ShieldCheck className="text-[#284C3B]" size={26} />

          <h3 className="mt-4 font-serif text-lg font-bold text-[#30352F]">

            Autorisations

          </h3>

          <p className="mt-2 text-sm leading-6 text-[#647267]">

            Compte connecté :{' '}

            <span className="font-bold text-[#30352F]">

              {user.email || 'Administrateur'}

            </span>

          </p>

          <p className="mt-2 text-xs leading-5 text-[#788176]">

            L'interface vérifie le rôle courant, mais les opérations critiques

            devront également être protégées par les politiques serveur/RLS.

          </p>

        </div>



        <div className="rounded-[26px] border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

          <Settings className="text-[#967644]" size={26} />

          <h3 className="mt-4 font-serif text-lg font-bold text-[#30352F]">

            Configuration Supabase

          </h3>

          <p className="mt-2 text-sm leading-6 text-[#647267]">

            Accès à l'outil de configuration déjà présent dans le projet.

          </p>

          <button

            type="button"

            onClick={onOpenSupabaseModal}

            className="mt-5 rounded-xl bg-[#1B382D] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#142B22]"

          >

            Schéma & clés Supabase

          </button>

        </div>

      </div>



      <div className="rounded-[26px] border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

        <h3 className="font-serif text-lg font-bold text-[#30352F]">

          État des modules

        </h3>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

          <ModuleState label="Statistiques globales" connected />

          <ModuleState label="Modération hébergements" connected />

          <ModuleState label="Modération avis" connected />

          <ModuleState label="Gestion utilisateurs" />

          <ModuleState label="Litiges & preuves" />

          <ModuleState label="Sanctions & restrictions" />

          <ModuleState label="Formules, factures & règlements" />
          <ModuleState label="Historique central des actions" />

          <ModuleState label="Messagerie de litige" />

        </div>

      </div>

    </div>

  );



  const staffPermissionNames: Record<string,string> = {
    support: 'Assistance',
    finance: 'Finances',
    verification: 'Vérification',
    moderation: 'Modération',
    users: 'Utilisateurs',
    bookings: 'Réservations',
    disputes: 'Litiges',
    supervision: 'Supervision',
    settings: 'Paramètres',
  };
  const staffStatusNames: Record<string,string> = {
    invited: 'Invitation en attente',
    active: 'Actif',
    suspended: 'Suspendu',
    deactivated: 'Désactivé',
  };
  const inputClass = 'w-full rounded-xl border border-[#D8D0C1] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#284C3B]';
  const renderSupportCenter = () => {
    const shown=supportTickets.filter(t => (supportStatusFilter==='all'||t.status===supportStatusFilter) &&
      [t.subject,t.description,t.id].some(v=>String(v||'').toLowerCase().includes(supportSearch.toLowerCase())));
    const chosen=supportTickets.find(t=>t.id===selectedTicketId);
    const updateTicket = (ticket: any, values: { status: string; priority: string; assigned_to: string | null }) => {
      const reason = window.prompt('Indiquez la justification de cette modification (5 caractères minimum).')?.trim();
      if (!reason) return;
      if (reason.length < 5) {
        setSupportError('La justification doit contenir au moins 5 caractères.');
        return;
      }
      void supportAction(
        async () => supabase.rpc('admin_update_support_ticket', {
          p_ticket_id: ticket.id,
          p_status: values.status,
          p_priority: values.priority,
          p_assigned_to: values.assigned_to,
          p_reason: reason,
        }),
        'Dossier mis à jour et justification journalisée.',
      );
    };
    const statusNames: Record<string, string> = {
      open: 'Nouveau',
      in_progress: 'En cours',
      waiting_user: 'En attente du client',
      follow_up: 'À relancer',
      resolved: 'Résolu',
      closed: 'Clôturé',
    };
    const averageRating = supportRatings.length
      ? supportRatings.reduce((sum, item) => sum + Number(item.rating), 0) / supportRatings.length
      : null;
    const openSupportAttachment = async (attachment: any) => {
      setSupportError('');
      const { data, error } = await supabase.storage
        .from('support-attachments').createSignedUrl(attachment.storage_path, 60);
      if (error) setSupportError(error.message);
      else if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      else setSupportError('Lien de téléchargement indisponible.');
    };
    const issueSanction=async(e:React.FormEvent) => {
      e.preventDefault();
      if (!user || !chosen || chosen.category !== 'dispute') return;
      if (newSanctionReason.trim().length < 10) {
        setSupportError('Le motif de sanction doit contenir au moins 10 caractères.');
        return;
      }
      if (newSanctionType === 'temporary_restriction' && !newSanctionEndsAt) {
        setSupportError('Une date de fin est obligatoire pour une restriction temporaire.');
        return;
      }
      const amount = newSanctionType === 'financial_penalty' ? Number(newSanctionAmount) : null;
      if (newSanctionType === 'financial_penalty' && (!Number.isInteger(amount) || Number(amount) <= 0)) {
        setSupportError('Le montant de la pénalité doit être un nombre entier positif en XOF.');
        return;
      }
      await supportAction(async () => {
        const result = await supabase.from('admin_sanctions').insert({
          support_ticket_id: chosen.id,
          target_user_id: newSanctionTargetId.trim(),
          sanction_type: newSanctionType,
          reason: newSanctionReason.trim(),
          amount_xof: amount,
          ends_at: newSanctionEndsAt ? new Date(newSanctionEndsAt).toISOString() : null,
          created_by: user.id,
        });
        if (!result.error) {
          setNewSanctionTargetId('');
          setNewSanctionReason('');
          setNewSanctionAmount('');
          setNewSanctionEndsAt('');
        }
        return result;
      },'Sanction enregistrée dans le dossier et le journal central.');
    };
    return <div className="space-y-5">
      <SectionHeading title="Centre d’assistance" description="Boîte de réception des demandes, échanges clients, pièces jointes, litiges et attributions." badge="Équipe" />
      {supportError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{supportError} — Vérifiez que les migrations d’assistance et d’équipe ont été exécutées dans Supabase.</div>}
      {supportNotice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{supportNotice}</p>}
      <section className="rounded-2xl border border-[#E9E2D5] bg-white p-4">
        <h3 className="font-semibold text-[#193E30]">Qualité de l’assistance</h3>
        <p className="mt-1 text-sm text-[#647267]">
          {averageRating === null ? 'Aucune évaluation reçue.' : `${averageRating.toFixed(1)} / 5 · ${supportRatings.length} évaluation(s).`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {supportPerformance.map(agent => (
            <span key={agent.agent_id} className="rounded-full bg-[#F7F5EF] px-3 py-1.5 text-xs text-[#59645B]">
              {agent.agent_name} · {agent.resolved_tickets} résolu(s) · {agent.average_rating === null ? 'sans évaluation' : `${Number(agent.average_rating).toFixed(1)} / 5 (${agent.rated_tickets})`}
            </span>
          ))}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3 rounded-2xl border bg-white p-4">
          <h3 className="font-bold">Dossiers ({shown.length})</h3>
          <input className={inputClass} value={supportSearch} onChange={e=>setSupportSearch(e.target.value)} placeholder="Rechercher un ticket" aria-label="Rechercher"/>
          <select className={inputClass} aria-label="Statut" value={supportStatusFilter} onChange={e=>setSupportStatusFilter(e.target.value)}>{[['all','Tous'],['open','Nouveau'],['in_progress','En cours'],['waiting_user','En attente du client'],['follow_up','À relancer'],['resolved','Résolu'],['closed','Clôturé']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          <div className="max-h-[550px] space-y-2 overflow-y-auto">{shown.length===0?<p className="p-3 text-sm text-[#647267]">Aucune demande correspondante.</p>:shown.map(t=><button type="button" key={t.id} onClick={()=>setSelectedTicketId(t.id)} className={'w-full rounded-xl border p-3 text-left text-sm '+(t.id===selectedTicketId?'border-[#193E30] bg-[#EFF3ED]':'border-[#E9E2D5]')}><strong>{t.subject}</strong><p className="mt-1 text-xs text-[#647267]">{t.category} · {statusNames[t.status] || t.status} · {new Date(t.created_at).toLocaleDateString('fr-FR')}</p>{t.booking_id&&<p className="mt-1 break-all text-[10px] text-[#647267]">Réservation : {t.booking_id}</p>}</button>)}</div>
        </div>
        <div className="space-y-4 rounded-2xl border bg-white p-5">
          {!chosen?<p className="text-sm text-[#647267]">Sélectionnez un dossier pour consulter son suivi.</p>:<>
            <h3 className="text-lg font-bold">{chosen.subject}</h3>
            <p className="text-xs text-[#647267]">Demandeur : {supportRequester?.full_name || 'Nom non renseigné'} · {supportRequester?.email || 'Email indisponible'}{supportRequester?.phone ? ` · ${supportRequester.phone}` : ''}</p>
            <p className="whitespace-pre-wrap text-sm">{chosen.description}</p>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Statut<select className={inputClass} value={chosen.status} disabled={supportBusy} onChange={e=>updateTicket(chosen,{status:e.target.value,priority:chosen.priority,assigned_to:chosen.assigned_to||null})} >
              {[['open','Nouveau'],['in_progress','En cours'],['waiting_user','En attente du client'],['follow_up','À relancer'],['resolved','Résolu'],['closed','Clôturé']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
            <label className="text-xs font-semibold">Priorité<select className={inputClass} value={chosen.priority} disabled={supportBusy} onChange={e=>updateTicket(chosen,{status:chosen.status,priority:e.target.value,assigned_to:chosen.assigned_to||null})} >
              {[['low','Basse'],['normal','Normale'],['high','Haute'],['urgent','Urgente']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
            {isAdministrator&&<label className="block text-xs font-semibold">Responsable<select className={inputClass} value={chosen.assigned_to||''} disabled={supportBusy} onChange={e=>updateTicket(chosen,{status:chosen.status,priority:chosen.priority,assigned_to:e.target.value||null})}><option value="">Non attribué</option>{staffAssignments.filter(a=>a.account_status==='active'&&a.user_id).map(a=><option key={a.id} value={a.user_id}>{a.full_name}</option>)}</select></label>}
            {chosen.category === 'dispute' && (isAdministrator||adminStaffPermissions.includes('disputes')) && <>
              <section className="space-y-3 rounded-xl border border-[#E9E2D5] bg-[#F7F5EF] p-4">
                <div>
                  <h4 className="font-semibold text-[#193E30]">Sanctions rattachées à ce litige</h4>
                  <p className="mt-1 break-all text-xs text-[#647267]">Réservation liée : {chosen.booking_id}</p>
                </div>
                {caseSanctions.filter(s=>s.support_ticket_id===chosen.id).map(s=><article key={s.id} className="rounded-lg border bg-white p-3 text-xs">
                  <p className="font-semibold">{s.sanction_type.replace(/_/g,' ')} · compte {s.target_user_id}</p>
                  <p className="mt-1 text-[#647267]">{s.reason}</p>
                  {s.amount_xof&&<p className="mt-1">{formatFCFA(s.amount_xof)}</p>}
                  <p className="mt-1 text-[#647267]">{new Date(s.created_at).toLocaleString('fr-FR')}{s.ends_at?` · Échéance ${new Date(s.ends_at).toLocaleDateString('fr-FR')}`:''}</p>
                </article>)}
                <form onSubmit={issueSanction} className="space-y-3 border-t border-[#D8D0C1] pt-3">
                  <p className="text-sm font-semibold">Enregistrer une mesure</p>
                  <p className="text-xs leading-5 text-[#647267]">La mesure et son motif seront archivés dans ce dossier. Cette action ne suspend pas le compte et ne prélève aucun montant automatiquement.</p>
                  <input className={inputClass} aria-label="UUID du compte concerné" value={newSanctionTargetId} onChange={e=>setNewSanctionTargetId(e.target.value)} required placeholder="UUID du compte concerné"/>
                  <select className={inputClass} aria-label="Type de sanction" value={newSanctionType} onChange={e=>setNewSanctionType(e.target.value)}>
                    {[['warning','Avertissement'],['financial_penalty','Pénalité financière'],['temporary_restriction','Restriction temporaire'],['suspension','Suspension'],['deactivation','Désactivation']].map(([value,label])=><option key={value} value={value}>{label}</option>)}
                  </select>
                  {newSanctionType === 'financial_penalty' && <input className={inputClass} type="number" min="1" step="1" aria-label="Montant en XOF" value={newSanctionAmount} onChange={e=>setNewSanctionAmount(e.target.value)} required placeholder="Montant en XOF"/>}
                  {newSanctionType === 'temporary_restriction' && <label className="block text-xs font-semibold">Fin de la restriction<input className={inputClass} type="datetime-local" value={newSanctionEndsAt} onChange={e=>setNewSanctionEndsAt(e.target.value)} required/></label>}
                  <textarea className={inputClass} aria-label="Motif de la sanction" value={newSanctionReason} onChange={e=>setNewSanctionReason(e.target.value)} minLength={10} maxLength={2000} rows={3} required placeholder="Motif documenté (10 caractères minimum)"/>
                  <button type="submit" disabled={supportBusy} className="rounded-xl bg-[#193E30] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Enregistrer la sanction</button>
                </form>
              </section>
            </>}
            <h4 className="border-t pt-3 font-semibold">Conversation et journal interne</h4>
            <div className="max-h-64 space-y-2 overflow-y-auto">{supportMessages.length===0?<p className="text-sm text-[#647267]">Aucun échange pour le moment.</p>:supportMessages.map(m=><div key={m.id} className="rounded-lg bg-[#F7F5EF] p-3 text-sm"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#8C744C]">{m.is_internal ? 'Note interne — non visible du demandeur' : 'Réponse visible par le demandeur'}</p><p className="whitespace-pre-wrap">{m.body}</p><p className="mt-2 text-xs text-[#647267]">{new Date(m.created_at).toLocaleString('fr-FR')} · {String(m.author_id).slice(0,8)}</p></div>)}</div>
            <h4 className="font-semibold">Pièces jointes du dossier</h4>
            {supportAttachments.length===0?<p className="text-xs text-[#647267]">Aucune pièce jointe.</p>:supportAttachments.map(attachment=><button key={attachment.id} type="button" onClick={()=>void openSupportAttachment(attachment)} className="block rounded-lg border px-3 py-2 text-left text-xs font-semibold text-[#284C3B] underline">{attachment.file_name} · {Math.ceil(attachment.file_size/1024)} Ko</button>)}
            <form onSubmit={e=>{e.preventDefault();if(!user||!newMessageBody.trim())return;void supportAction(async()=>{const r=await supabase.from('support_ticket_messages').insert({ticket_id:chosen.id,author_id:user.id,body:newMessageBody.trim(),is_internal:newMessageInternal});if(!r.error)setNewMessageBody('');return r},newMessageInternal?'Note interne ajoutée au dossier.':'Réponse envoyée au demandeur.')}} className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={newMessageInternal} onChange={e=>setNewMessageInternal(e.target.checked)}/> Note interne (non visible par le demandeur)</label>
              <textarea className={inputClass} rows={3} value={newMessageBody} onChange={e=>setNewMessageBody(e.target.value)} minLength={1} maxLength={5000} required placeholder={newMessageInternal?'Ajouter une note interne…':'Rédiger une réponse au demandeur…'}/>
              <button disabled={supportBusy} type="submit" className="rounded-xl bg-[#193E30] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{newMessageInternal?'Ajouter la note':'Envoyer la réponse'}</button>
            </form>
          </>}
        </div>
      </div>
    </div>;
  };
  const renderStaffTeam = () => <div className="space-y-5">
    <SectionHeading title="Équipe & permissions" description="Ajoutez les collaborateurs indépendamment de leurs autorisations, puis accordez des permissions métier séparées." badge="Administration" />
    {supportError&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{supportError}</p>}
    {supportNotice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{supportNotice}</p>}
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
      L’invitation est valable 7 jours. Le collaborateur doit se connecter ou créer un compte avec cette adresse email et la confirmer; le rattachement est alors automatique. L’envoi d’email nécessite une fonction d’envoi Supabase configurée. Sans permission, le collaborateur n’obtient aucun accès aux dossiers protégés.
    </div>
    <form className="space-y-4 rounded-2xl border bg-white p-5" onSubmit={e=>{
      e.preventDefault();
      if (!newStaffName.trim() || !newStaffEmail.trim()) return;
      void supportAction(async()=>{
        const result = await supabase.rpc('create_admin_staff_invite', {
          p_full_name: newStaffName.trim(),
          p_email: newStaffEmail.trim().toLowerCase(),
        });
        if (!result.error) {
          setNewStaffName('');
          setNewStaffEmail('');
        }
        return result;
      },'Invitation enregistrée. Elle expirera dans 7 jours.');
    }}>
      <h3 className="font-bold">Ajouter un collaborateur</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required maxLength={160} className={inputClass} aria-label="Nom complet" placeholder="Nom complet" value={newStaffName} onChange={e=>setNewStaffName(e.target.value)}/>
        <input required type="email" maxLength={254} className={inputClass} aria-label="Adresse email" placeholder="Adresse email professionnelle" value={newStaffEmail} onChange={e=>setNewStaffEmail(e.target.value)}/>
      </div>
      <p className="text-xs text-[#647267]">Aucune permission n’est attribuée lors de l’ajout. Vous pourrez les accorder séparément dans la liste des collaborateurs.</p>
      <button type="submit" disabled={supportBusy} className="rounded-xl bg-[#193E30] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Créer l’invitation</button>
    </form>
    <div className="space-y-3 rounded-2xl border bg-white p-4">
      <h3 className="font-bold">Collaborateurs ({staffAssignments.length})</h3>
      {staffAssignments.length===0?<p className="text-sm text-[#647267]">Aucun collaborateur enregistré.</p>:staffAssignments.map(member=>{
        const lastSeen = member.last_seen_at ? new Date(member.last_seen_at).getTime() : 0;
        const isRecent = Date.now() - lastSeen < 5 * 60 * 1000;
        const presence = member.account_status !== 'active' || !isRecent
          ? 'Hors ligne'
          : member.presence_preference === 'away' ? 'Absent' : 'En ligne';
        const presenceColor = presence === 'En ligne' ? 'bg-emerald-500' : presence === 'Absent' ? 'bg-amber-400' : 'bg-slate-400';
        const permissions = Array.isArray(member.permissions) ? member.permissions as string[] : [];
        const updateMember = (status: string, nextPermissions: string[]) => {
          const reason = window.prompt('Indiquez la justification de cette modification d’accès (5 caractères minimum).')?.trim();
          if (!reason) return;
          if (reason.length < 5 || reason.length > 2000) {
            setSupportError('La justification doit contenir 5 à 2000 caractères.');
            return;
          }
          return supportAction(async () => supabase.rpc('update_admin_staff_member', {
            p_member_id: member.id,
            p_account_status: status,
            p_permissions: nextPermissions,
            p_reason: reason,
          }), 'Accès du collaborateur mis à jour et justification journalisée.');
        };
        return <article key={member.id} className="space-y-3 rounded-xl border border-[#E9E2D5] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{member.full_name}</p>
              <p className="text-sm text-[#647267]">{member.email}</p>
              <p className="mt-1 text-xs text-[#647267]">Invitation : {member.account_status === 'invited' ? `expire le ${new Date(member.invitation_expires_at).toLocaleDateString('fr-FR')}` : new Date(member.invited_at).toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${presenceColor}`} aria-hidden="true"/>
              <span>{presence}</span>
              <span className="rounded-full bg-[#F7F5EF] px-2 py-1">{staffStatusNames[member.account_status] || member.account_status}</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(staffPermissionNames).map(([permission,label])=><label key={permission} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={permissions.includes(permission)} disabled={member.account_status==='deactivated' || supportBusy} onChange={e=>{
                const next = e.target.checked ? [...permissions,permission] : permissions.filter(value=>value!==permission);
                void updateMember(member.account_status,next);
              }}/>
              {label}
            </label>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold">Statut
              <select className={`${inputClass} mt-1 min-w-48`} value={member.account_status} disabled={supportBusy || (member.account_status==='invited' && !member.user_id)} onChange={e=>void updateMember(e.target.value,permissions)}>
                {Object.entries(staffStatusNames).filter(([status])=>status!=='active'||Boolean(member.user_id)).map(([status,label])=><option key={status} value={status}>{label}</option>)}
              </select>
            </label>
            {member.account_status==='invited'&&<button type="button" disabled={supportBusy} className="mt-5 rounded-lg border px-3 py-2 text-xs disabled:opacity-50" onClick={()=>void supportAction(
              async ()=>supabase.rpc('create_admin_staff_invite',{p_full_name:member.full_name,p_email:member.email}),
              'Invitation renouvelée pour 7 jours.',
            )}>Renvoyer / renouveler l’invitation</button>}
          </div>
        </article>;
      })}
    </div>
  </div>;

  const renderCurrentSection = () => {

    if (isLoading) return renderLoading();
    if (!isAdministrator && visibleNavItems.length === 0) {
      return <div className="rounded-2xl border bg-white p-8 text-sm text-[#647267]">
        Votre compte est bien rattaché à l’équipe, mais aucune permission ne lui a été attribuée.
      </div>;
    }



    switch (activeSection) {

      case 'overview':

        return renderOverview();
      case 'analytics':

        return renderAnalytics();

      case 'lodgings':

        return renderLodgings();

      case 'users':
        return renderAdminUsers();
      case 'bookings':
        return renderAdminBookings();
      case 'reports':
        return renderReports();
      case 'assistance':
        return renderSupportCenter();
      case 'team':
        return renderStaffTeam();
      case 'finances':

        return renderFinances();

      case 'reviews':

        return renderReviews();

      case 'settings':

        return renderSettings();

      default:

        return renderOverview();

    }

  };



  return (

    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F8F7F3] text-[#24352D]">

      <header className="z-10 shrink-0 border-b border-[#1B382D] bg-[#193E30] text-white">

        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:gap-4 px-3 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">

          <div>

            <div className="flex items-center gap-2">

              <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />

              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E9E2D5]">

                Administration plateforme

              </span>

            </div>

            <h1 className="mt-1 font-serif text-xl font-bold min-[360px]:text-2xl sm:text-3xl">

              TerangaSN · Console Admin

            </h1>

          </div>



          <div className="flex flex-col min-[380px]:flex-row min-[380px]:flex-wrap min-[380px]:items-center gap-2">
            {hasAdminStaffAccess&&<div>
              <label className="text-xs font-semibold">Ma présence
                <select className="mt-1 min-w-36 rounded-xl border border-white/25 bg-[#244A3A] px-3 py-2 text-xs" value={adminStaffPresence} onChange={async e=>{
                  const result = await setAdminStaffPresence(e.target.value as 'online' | 'away');
                  setPresenceError(result.error?.message || '');
                }}>
                  <option value="online">En ligne</option>
                  <option value="away">Absent</option>
                </select>
              </label>
              {presenceError&&<p role="alert" className="mt-1 max-w-48 text-[11px] text-rose-200">{presenceError}</p>}
            </div>}
            <div className="w-full min-w-0 min-[380px]:w-auto rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs break-all min-[380px]:break-normal">

              <span className="text-[#E3EDE4]">Connecté : </span>

              <span className="font-bold">{user.email || 'Administrateur'}</span>

            </div>

            <button
              type="button"
              onClick={onReturnToSite}
              className="inline-flex w-full min-[380px]:w-auto items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold transition hover:bg-white/20"
            >
              ← Retour au site
            </button>
            <button

              type="button"

              onClick={() => void loadAdminData(true)}

              disabled={isRefreshing}

              className="inline-flex w-full min-[380px]:w-auto items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1B382D] px-3.5 py-2 text-xs font-bold transition hover:bg-[#142B22] disabled:opacity-60"

            >

              <RefreshCw

                size={14}

                className={isRefreshing ? 'animate-spin' : ''}

              />

              Actualiser

            </button>

          </div>

        </div>

      </header>



      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">

        <aside className="shrink-0 border-b border-[#E9E2D5] bg-white lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain lg:border-b-0 lg:border-r [scrollbar-gutter:stable]">

          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] p-2.5 sm:p-3 lg:overflow-visible lg:p-4">

            <nav className="flex min-w-max gap-1.5 sm:gap-2 lg:min-w-0 lg:flex-col">

              {visibleNavItems.map((item) => {

                const Icon = item.icon;

                const active = activeSection === item.id;

                const count =

                  item.id === 'lodgings'

                    ? pendingLodgings.length

                    : item.id === 'reviews'

                      ? pendingReviews.length

                      : null;



                return (

                  <button

                    key={item.id}

                    type="button"

                    onClick={() => setActiveSection(item.id)}

                    className={cx(

                      'flex items-center gap-2 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-2.5 text-left text-xs sm:text-sm font-semibold transition',

                      active

                        ? 'bg-[#E9F1EA] text-[#284C3B]'

                        : 'text-[#647267] hover:bg-[#F7F5EF] hover:text-[#30352F]'

                    )}

                  >

                    <Icon size={17} />

                    <span className="flex-1">{item.label}</span>

                    {count !== null && count > 0 && (

                      <span className="rounded-full bg-[#D97706] px-2 py-0.5 text-[10px] font-bold text-white">

                        {count}

                      </span>

                    )}

                  </button>

                );

              })}

            </nav>



            <div className="mt-5 hidden rounded-2xl border border-[#E9E2D5] bg-[#F7F5EF] p-4 lg:block">

              <p className="text-[10px] font-bold uppercase tracking-widest text-[#788176]">

                Section active

              </p>

              <p className="mt-1 text-sm font-bold text-[#30352F]">

                {sectionLabels[activeSection]}

              </p>

              <p className="mt-3 text-[11px] leading-5 text-[#788176]">

                Les actions non supportées par l'API restent volontairement

                désactivées jusqu'à la passe backend.

              </p>

            </div>

          </div>

        </aside>



        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain p-3 sm:p-6 lg:p-8 [scrollbar-gutter:stable]">

          {errorMessage && (

            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">

              <AlertTriangle className="mt-0.5 shrink-0" size={18} />

              <div className="flex-1">

                <p className="font-bold">Une opération a échoué</p>

                <p className="mt-1 text-xs leading-5">{errorMessage}</p>

              </div>

              <button

                type="button"

                onClick={() => setErrorMessage('')}

                className="font-bold"

                aria-label="Fermer le message d'erreur"

              >

                ×

              </button>

            </div>

          )}



          {notice && (

            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#C8D9CD] bg-[#E9F1EA] p-4 text-sm font-semibold text-[#284C3B]">

              <CheckCircle2 size={18} />

              {notice}

            </div>

          )}



          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#E9E2D5] bg-white px-5 py-4 shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A8056]">Espace de pilotage TerangaSN</p>
              <p className="mt-1 font-serif text-xl font-semibold text-[#193E30]">{sectionLabels[activeSection]}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#EDF3EE] px-3 py-2 text-xs font-semibold text-[#193E30]">
              <ShieldCheck size={15} /> Accès administrateur
            </span>
          </div>
          {renderCurrentSection()}

        </main>

      </div>
      {(dossierLoading || selectedDossier || dossierError) && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-[#0D241B]/75 p-3 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyAction) { setSelectedDossier(null); setDossierError(''); } }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-dossier-title" className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] bg-[#F8F7F3] shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E9E2D5] bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#967644]">Contrôle administratif · données Supabase</p>
                <h2 id="admin-dossier-title" className="mt-1 font-serif text-xl font-bold text-[#193E30] sm:text-2xl">{selectedDossier?.name || 'Chargement du dossier'}</h2>
              </div>
              <button type="button" aria-label="Fermer le dossier" disabled={Boolean(busyAction)} onClick={() => { setSelectedDossier(null); setDossierError(''); }} className="rounded-lg border border-[#E9E2D5] px-3 py-2 text-sm font-bold text-[#30352F] disabled:opacity-50">Fermer ×</button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-7">
              {dossierLoading && <p className="text-sm text-[#647267]">Chargement des informations enregistrées…</p>}
              {dossierError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{dossierError}</div>}
              {selectedDossier && (() => {
                const dossier = selectedDossier as Lodging & Record<string, any>;
                const rooms = Array.isArray(dossier.room_types) ? dossier.room_types : [];
                const photos = Array.isArray(dossier.photos) ? dossier.photos.filter((photo: unknown): photo is string => typeof photo === 'string' && /^https?:\/\//.test(photo)) : [];
                const amenities = Array.isArray(dossier.amenities) ? dossier.amenities : [];
                const value = (input: unknown) => input === null || input === undefined || input === '' ? 'Non renseigné' : String(input);
                return <>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge label={getLodgingStatusLabel(selectedDossier.status)} status={selectedDossier.status} />
                    <span className="text-xs text-[#647267]">Identifiant : {selectedDossier.id}</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
                      <h3 className="mb-4 font-bold text-[#193E30]">Établissement</h3>
                      <dl className="space-y-3 text-sm">
                        <div><dt className="text-[#647267]">Nom et catégorie</dt><dd className="font-semibold">{value(dossier.name)} · {getCategoryLabel(dossier.category)}</dd></div>
                        <div><dt className="text-[#647267]">Localisation</dt><dd>{[dossier.address, dossier.city, dossier.region].filter(Boolean).join(', ') || 'Non renseignée'}</dd></div>
                        <div><dt className="text-[#647267]">Description</dt><dd className="whitespace-pre-wrap">{value(dossier.description)}</dd></div>
                        <div><dt className="text-[#647267]">Contact de l'établissement</dt><dd>{value(dossier.phone)} · {value(dossier.email)}</dd></div>
                        <div><dt className="text-[#647267]">Équipements</dt><dd>{amenities.length ? amenities.map(String).join(' · ') : 'Non renseignés'}</dd></div>
                      </dl>
                    </div>
                    <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
                      <h3 className="mb-4 font-bold text-[#193E30]">Propriétaire / gestionnaire</h3>
                      <dl className="space-y-3 text-sm">
                        <div><dt className="text-[#647267]">Identité déclarée</dt><dd className="font-semibold">{value(dossier.owner?.full_name)}</dd></div>
                        <div><dt className="text-[#647267]">Email</dt><dd>{value(dossier.owner?.email)}</dd></div>
                        <div><dt className="text-[#647267]">Téléphone</dt><dd>{value(dossier.owner?.phone)}</dd></div>
                        <div><dt className="text-[#647267]">ID propriétaire</dt><dd className="break-all text-xs">{value(dossier.owner_id)}</dd></div>
                      </dl>
                      <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Ces coordonnées sont déclaratives : elles ne constituent pas une vérification d'identité.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
                    <h3 className="font-bold text-[#193E30]">Chambres et tarifs enregistrés ({rooms.length})</h3>
                    {rooms.length === 0 ? <p className="mt-3 text-sm text-[#647267]">Aucune catégorie de chambre accessible dans ce dossier.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{rooms.map((room: any, index: number) => <div key={room.id || index} className="rounded-xl border border-[#E9E2D5] bg-[#FCFBF8] p-4 text-sm"><p className="font-bold">{value(room.name)}</p><p className="mt-2">Tarif de base : {typeof room.price_per_night === 'number' ? formatFCFA(room.price_per_night) : value(room.price_per_night)}</p><p>Nombre de chambres : {value(room.total_rooms)}</p><p>Capacité : {value(room.max_guests ?? room.capacity)}</p><p>Annulation : {room.cancellation_policy === 'free_cancellation' ? 'Annulation gratuite (configuration actuelle)' : value(room.cancellation_policy)}</p></div>)}</div>}
                  </div>
                  <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
                    <h3 className="font-bold text-[#193E30]">Photos de l'établissement ({photos.length})</h3>
                    {photos.length ? <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">{photos.map((photo: string, index: number) => <a key={`${photo}-${index}`} href={photo} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-[#E9E2D5]"><img src={photo} alt={`Photo ${index + 1} de l'établissement`} className="h-36 w-full object-cover" loading="lazy" /></a>)}</div> : <p className="mt-3 text-sm text-[#647267]">Aucune photo accessible.</p>}
                  </div>
                  <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
                    <h3 className="font-bold text-[#193E30]">Dossier juridique et justificatifs privés</h3>
                                         <p className="mt-2 text-xs leading-5 text-[#647267]">Examiner chaque justificatif puis statuer sur le dossier. La présence d'un fichier ne prouve pas son authenticité ; vérifier sa cohérence et sa validité avant approbation.</p>
                     {legalNotice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{legalNotice}</p>}
                    {legalLoading && <p className="mt-3 text-sm">Chargement des justificatifs…</p>}
                    {legalError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{legalError}</p>}
                    {!legalLoading && !legalDossier && !legalError && <p className="mt-3 text-sm text-amber-800">Aucun dossier juridique soumis pour cet établissement.</p>}
                    {legalDossier && <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-[#F7F5EF] px-3 py-2">Statut : <strong>{({draft:'Brouillon',submitted:'Soumis',under_review:'En cours d’examen',changes_requested:'Corrections demandées',verified:'Dossier vérifié',rejected:'Dossier refusé'} as Record<string,string>)[legalDossier.status] || String(legalDossier.status)}</strong></span><span className="rounded-lg bg-[#F7F5EF] px-3 py-2">Qualité déclarée : <strong>{String(legalDossier.relationship_type)}</strong></span></div>
                      {legalDossier.relationship_details && <p className="text-sm">Précisions : {legalDossier.relationship_details}</p>}
                      {legalDossier.review_note && <p className="text-sm">Observation administrative : {legalDossier.review_note}</p>}
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{legalDocuments.filter((d: any) => d.status === 'pending').length}</strong><p className="text-xs text-amber-900">Pièces en attente</p></div>
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm"><strong>{legalDocuments.filter((d: any) => d.status === 'rejected').length}</strong><p className="text-xs text-rose-800">Pièces refusées</p></div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm"><strong>{legalDocuments.filter((d: any) => d.status === 'verified').length}</strong><p className="text-xs text-emerald-800">Pièces validées</p></div>
                      </div>
                      {legalDocuments.length === 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Aucun justificatif accessible.</p>}
                      <div className="space-y-3">
                        {[...legalRequirements, ...legalDocuments.filter((d: any) => !legalRequirements.some((r: any) => r.document_type === d.document_type)).map((d: any) => ({document_type:d.document_type,label_fr:d.document_type,is_required:false}))].filter((r: any, i: number, array: any[]) => array.findIndex((x: any) => x.document_type === r.document_type) === i)
                          .sort((a: any,b: any) => {
                            const rank = (r: any) => { const docs = legalDocuments.filter((d: any) => d.document_type === r.document_type); return !docs.length ? 0 : docs.some((d: any) => d.status === 'pending') ? 1 : docs.some((d: any) => d.status === 'rejected') && !docs.some((d: any) => d.status === 'verified') ? 2 : 3; };
                            return rank(a) - rank(b);
                          }).map((req: any) => {
                          const docs = legalDocuments.filter((d: any) => d.document_type === req.document_type);
                          const pending = docs.filter((d: any) => d.status === 'pending');
                          const verified = docs.filter((d: any) => d.status === 'verified' && !isExpired(d.document_valid_until));
                          const rejected = docs.filter((d: any) => d.status === 'rejected');
                          // La carte est alignée sur la règle serveur : le dépôt le plus récent
                          // est la version courante. Les anciens dépôts sont archivés en galerie.
                          const lead = docs[0];
                          const state = !lead ? 'missing' : isExpired(lead.document_valid_until) ? 'expired' : lead.status === 'verified' ? 'verified' : lead.status === 'rejected' ? 'rejected' : 'pending';
                          const cls = state === 'verified' ? 'border-emerald-200 bg-emerald-50/40' : state === 'rejected' || state === 'missing' || state === 'expired' ? 'border-rose-200 bg-rose-50/40' : 'border-amber-200 bg-amber-50/40';
                          const label = state === 'verified' ? 'Pièce vérifiée' : state === 'pending' ? 'À examiner' : state === 'rejected' ? 'Document refusé' : state === 'missing' ? 'Document manquant' : 'Validité expirée';
                          return <article key={req.document_type} className={`rounded-2xl border p-4 sm:p-5 ${cls}`}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0"><div className="flex items-center gap-2">{state === 'verified' ? <CheckCircle2 size={19} className="text-emerald-700"/> : state === 'pending' ? <Clock3 size={19} className="text-amber-800"/> : <XCircle size={19} className="text-rose-700"/>}<h4 className="font-bold text-[#193E30]">{req.label_fr}{req.is_required ? ' *' : ''}</h4></div>
                                <p className="mt-1 text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-[#647267]">{docs.length} dépôt(s) au total · version courante : {label.toLowerCase()} · {docs.length > 1 ? `${docs.length - 1} ancien(s) dépôt(s) consultable(s)` : 'aucun ancien dépôt'}</p>
                                {lead?.review_note && <p className="mt-2 rounded-lg border border-rose-200 bg-white p-2 text-xs text-rose-800"><strong>Motif :</strong> {lead.review_note}</p>}
                              </div>
                              <button type="button" disabled={!docs.length} onClick={() => openLegalGallery(req.document_type)} className="shrink-0 rounded-xl border border-[#D9D3C8] bg-white px-4 py-2.5 text-xs font-bold text-[#193E30] disabled:opacity-40">Voir tous les justificatifs ({docs.length})</button>
                            </div>
                            {lead && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E9E2D5] pt-3">
                              <span className="mr-auto min-w-0 break-all text-xs text-[#647267]">Dernier à traiter : {lead.original_filename || 'Document'}</span>
                              {reviewableLegal && lead.status === 'pending' && <span className="text-xs font-semibold text-amber-800">Examen individuel dans la galerie uniquement</span>}
                              {lead.status === 'verified' && <span className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">Déjà validée</span>}
                              {lead.status === 'rejected' && <span className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800">Déjà refusée</span>}
                            </div>}
                          </article>;
                        })}
                      </div>
                       {legalDossier && <div className="rounded-xl border border-[#D8D0C1] bg-white p-4">
                         <h4 className="text-sm font-bold text-[#193E30]">Décision sur le dossier juridique</h4>
                         <p className="mt-2 text-xs text-[#647267]">{legalMissing.length ? `${legalMissing.length} type(s) de justificatifs obligatoires sans document vérifié et valide.` : legalUnreviewed.length ? `${legalUnreviewed.length} catégorie(s) avec une pièce récente encore à examiner, refusée ou expirée.` : 'Les justificatifs actuels sont validés. Les anciens dépôts refusés restent dans l’historique sans bloquer la décision.'}</p>
                         <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Conditions de vérification juridique">
                           {legalReviewSteps.map((step) => <div key={step.label} className={`rounded-xl border px-3 py-3 ${step.done ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                             <div className="flex items-start gap-2">{step.done ? <CheckCircle2 size={17} className="shrink-0 text-emerald-700" /> : <Clock3 size={17} className="shrink-0 text-amber-800" />}<div><p className="text-xs font-bold">{step.label}</p>{!step.done && <p className="mt-1 text-xs leading-5 text-[#786240]">{step.info}</p>}</div></div>
                           </div>)}
                         </div>
                         {legalDossier.status === 'changes_requested' && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Corrections demandées : l’hôtelier doit remplacer les pièces concernées et soumettre à nouveau son dossier. L’examen d’une pièce ne constitue pas à lui seul cette nouvelle soumission.</p>}
                         {legalDossier.status === 'rejected' && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">Dossier rejeté : ce cycle est clos. Une réouverture ou un nouveau dépôt devra suivre une procédure autorisée, sans effacer l’historique.</p>}
                         {legalDossier.status === 'verified' && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">Dossier juridique vérifié. Vous pouvez maintenant examiner l’approbation administrative de l’établissement si sa demande est toujours en attente.</p>}
                         <div className="mt-3 flex flex-wrap gap-2">
                           <button type="button" disabled={!legalCanVerify || legalBusy} onClick={() => startLegalDecision('dossier',legalDossier.id,'Dossier juridique','verified')} className="rounded-lg bg-[#193E30] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{legalDossier.status === 'verified' ? 'Dossier déjà vérifié' : 'Vérifier le dossier juridique'}</button>
                           {reviewableLegal && <>
                             <button type="button" disabled={legalBusy} onClick={() => startLegalDecision('dossier',legalDossier.id,'Dossier juridique','changes_requested')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">Demander des corrections</button>
                             <button type="button" disabled={legalBusy} onClick={() => startLegalDecision('dossier',legalDossier.id,'Dossier juridique','rejected')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 disabled:opacity-50">Rejeter le dossier</button>
                           </>}
                         </div>
                         {legalHistory.length > 0 && <div className="mt-4 border-t border-[#E9E2D5] pt-3"><p className="text-xs font-bold">Historique des décisions juridiques</p>{legalHistory.map((h: any) => <p key={h.id} className="mt-2 text-xs text-[#647267]">{formatDate(h.created_at)} · {({verified:'Vérifié',rejected:'Refusé',changes_requested:'Corrections demandées'} as Record<string,string>)[h.decision] || h.decision}{h.reason ? ` — ${h.reason}` : ''}</p>)}</div>}
                       </div>}
                     </div>}
                   </div>
                   {(dossier.rejection_reason || dossier.reviewed_at) && <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5 text-sm"><h3 className="font-bold text-[#193E30]">Dernière décision enregistrée</h3><p className="mt-2">Date : {value(dossier.reviewed_at)}</p><p>Motif de rejet : {value(dossier.rejection_reason)}</p></div>}
                  {selectedDossier.status === 'pending' && <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5"><h3 className="font-bold text-[#193E30]">Décision administrative</h3><p className="mt-2 text-sm text-[#647267]">Décision distincte de la vérification juridique : elle n'entraîne pas la publication. Seul l'hôtelier peut publier ensuite.</p>{legalDossier?.status !== 'verified' && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Approbation bloquée : le dossier juridique doit d'abord être vérifié. {legalDossier?.status === 'changes_requested' ? 'Des corrections ont été demandées à l’hébergeur.' : legalDossier?.status === 'rejected' ? 'Le dossier juridique a été rejeté.' : 'Examinez les pièces courantes avant de poursuivre.'}</p>}<label htmlFor="admin-rejection-reason" className="mt-4 block text-sm font-semibold">Motif du rejet (obligatoire pour rejeter)</label><textarea id="admin-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} placeholder="Expliquez précisément les corrections ou justificatifs nécessaires…" className="mt-2 w-full rounded-xl border border-[#D8D0C1] p-3 text-sm outline-none focus:border-[#284C3B]" /><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={Boolean(busyAction) || legalLoading || Boolean(legalError) || legalDossier?.status !== 'verified'} onClick={() => void decideDossier('approved')} className="rounded-xl bg-[#193E30] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Approuver le dossier</button><button type="button" disabled={Boolean(busyAction) || !rejectionReason.trim()} onClick={() => void decideDossier('rejected')} className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-800 disabled:opacity-50">Rejeter avec motif</button></div></div>}
                </>;
              })()}
            </div>
          </section>
        </div>
      )}
       {galleryType && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#0D241B]/80 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setGalleryType(null); }}>
         <section role="dialog" aria-modal="true" aria-label="Galerie des justificatifs" className="flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
           <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E9E2D5] p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-[#967644]">Dossier juridique · Consultation sécurisée</p><h2 className="mt-1 font-serif text-lg font-bold text-[#193E30]">{legalRequirements.find((r: any) => r.document_type === galleryType)?.label_fr || galleryType}</h2><p className="text-xs text-[#647267]">Tous les dépôts de cette catégorie sont accessibles ici.</p></div><button type="button" onClick={() => setGalleryType(null)} className="rounded-lg border px-3 py-2 text-sm font-bold">Fermer ×</button></header>
           <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[290px_minmax(0,1fr)]">
             <aside className="max-h-52 overflow-y-auto border-b border-[#E9E2D5] bg-[#FBFAF7] p-3 lg:max-h-none lg:border-b-0 lg:border-r">
               {legalDocuments.filter((d: any) => d.document_type === galleryType).map((doc: any, i: number) => <button key={doc.id} type="button" onClick={() => setGalleryDocumentId(doc.id)} className={`mb-2 w-full rounded-xl border p-3 text-left text-xs ${galleryDocumentId === doc.id ? 'border-[#284C3B] bg-[#E9F1EA]' : 'border-[#E9E2D5] bg-white hover:bg-[#F7F5EF]'}`}><div className="flex items-start justify-between gap-2"><span className="break-all font-bold">Pièce {i+1} · {doc.original_filename || 'Document'}</span>{galleryDocumentId === doc.id && <CheckCircle2 size={15} className="shrink-0"/>}</div><span className={`mt-2 inline-block rounded-full px-2 py-1 font-bold ${doc.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : doc.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{doc.status === 'verified' ? 'Validée' : doc.status === 'rejected' ? 'Refusée' : 'En attente'}</span>{doc.review_note && <p className="mt-2 text-rose-700">{doc.review_note}</p>}</button>)}
             </aside>
             <div className="flex min-h-[400px] min-w-0 flex-col p-3 sm:p-5">
               {(() => { const doc = legalDocuments.find((d: any) => d.id === galleryDocumentId); if (!doc) return <p>Aucun document sélectionné.</p>; const isPDF = /\.pdf$/i.test(doc.original_filename || doc.storage_path); return <><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="break-all text-xs font-bold">{doc.original_filename}</span><span className="text-xs text-[#647267]">{doc.document_valid_until ? `Valable jusqu’au ${doc.document_valid_until}` : 'Validité non renseignée'}</span></div><div className="flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-xl border bg-[#F7F5EF]">{galleryLoading ? <div className="flex items-center gap-2 text-sm"><Loader2 size={18} className="animate-spin"/> Chargement du fichier privé…</div> : galleryError ? <p className="p-4 text-sm text-rose-700">{galleryError}</p> : galleryUrl ? isPDF ? <iframe title="Aperçu PDF du justificatif" src={galleryUrl} className="h-[52dvh] min-h-[300px] w-full"/> : <img src={galleryUrl} alt={`Justificatif ${doc.original_filename || ''}`} className="max-h-[55dvh] max-w-full object-contain"/> : <p className="p-3 text-sm">Aperçu indisponible</p>}</div><div className="mt-3 flex flex-wrap items-center gap-2">{galleryUrl && <a href={galleryUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-3 py-2 text-xs font-bold">Ouvrir le fichier</a>}{doc.review_note && <p className="text-xs text-rose-800">Motif : {doc.review_note}</p>}{reviewableLegal && doc.status === 'pending' && <><label className="flex w-full items-start gap-2 rounded-lg border border-[#D8D0C1] bg-white p-3 text-xs font-semibold text-[#193E30]"><input type="checkbox" className="mt-0.5 accent-[#193E30]" checked={galleryReviewedDocumentId === doc.id} disabled={!galleryUrl || galleryLoading || Boolean(galleryError)} onChange={(e) => setGalleryReviewedDocumentId(e.target.checked ? doc.id : null)} />J’ai consulté cette pièce et examiné son contenu avant de prendre une décision.</label><button type="button" disabled={legalBusy || !galleryUrl || galleryLoading || galleryReviewedDocumentId !== doc.id || isExpired(doc.document_valid_until)} onClick={() => {startLegalDecision('document',doc.id,doc.original_filename || doc.document_type,'verified');}} className="rounded-lg bg-[#193E30] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Valider cette pièce</button><button type="button" disabled={legalBusy || !galleryUrl || galleryLoading || galleryReviewedDocumentId !== doc.id} onClick={() => {startLegalDecision('document',doc.id,doc.original_filename || doc.document_type,'rejected');}} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">Refuser cette pièce</button></>}{doc.status === 'verified' && <span className="text-xs font-bold text-emerald-800">Déjà validée</span>}{doc.status === 'rejected' && <span className="text-xs font-bold text-rose-800">Déjà refusée</span>}</div><details className="mt-3 rounded-lg border p-3 text-xs"><summary className="cursor-pointer font-bold">Historique de contrôle</summary>{legalDocumentHistory.filter((h: any) => h.document_id === doc.id).map((h: any) => <p key={h.id} className="mt-2">{formatDate(h.created_at)} · {h.decision === 'verified' ? 'Validé' : h.decision === 'rejected' ? 'Refusé' : 'Corrections demandées'} {h.reason ? `— ${h.reason}` : ''}</p>)}</details></>; })()}
             </div>
           </div>
         </section>
       </div>}
      {legalAction && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0D241B]/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !legalBusy) setLegalAction(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="legal-decision-title" className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <h2 id="legal-decision-title" className="font-serif text-xl font-bold text-[#193E30]">{legalAction.decision === 'verified' ? 'Confirmer la vérification' : legalAction.decision === 'changes_requested' ? 'Demander des corrections' : 'Confirmer le rejet'}</h2>
            <p className="mt-2 break-words text-sm text-[#647267]">{legalAction.label}</p>
            <label htmlFor="legal-decision-note" className="mt-5 block text-sm font-semibold">{legalAction.decision === 'verified' ? 'Note administrative (facultative)' : 'Motif détaillé (obligatoire, 10 caractères minimum)'}</label>
            <textarea id="legal-decision-note" value={legalDecisionNote} onChange={(e) => setLegalDecisionNote(e.target.value)} rows={4} maxLength={2000} className="mt-2 w-full rounded-xl border border-[#D8D0C1] p-3 text-sm outline-none focus:border-[#284C3B]" placeholder="Précisez les éléments contrôlés ou les corrections attendues…" />
            {legalError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{legalError}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={legalBusy} onClick={() => { setLegalAction(null); setLegalError(''); }} className="rounded-xl border border-[#D8D0C1] px-4 py-2.5 text-sm font-bold disabled:opacity-50">Annuler</button>
              <button type="button" disabled={legalBusy || (legalAction.decision !== 'verified' && legalDecisionNote.trim().length < 10)} onClick={() => void confirmLegalDecision()} className="inline-flex items-center gap-2 rounded-xl bg-[#193E30] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{legalBusy && <Loader2 size={15} className="animate-spin" />}Enregistrer la décision</button>
            </div>
          </section>
        </div>
      )}
      {pendingDecision && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0D241B]/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDecision(null); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="admin-decision-title" aria-describedby="admin-decision-description" className="w-full max-w-md rounded-[28px] border border-[#E9E2D5] bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3EBDC] text-[#85663A]"><ShieldAlert size={24} /></div>
            <h2 id="admin-decision-title" className="font-serif text-2xl font-semibold text-[#193E30]">Confirmer cette décision ?</h2>
            <p id="admin-decision-description" className="mt-3 text-sm leading-6 text-[#647267]">
              Vous allez {pendingDecision.status === 'approved' ? 'approuver' : pendingDecision.status === 'rejected' ? 'rejeter' : 'remettre en attente'} {"l’avis de"} <strong className="text-[#24352D]">{pendingDecision.name}</strong>. Cette action modifiera son statut dans Supabase.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPendingDecision(null)} className="rounded-xl border border-[#E9E2D5] px-5 py-3 text-sm font-semibold text-[#24352D] hover:bg-[#F8F7F3]">Retour</button>
              <button type="button" onClick={() => void confirmDecision()} className="rounded-xl bg-[#193E30] px-5 py-3 text-sm font-semibold text-white hover:bg-[#102D22]">Confirmer la décision</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




const SectionHeading: React.FC<{

  title: string;

  description: string;

  badge?: string;

}> = ({ title, description, badge }) => (

  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

    <div>

      <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#30352F]">{title}</h2>

      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#647267]">

        {description}

      </p>

    </div>

    {badge && (

      <span className="w-fit rounded-full border border-[#E9E2D5] bg-white px-3 py-1.5 text-[11px] font-bold text-[#647267]">

        {badge}

      </span>

    )}

  </div>

);



const StatCard: React.FC<{

  title: string;

  value: string;

  caption: string;

  icon: React.ElementType;

}> = ({ title, value, caption, icon: Icon }) => (

  <div className="rounded-[22px] border border-[#E9E2D5] bg-white p-4 sm:p-5 shadow-sm">

    <div className="flex items-start justify-between gap-3 sm:gap-4">

      <div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-[#647267]">

          {title}

        </p>

        <p className="mt-2 break-words font-serif text-xl min-[360px]:text-2xl font-bold text-[#30352F]">

          {value}

        </p>

      </div>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F1EA] text-[#284C3B]">

        <Icon size={19} />

      </div>

    </div>

    <p className="mt-3 text-[11px] leading-5 text-[#788176]">{caption}</p>

  </div>

);



const MiniMetric: React.FC<{

  label: string;

  value: number;

  icon: React.ElementType;

}> = ({ label, value, icon: Icon }) => (

  <div className="flex min-w-0 items-center gap-3 sm:gap-4 rounded-[22px] border border-[#E9E2D5] bg-white p-3 sm:p-4 shadow-sm">

    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5EF] text-[#284C3B]">

      <Icon size={18} />

    </div>

    <div>

      <p className="font-serif text-xl font-bold text-[#30352F]">{value}</p>

      <p className="text-xs text-[#647267]">{label}</p>

    </div>

  </div>

);



const QueueCard: React.FC<{

  title: string;

  count: number;

  description: string;

  action: string;

  onClick: () => void;

  icon: React.ElementType;

}> = ({ title, count, description, action, onClick, icon: Icon }) => (

  <button

    type="button"

    onClick={onClick}

    className="group rounded-2xl border border-[#E9E2D5] bg-[#F7F5EF] p-4 sm:p-5 text-left transition hover:border-[#C8D9CD] hover:bg-[#F6F8F1]"

  >

    <div className="flex items-start justify-between gap-3">

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#284C3B]">

        <Icon size={19} />

      </div>

      <span className="font-serif text-xl sm:text-2xl font-bold text-[#30352F]">

        {count}

      </span>

    </div>

    <p className="mt-4 font-bold text-[#30352F]">{title}</p>

    <p className="mt-1 text-xs leading-5 text-[#788176]">{description}</p>

    <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#284C3B]">

      {action}

      <ChevronRight

        size={14}

        className="transition group-hover:translate-x-0.5"

      />

    </span>

  </button>

);



const StatusBadge: React.FC<{

  label: string;

  status: string;

}> = ({ label, status }) => (

  <span

    className={cx(

      'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold',

      getStatusClasses(status)

    )}

  >

    {label}

  </span>

);



const ActionButton: React.FC<{

  label: string;

  loading: boolean;

  onClick: () => void;

  variant: 'primary' | 'secondary' | 'danger';

}> = ({ label, loading, onClick, variant }) => {

  const classes =

    variant === 'primary'

      ? 'bg-[#193E30] text-white hover:bg-[#1B382D]'

      : variant === 'danger'

        ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'

        : 'border border-[#E9E2D5] bg-white text-[#647267] hover:bg-[#F7F5EF]';



  return (

    <button

      type="button"

      onClick={onClick}

      disabled={loading}

      className={cx(

        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-60',

        classes

      )}

    >

      {loading && <Loader2 size={11} className="animate-spin" />}

      {label}

    </button>

  );

};



const ScorePill: React.FC<{ label: string; value: number }> = ({

  label,

  value,

}) => (

  <span className="rounded-full border border-[#E9E2D5] bg-[#F7F5EF] px-2.5 py-1">

    {label} : <strong>{value}/5</strong>

  </span>

);



const FinanceRow: React.FC<{ label: string; value: string }> = ({

  label,

  value,

}) => (

  <div className="flex flex-col gap-1.5 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-4 border-b border-[#F0EDE4] pb-3 last:border-b-0">

    <span className="text-sm text-[#647267]">{label}</span>

    <span className="font-bold text-[#30352F]">{value}</span>

  </div>

);



const ModuleState: React.FC<{ label: string; connected?: boolean }> = ({

  label,

  connected = false,

}) => (

  <div className="flex items-center gap-3 rounded-xl border border-[#E9E2D5] bg-[#F7F5EF] p-3">

    {connected ? (

      <CheckCircle2 size={17} className="shrink-0 text-[#284C3B]" />

    ) : (

      <Clock3 size={17} className="shrink-0 text-amber-700" />

    )}

    <div>

      <p className="text-xs font-bold text-[#30352F]">{label}</p>

      <p className="mt-0.5 text-[10px] text-[#788176]">

        {connected ? 'Connecté' : 'Backend à connecter'}

      </p>

    </div>

  </div>

);



export { AdminDashboardPage };

export default AdminDashboardPage;
