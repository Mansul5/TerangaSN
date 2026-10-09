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

  FileWarning,

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

  updateHotelStatus,

  updateReviewStatus,

} from '@/src/lib/supabase/api';

import { formatFCFA, formatDate, getCategoryLabel } from '@/src/lib/formatters';

import { useAuth } from '@/src/context/AuthContext';



interface AdminDashboardPageProps {

  onOpenAuth: () => void;

  onOpenSupabaseModal: () => void;

}



type AdminSection =

  | 'overview'

  | 'lodgings'

  | 'users'

  | 'bookings'

  | 'reports'

  | 'finances'

  | 'reviews'

  | 'sanctions'

  | 'settings';



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

  lodgings: 'Hébergements',

  users: 'Utilisateurs',

  bookings: 'Réservations',

  reports: 'Signalements & litiges',

  finances: 'Finances',

  reviews: 'Avis & modération',

  sanctions: 'Sanctions',

  settings: 'Paramètres',

};



const navItems: Array<{

  id: AdminSection;

  label: string;

  icon: React.ElementType;

}> = [

  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },

  { id: 'lodgings', label: 'Hébergements', icon: Building2 },

  { id: 'users', label: 'Utilisateurs', icon: Users },

  { id: 'bookings', label: 'Réservations', icon: CalendarDays },

  { id: 'reports', label: 'Signalements & litiges', icon: FileWarning },

  { id: 'finances', label: 'Finances', icon: WalletCards },

  { id: 'reviews', label: 'Avis & modération', icon: MessageSquareText },

  { id: 'sanctions', label: 'Sanctions', icon: Gavel },

  { id: 'settings', label: 'Paramètres', icon: Settings },

];



const cx = (...classes: Array<string | false | null | undefined>) =>

  classes.filter(Boolean).join(' ');



const getErrorMessage = (error: unknown) => {

  if (error instanceof Error) return error.message;

  if (typeof error === 'string') return error;

  return 'Une erreur inattendue est survenue.';

};



const getLodgingStatusLabel = (status: Lodging['status']) => {

  switch (status) {

    case 'published':

      return 'Publié';

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

}) => {

  const { user, role } = useAuth();



  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);

  const [lodgings, setLodgings] = useState<Lodging[]>([]);

  const [reviews, setReviews] = useState<Review[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  const [notice, setNotice] = useState('');

  const [lodgingSearch, setLodgingSearch] = useState('');

  const [lodgingStatus, setLodgingStatus] = useState<'all' | Lodging['status']>('all');

  const [reviewSearch, setReviewSearch] = useState('');

  const [reviewStatus, setReviewStatus] = useState<'all' | Review['status']>('all');

  const [busyAction, setBusyAction] = useState<string | null>(null);



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



  const handleLodgingStatus = async (

    lodging: Lodging,

    status: 'published' | 'rejected' | 'pending'

  ) => {

    const actionKey = `lodging-${lodging.id}-${status}`;

    setBusyAction(actionKey);

    setErrorMessage('');



    try {

      const { error } = await updateHotelStatus(lodging.id, status);

      if (error) throw error;



      setLodgings((current) =>

        current.map((item) =>

          item.id === lodging.id ? { ...item, status } : item

        )

      );



      setNotice(

        status === 'published'

          ? `${lodging.name} est maintenant publié.`

          : status === 'rejected'

            ? `${lodging.name} a été rejeté.`

            : `${lodging.name} a été replacé en attente de validation.`

      );

    } catch (error) {

      setErrorMessage(getErrorMessage(error));

    } finally {

      setBusyAction(null);

    }

  };



  const handleReviewStatus = async (

    review: Review,

    status: 'approved' | 'rejected' | 'pending'

  ) => {

    const actionKey = `review-${review.id}-${status}`;

    setBusyAction(actionKey);

    setErrorMessage('');



    try {

      const { error } = await updateReviewStatus(review.id, status);

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

        <div className="mx-auto max-w-xl rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white p-5 sm:p-8 text-center shadow-sm">

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

            className="mt-6 rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1B382D]"

          >

            Se connecter

          </button>

        </div>

      </div>

    );

  }



  if (role !== 'admin') {

    return (

      <div className="min-h-screen bg-[#F7F5EF] px-3 py-10 sm:px-4 sm:py-16">

        <div className="mx-auto max-w-xl rounded-2xl sm:rounded-3xl border border-rose-200 bg-white p-5 sm:p-8 text-center shadow-sm">

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



  const renderBackendPlaceholder = (

    title: string,

    description: string,

    items: string[]

  ) => (

    <div className="space-y-6">

      <SectionHeading

        title={title}

        description={description}

        badge="Backend à connecter"

      />



      <div className="rounded-2xl sm:rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-6">

        <div className="flex gap-3 sm:gap-4">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">

            <AlertTriangle size={21} />

          </div>

          <div>

            <h3 className="font-serif text-lg font-bold text-[#30352F]">

              Interface préparée, aucune fausse donnée

            </h3>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#647267]">

              Le service Supabase actuel ne fournit pas encore les opérations

              nécessaires pour ce module. Il sera connecté pendant la passe backend.

              Aucune action ci-dessous ne prétend modifier la base de données.

            </p>

          </div>

        </div>

      </div>



      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {items.map((item) => (

          <div

            key={item}

            className="rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5 shadow-sm"

          >

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9F1EA] text-[#284C3B]">

              <ShieldCheck size={19} />

            </div>

            <p className="font-bold text-[#30352F]">{item}</p>

            <p className="mt-2 text-xs leading-5 text-[#788176]">

              Structure prévue dans la console. Connexion serveur requise avant

              activation.

            </p>

          </div>

        ))}

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

            Standard : 8 % TTC uniquement sur les réservations issues de la marketplace. Pro : 0 % de commission TerangaSN. Les réservations directes sont à 0 % pour les deux formules. Les montants affichés proviennent du service de statistiques actuel et devront être vérifiés lors de la passe backend.

          </p>

        </div>

      </div>



      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

        <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

          <div className="flex flex-col gap-3 border-b border-[#E9E2D5] pb-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h3 className="font-serif text-lg font-bold text-[#30352F]">

                Files de modération

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



          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <QueueCard

              title="Hébergements à valider"

              count={pendingLodgings.length}

              description="Publication ou rejet depuis la console."

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

          </div>

        </div>



        <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-[#1B382D] p-4 sm:p-6 text-white shadow-sm">

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

              Litiges, sanctions et utilisateurs à connecter

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



      <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white shadow-sm">

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

            <option value="published">Publiés</option>

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

                      {lodging.status !== 'published' && (

                        <ActionButton

                          label="Publier"

                          loading={

                            busyAction === `lodging-${lodging.id}-published`

                          }

                          onClick={() =>

                            void handleLodgingStatus(lodging, 'published')

                          }

                          variant="primary"

                        />

                      )}

                      {lodging.status !== 'rejected' && (

                        <ActionButton

                          label="Rejeter"

                          loading={

                            busyAction === `lodging-${lodging.id}-rejected`

                          }

                          onClick={() =>

                            void handleLodgingStatus(lodging, 'rejected')

                          }

                          variant="danger"

                        />

                      )}

                      {lodging.status !== 'pending' && (

                        <ActionButton

                          label="Réexaminer"

                          loading={

                            busyAction === `lodging-${lodging.id}-pending`

                          }

                          onClick={() =>

                            void handleLodgingStatus(lodging, 'pending')

                          }

                          variant="secondary"

                        />

                      )}

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



      <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white shadow-sm">

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

                        void handleReviewStatus(review, 'approved')

                      }

                      variant="primary"

                    />

                  )}

                  {review.status !== 'rejected' && (

                    <ActionButton

                      label="Rejeter"

                      loading={busyAction === `review-${review.id}-rejected`}

                      onClick={() =>

                        void handleReviewStatus(review, 'rejected')

                      }

                      variant="danger"

                    />

                  )}

                  {review.status !== 'pending' && (

                    <ActionButton

                      label="Réexaminer"

                      loading={busyAction === `review-${review.id}-pending`}

                      onClick={() =>

                        void handleReviewStatus(review, 'pending')

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
        title="Centre des signalements et litiges"
        description="Un espace dédié aux échanges contradictoires, aux preuves et aux décisions documentées."
        badge="Interface en préparation"
      />
      <div className="flex items-start gap-3 rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#967644]" />
        <div>
          <h3 className="font-semibold text-[#1B382D]">Aucun dossier connecté pour le moment</h3>
          <p className="mt-1 text-sm leading-6 text-[#647267]">
            L'API actuelle ne fournit ni signalements, ni messages, ni pièces jointes. Aucun dossier fictif
            n'est présenté et aucune décision ne peut être prise depuis cet écran.
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-3xl border border-[#E9E2D5] bg-white shadow-sm">
          <div className="border-b border-[#E9E2D5] px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#967644]">Boîte de réception</p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-[#1B382D]">Dossiers à traiter</h3>
            <p className="mt-1 text-sm text-[#647267]">Recherche, priorités et affectation après connexion du backend.</p>
          </div>
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
            <FileWarning size={34} className="text-[#B79B69]" />
            <p className="mt-4 font-semibold text-[#30352F]">Aucune liste de dossiers disponible</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#647267]">Les signalements apparaîtront ici lorsqu'ils seront enregistrés et accessibles à l'administration.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[#E9E2D5] bg-white shadow-sm">
          <div className="border-b border-[#E9E2D5] px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#967644]">Dossier sélectionné</p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-[#1B382D]">Espace de médiation</h3>
            <p className="mt-1 text-sm text-[#647267]">Voyageur, hôte et administrateur, avec historique horodaté.</p>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#F7F5EF] p-4"><Users size={19} className="text-[#284C3B]" /><p className="mt-2 text-sm font-semibold">Parties concernées</p><p className="mt-1 text-xs text-[#647267]">Identités et rôles vérifiés</p></div>
              <div className="rounded-2xl bg-[#F7F5EF] p-4"><CalendarDays size={19} className="text-[#284C3B]" /><p className="mt-2 text-sm font-semibold">Réservation liée</p><p className="mt-1 text-xs text-[#647267]">Référence et chronologie</p></div>
            </div>
            <div className="rounded-2xl border border-dashed border-[#D8D0C1] p-5">
              <div className="flex items-center gap-2 font-semibold text-[#1B382D]"><MessageSquareText size={18} /> Conversation tripartite</div>
              <p className="mt-2 text-sm leading-6 text-[#647267]">Fil d'échanges, possibilité de réponses séparées ou communes et traçabilité des interventions administrateur.</p>
              <div className="mt-4 rounded-xl bg-[#F7F5EF] px-4 py-3 text-xs text-[#647267]">Messagerie désactivée tant que le stockage sécurisé et les autorisations ne sont pas disponibles.</div>
            </div>
            <div className="rounded-2xl border border-dashed border-[#D8D0C1] p-5">
              <div className="flex items-center gap-2 font-semibold text-[#1B382D]"><ShieldCheck size={18} /> Pièces et preuves</div>
              <p className="mt-2 text-sm leading-6 text-[#647267]">Photos, documents, accès contrôlé et historique des dépôts. Aucun fichier ne peut être envoyé pour l'instant.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-3xl bg-[#1B382D] p-5 text-white sm:p-7">
        <h3 className="font-serif text-xl font-semibold">Procédure de résolution prévue</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[
            ['01', 'Réception', 'Signalement et réservation associée'],
            ['02', 'Instruction', 'Échanges et preuves des deux parties'],
            ['03', 'Décision', 'Motif, mesure et validation admin'],
            ['04', 'Traçabilité', 'Notifications et journal d’audit'],
          ].map(([step, title, detail]) => (
            <div key={step} className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <span className="text-sm font-bold text-[#E3C58F]">{step}</span>
              <p className="mt-2 font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-white/75">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFinances = () => (

    <div className="space-y-6">

      <SectionHeading

        title="Finances & commissions"

        description="Vue prudente des montants actuellement disponibles dans les statistiques."

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

          caption="Standard : 8 % TTC marketplace · Pro : 0 % · Direct : 0 %"

          icon={Percent}

        />

      </div>



      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">

        <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

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



        <div className="rounded-2xl sm:rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-6">

          <AlertTriangle className="text-amber-700" size={24} />

          <h3 className="mt-4 font-serif text-lg font-bold text-[#30352F]">

            Backend financier à finaliser

          </h3>

          <p className="mt-2 text-sm leading-6 text-[#647267]">

            Les reversements hôtes, frais PSP, factures, historique de plan,

            commissions figées à la réservation et soldes réellement dus ne sont

            pas encore fournis par l'API Admin actuelle.

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

        title="Paramètres administrateur"

        description="Outils techniques et état des connexions de la console."

        badge="Interne"

      />



      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">

        <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

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



        <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

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



      <div className="rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white p-4 sm:p-6 shadow-sm">

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

          <ModuleState label="Finance marketplace" />

          <ModuleState label="Journal d'audit Admin" />

          <ModuleState label="Messagerie de litige" />

        </div>

      </div>

    </div>

  );



  const renderCurrentSection = () => {

    if (isLoading) return renderLoading();



    switch (activeSection) {

      case 'overview':

        return renderOverview();

      case 'lodgings':

        return renderLodgings();

      case 'users':

        return renderBackendPlaceholder(

          'Utilisateurs',

          'Gestion des voyageurs, hôtes et comptes sensibles.',

          [

            'Recherche et fiche utilisateur',

            'Capacités voyageur / hôte',

            'Vérification et historique',

            'Restriction temporaire',

            'Suspension et réactivation',

            'Historique des actions Admin',

          ]

        );

      case 'bookings':

        return renderBackendPlaceholder(

          'Réservations',

          'Supervision transversale de toutes les réservations de la plateforme.',

          [

            'Recherche par numéro de réservation',

            'Voyageur et hébergement liés',

            'Statut réservation et paiement',

            'Historique des changements',

            'Annulation exceptionnelle Admin',

            'Accès depuis un litige',

          ]

        );

      case 'reports':
        return renderReports();
      case 'finances':

        return renderFinances();

      case 'reviews':

        return renderReviews();

      case 'sanctions':

        return renderBackendPlaceholder(

          'Sanctions & restrictions',

          'Application progressive des mesures administratives avec traçabilité.',

          [

            'Avertissement',

            'Pénalité financière justifiée',

            'Restriction temporaire',

            'Suspension de compte',

            'Désactivation définitive',

            'Motif, durée et note Admin',

          ]

        );

      case 'settings':

        return renderSettings();

      default:

        return renderOverview();

    }

  };



  return (

    <div className="min-h-screen bg-[#F7F5EF] text-[#30352F]">

      <header className="border-b border-[#1B382D] bg-[#284C3B] text-white">

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

            <div className="w-full min-w-0 min-[380px]:w-auto rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs break-all min-[380px]:break-normal">

              <span className="text-[#E3EDE4]">Connecté : </span>

              <span className="font-bold">{user.email || 'Administrateur'}</span>

            </div>

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



      <div className="mx-auto grid max-w-[1600px] gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">

        <aside className="border-b border-[#E9E2D5] bg-white lg:min-h-[calc(100vh-89px)] lg:border-b-0 lg:border-r">

          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] p-2.5 sm:p-3 lg:sticky lg:top-0 lg:p-4">

            <nav className="flex min-w-max gap-1.5 sm:gap-2 lg:min-w-0 lg:flex-col">

              {navItems.map((item) => {

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



        <main className="min-w-0 p-3 sm:p-6 lg:p-8">

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



          {renderCurrentSection()}

        </main>

      </div>

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

  <div className="rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:p-5 shadow-sm">

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

  <div className="flex min-w-0 items-center gap-3 sm:gap-4 rounded-2xl border border-[#E9E2D5] bg-white p-3 sm:p-4 shadow-sm">

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

      ? 'bg-[#284C3B] text-white hover:bg-[#1B382D]'

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
