/**
 * TerangaSN Manager — interface hôte.
 * Les réservations manuelles et les modifications locales restent des aperçus
 * sans persistance Supabase. Ne pas utiliser ces données pour garantir une disponibilité.
 */
import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BarChart3,
  Bed,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Eye,
  FileText,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  PlusCircle,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  WalletCards,
  X,
  XCircle,
  Download,
  UserRound,
  LogIn,
  LogOut,
  AlertCircle,
  Search,
  Filter,
} from 'lucide-react';

import {
  Lodging,
  RoomType,
  Booking,
} from '@/src/types';

import {
  fetchOwnerHotels,
  fetchHotelBookings,
  fetchHotelRooms,
  createRoomType,
  updateBookingStatus,
} from '@/src/lib/supabase/api';

import {
  formatFCFA,
  formatDate,
} from '@/src/lib/formatters';

import { useAuth } from '@/src/context/AuthContext';

import { RoomAvailabilityCalendar } from '@/src/components/hotelier/RoomAvailabilityCalendar';

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hôtel',
  lodge: 'Lodge & Écolodge',
  campement: 'Campement touristique',
  residence: 'Résidence',
  villa: 'Villa',
  appartement: 'Appartement',
  chambre_hotes: "Chambre d'hôtes",
};

const getCategoryLabel = (
  category: string
) =>
  CATEGORY_LABELS[category] ||
  'Hébergement';

type ManualSource = 'whatsapp' | 'telephone' | 'sur_place' | 'autre';
interface ManualReservation {
  id: string;
  hotelId: string;
  roomId: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  source: ManualSource;
  amount: number;
  status: 'confirmed' | 'cancelled';
  payment: 'unpaid' | 'paid';
}
const manualSourceLabels: Record<ManualSource, string> = {
  whatsapp: 'WhatsApp', telephone: 'Téléphone', sur_place: 'Sur place', autre: 'Autre',
};
const dateOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart < bEnd && bStart < aEnd;
const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const downloadCSV = (name: string, rows: unknown[][]) => {
  const content = '\uFEFF' + rows.map(row => row.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

interface HotelierDashboardPageProps {
  onOpenAuth: () => void;
  onOpenSupabaseModal: () => void;
  onAddLodging: () => void;
}

type DashboardSection =
  | 'overview'
  | 'reception'
  | 'operations'
  | 'team'
  | 'subscription'
  | 'lodgings'
  | 'bookings'
  | 'clients'
  | 'rooms'
  | 'calendar'
  | 'finances'
  | 'statistics'
  | 'reviews'
  | 'settings';

const getBookingStatusLabel = (
  status: string
) => {
  switch (status) {
    case 'confirmed':
      return 'Confirmée';

    case 'pending':
      return 'En attente';

    case 'cancelled':
      return 'Annulée';

    case 'completed':
      return 'Terminée';

    default:
      return status;
  }
};

const getBookingStatusClasses = (
  status: string
) => {
  switch (status) {
    case 'confirmed':
      return 'bg-[#EFF3ED] text-[#284C3B] border-[#D1DBC2]';

    case 'pending':
      return 'bg-[#FFF7E8] text-[#9A6700] border-[#F2D9A6]';

    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';

    case 'completed':
      return 'bg-[#EEF4F8] text-[#36566C] border-[#D7E3EA]';

    default:
      return 'bg-[#F4F2EC] text-[#6B6658] border-[#E9E2D5]';
  }
};

export const HotelierDashboardPage: React.FC<
  HotelierDashboardPageProps
> = ({
  onOpenAuth,
  onOpenSupabaseModal,
  onAddLodging,
}) => {
  const { user } = useAuth();

  const [hotels, setHotels] =
    useState<Lodging[]>([]);

  const [
    selectedHotel,
    setSelectedHotel,
  ] = useState<Lodging | null>(null);

  const [bookings, setBookings] =
    useState<Booking[]>([]);

  const [rooms, setRooms] =
    useState<RoomType[]>([]);

  // Brouillons de démonstration, uniquement en mémoire : aucune écriture en base.
  const [manualReservations, setManualReservations] = useState<ManualReservation[]>([]);

  // Ne jamais laisser les brouillons de démonstration visibles après déconnexion.
  useEffect(() => {
    if (!user) setManualReservations([]);
  }, [user?.id]);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [
    activeSection,
    setActiveSection,
  ] =
    useState<DashboardSection>('overview');

  const [
    calendarSelectedRoomId,
    setCalendarSelectedRoomId,
  ] = useState<string>('');

  const [
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  ] = useState(false);

  // ---------------------------------------------------------------------------
  // New room / offer
  // ---------------------------------------------------------------------------

  const [
    isAddRoomOpen,
    setIsAddRoomOpen,
  ] = useState(false);

  const [
    newRoomName,
    setNewRoomName,
  ] = useState('');

  const [
    newRoomPrice,
    setNewRoomPrice,
  ] = useState(45000);

  const [
    newRoomCapacity,
    setNewRoomCapacity,
  ] = useState(2);

  const [
    newRoomQty,
    setNewRoomQty,
  ] = useState(5);

  const [
    newRoomBedType,
    setNewRoomBedType,
  ] = useState(
    '1 Grand Lit King-size'
  );

  const [
    newRoomBreakfast,
    setNewRoomBreakfast,
  ] = useState(true);

  const [
    newRoomPhotoUrl,
    setNewRoomPhotoUrl,
  ] = useState('');

  const [
    isCreatingRoom,
    setIsCreatingRoom,
  ] = useState(false);

  // ---------------------------------------------------------------------------
  // Room / offer editor (frontend draft only)
  // ---------------------------------------------------------------------------

  const [editingRoom, setEditingRoom] =
    useState<RoomType | null>(null);

  const [
    editingRoomDraft,
    setEditingRoomDraft,
  ] = useState<Partial<RoomType> | null>(null);

  const [
    hasEditingRoomChanges,
    setHasEditingRoomChanges,
  ] = useState(false);

  // ---------------------------------------------------------------------------
  // Lodging profile editor (frontend draft only)
  // ---------------------------------------------------------------------------

  const [
    lodgingDraft,
    setLodgingDraft,
  ] = useState<Partial<Lodging> | null>(null);

  const [
    hasLodgingDraftChanges,
    setHasLodgingDraftChanges,
  ] = useState(false);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  const loadHotelSpecificData = async (
    hotelId: string
  ) => {
    try {
      const [
        bookingsResult,
        roomsResult,
      ] = await Promise.all([
        fetchHotelBookings(hotelId),
        fetchHotelRooms(hotelId),
      ]);

      setBookings(
        bookingsResult.data || []
      );

      setRooms(
        roomsResult.data || []
      );
    } catch (error) {
      console.error(
        'Hotel detail fetch error:',
        error
      );

      setBookings([]);
      setRooms([]);
    }
  };

  const loadOwnerData = async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } =
        await fetchOwnerHotels(user.id);

      if (error) {
        console.warn(
          'Error fetching owner hotels:',
          error
        );
      }

      const ownerHotels =
        data || [];

      setHotels(ownerHotels);

      if (ownerHotels.length > 0) {
        const current =
          selectedHotel
            ? ownerHotels.find(
                (hotel) =>
                  hotel.id ===
                  selectedHotel.id
              ) || ownerHotels[0]
            : ownerHotels[0];

        setSelectedHotel(current);

        await loadHotelSpecificData(
          current.id
        );
      } else {
        setSelectedHotel(null);
        setBookings([]);
        setRooms([]);
      }
    } catch (error) {
      console.error(
        'Owner data loading error:',
        error
      );

      setHotels([]);
      setSelectedHotel(null);
      setBookings([]);
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void loadOwnerData();
    } else {
      setHotels([]);
      setSelectedHotel(null);
      setBookings([]);
      setRooms([]);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedHotel) {
      setLodgingDraft({
        ...selectedHotel,
        photos: [
          ...(selectedHotel.photos || []),
        ],
        amenities: [
          ...(selectedHotel.amenities || []),
        ],
      });

      setHasLodgingDraftChanges(false);
    } else {
      setLodgingDraft(null);
      setHasLodgingDraftChanges(false);
    }
  }, [selectedHotel]);

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  const handleHotelChange = async (
    lodging: Lodging
  ) => {
    setSelectedHotel(lodging);
    setCalendarSelectedRoomId('');
    setIsLoading(true);

    try {
      await loadHotelSpecificData(
        lodging.id
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Lodging profile draft actions
  // ---------------------------------------------------------------------------

  const updateLodgingDraft = (
    field: keyof Lodging,
    value: any
  ) => {
    setLodgingDraft((previous) => ({
      ...(previous || {}),
      [field]: value,
    }));

    setHasLodgingDraftChanges(true);
  };

  const resetLodgingDraft = () => {
    if (!selectedHotel) {
      return;
    }

    setLodgingDraft({
      ...selectedHotel,
      photos: [
        ...(selectedHotel.photos || []),
      ],
      amenities: [
        ...(selectedHotel.amenities || []),
      ],
    });

    setHasLodgingDraftChanges(false);
  };

  const applyLodgingDraftLocally = () => {
    if (
      !selectedHotel ||
      !lodgingDraft
    ) {
      return;
    }

    const updatedLodging = {
      ...selectedHotel,
      ...lodgingDraft,
    } as Lodging;

    setSelectedHotel(
      updatedLodging
    );

    setHotels((previous) =>
      previous.map((hotel) =>
        hotel.id ===
        updatedLodging.id
          ? updatedLodging
          : hotel
      )
    );

    setLodgingDraft({
      ...updatedLodging,
      photos: [
        ...(updatedLodging.photos ||
          []),
      ],
      amenities: [
        ...(updatedLodging.amenities ||
          []),
      ],
    });

    setHasLodgingDraftChanges(false);
  };

  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Booking actions
  // ---------------------------------------------------------------------------

  const handleUpdateBookingStatus =
    async (
      bookingId: string,
      newStatus:
        | 'confirmed'
        | 'cancelled'
        | 'completed'
    ) => {
      if (updatingBookingId) return;
      setUpdatingBookingId(bookingId);
      try {
        // La confirmation d'un séjour ne prouve jamais son paiement.
        const paymentStatus = undefined;

        const { error } =
          await updateBookingStatus(
            bookingId,
            newStatus,
            paymentStatus
          );

        if (error) {
          throw error;
        }

        setBookings(
          (previousBookings) =>
            previousBookings.map(
              (booking) =>
                booking.id ===
                bookingId
                  ? {
                      ...booking,
                      status:
                        newStatus,
                      payment_status:
                        paymentStatus ||
                        booking.payment_status,
                    }
                  : booking
            )
        );
      } catch (error: any) {
        alert(
          error?.message ||
            'Erreur lors de la mise à jour du statut.'
        );
      } finally {
        setUpdatingBookingId(null);
      }
    };

  // ---------------------------------------------------------------------------
  // Create room
  // ---------------------------------------------------------------------------

  const resetRoomForm = () => {
    setNewRoomName('');
    setNewRoomPrice(45000);
    setNewRoomCapacity(2);
    setNewRoomQty(5);
    setNewRoomBedType(
      '1 Grand Lit King-size'
    );
    setNewRoomBreakfast(true);
    setNewRoomPhotoUrl('');
  };

  const handleCreateRoomSubmit =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();

      if (!selectedHotel) {
        return;
      }

      if (!newRoomName.trim()) {
        alert(
          "Veuillez renseigner le nom de l'offre."
        );
        return;
      }

      if (newRoomPrice <= 0) {
        alert(
          'Le prix par nuit doit être supérieur à 0.'
        );
        return;
      }

      if (newRoomQty <= 0) {
        alert(
          'La quantité disponible doit être supérieure à 0.'
        );
        return;
      }

      setIsCreatingRoom(true);

      try {
        // Ne jamais attribuer une photo d'un autre établissement à une chambre réelle.
        const photos = newRoomPhotoUrl.trim() ? [newRoomPhotoUrl.trim()] : [];

        const { error } =
          await createRoomType({
            hotel_id:
              selectedHotel.id,

            name:
              newRoomName.trim(),

            capacity_adults:
              newRoomCapacity,

            capacity_children: 1,

            price_per_night:
              newRoomPrice,

            total_rooms:
              newRoomQty,

            bed_type:
              newRoomBedType.trim(),

            breakfast_included:
              newRoomBreakfast,

            cancellation_policy:
              'free_cancellation',

            amenities: [
              'wifi',
              'air_conditioning',
            ],

            photos,
          });

        if (error) {
          throw error;
        }

        setIsAddRoomOpen(false);
        resetRoomForm();

        await loadHotelSpecificData(
          selectedHotel.id
        );
      } catch (error: any) {
        alert(
          error?.message ||
            "Erreur lors de l'ajout de l'offre."
        );
      } finally {
        setIsCreatingRoom(false);
      }
    };

  // ---------------------------------------------------------------------------
  // Edit room / offer locally
  // ---------------------------------------------------------------------------

  const openRoomEditor = (room: RoomType) => {
    setEditingRoom(room);
    setEditingRoomDraft({
      ...room,
      photos: [...(room.photos || [])],
      amenities: [...(room.amenities || [])],
    });
    setHasEditingRoomChanges(false);
  };

  const closeRoomEditor = () => {
    setEditingRoom(null);
    setEditingRoomDraft(null);
    setHasEditingRoomChanges(false);
  };

  const updateEditingRoomDraft = (
    field: keyof RoomType,
    value: any
  ) => {
    setEditingRoomDraft((previous) => ({
      ...(previous || {}),
      [field]: value,
    }));
    setHasEditingRoomChanges(true);
  };

  const resetEditingRoomDraft = () => {
    if (!editingRoom) return;

    setEditingRoomDraft({
      ...editingRoom,
      photos: [...(editingRoom.photos || [])],
      amenities: [...(editingRoom.amenities || [])],
    });
    setHasEditingRoomChanges(false);
  };

  const applyEditingRoomLocally = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!editingRoom || !editingRoomDraft) return;

    const name = String(
      editingRoomDraft.name || ''
    ).trim();
    const price = Number(
      editingRoomDraft.price_per_night || 0
    );
    const quantity = Number(
      editingRoomDraft.total_rooms || 0
    );
    const capacityAdults = Number(
      editingRoomDraft.capacity_adults || 0
    );

    if (!name) {
      alert("Veuillez renseigner le nom de l'offre.");
      return;
    }

    if (price <= 0) {
      alert('Le prix par nuit doit être supérieur à 0.');
      return;
    }

    if (quantity <= 0) {
      alert('Le nombre de chambres doit être supérieur à 0.');
      return;
    }

    if (capacityAdults <= 0) {
      alert('La capacité adulte doit être supérieure à 0.');
      return;
    }

    const updatedRoom = {
      ...editingRoom,
      ...editingRoomDraft,
      name,
      price_per_night: price,
      total_rooms: quantity,
      capacity_adults: capacityAdults,
    } as RoomType;

    setRooms((previous) =>
      previous.map((room) =>
        room.id === updatedRoom.id
          ? updatedRoom
          : room
      )
    );

    closeRoomEditor();
  };

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const confirmedBookings =
    useMemo(
      () =>
        bookings.filter(
          (booking) =>
            booking.status ===
              'confirmed' ||
            booking.status ===
              'completed'
        ),
      [bookings]
    );

  const pendingBookings =
    useMemo(
      () =>
        bookings.filter(
          (booking) =>
            booking.status ===
            'pending'
        ),
      [bookings]
    );

  const totalRevenue =
    useMemo(
      () =>
        confirmedBookings.reduce(
          (total, booking) =>
            total +
            (booking.total_price ||
              0),
          0
        ),
      [confirmedBookings]
    );

  const pendingRevenue =
    useMemo(
      () =>
        pendingBookings.reduce(
          (total, booking) =>
            total +
            (booking.total_price ||
              0),
          0
        ),
      [pendingBookings]
    );

  const totalNights =
    useMemo(
      () =>
        confirmedBookings.reduce(
          (total, booking) =>
            total +
            (booking.nights_count ||
              0),
          0
        ),
      [confirmedBookings]
    );

  const recordedCommission =
    useMemo(
      () =>
        confirmedBookings.reduce(
          (total, booking) =>
            total +
            (booking.commission_amount ||
              0),
          0
        ),
      [confirmedBookings]
    );

  const cancelledBookings =
    useMemo(
      () =>
        bookings.filter(
          (booking) =>
            booking.status === 'cancelled'
        ),
      [bookings]
    );

  const completedBookings =
    useMemo(
      () =>
        bookings.filter(
          (booking) =>
            booking.status === 'completed'
        ),
      [bookings]
    );

  const averageStay =
    confirmedBookings.length > 0
      ? totalNights / confirmedBookings.length
      : 0;

  const averageBookingValue =
    confirmedBookings.length > 0
      ? totalRevenue / confirmedBookings.length
      : 0;

  const cancellationRate =
    bookings.length > 0
      ? Math.round(
          (cancelledBookings.length / bookings.length) *
            100
        )
      : 0;

  const netRecordedRevenue = Math.max(
    0,
    totalRevenue - recordedCommission
  );

  const recentBookings = useMemo(
    () => [...bookings].sort((a, b) =>
      String((b as Booking & { created_at?: string }).created_at || b.check_in).localeCompare(
        String((a as Booking & { created_at?: string }).created_at || a.check_in)
      )
    ).slice(0, 5),
    [bookings]
  );

  const profileCompletion =
    useMemo(() => {
      if (!selectedHotel) {
        return 0;
      }

      const checks = [
        Boolean(
          selectedHotel.name
        ),
        Boolean(
          selectedHotel.description
        ),
        Boolean(
          selectedHotel.address
        ),
        Boolean(
          selectedHotel.phone
        ),
        Boolean(
          selectedHotel.email
        ),
        Boolean(
          selectedHotel.photos &&
            selectedHotel.photos
              .length > 0
        ),
        rooms.length > 0,
      ];

      const completed =
        checks.filter(Boolean).length;

      return Math.round(
        (completed /
          checks.length) *
          100
      );
    }, [selectedHotel, rooms]);

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#F7F5EF] p-4">
        <div className="max-w-md space-y-5 rounded-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white p-5 sm:p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF3ED] text-[#284C3B]">
            <Building2
              size={27}
            />
          </div>

          <div>
            <h2 className="font-serif text-xl font-bold">
              Espace hôte
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-[#6B6658]">
              Connectez-vous à votre
              compte pour gérer vos
              hébergements et vos
              réservations.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1B382D]"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const navigationItems: Array<{
    id: DashboardSection;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }> = [
    {
      id: 'overview',
      label: "Vue d'ensemble",
      icon: Home,
    },
    { id: 'reception', label: 'Réception', icon: LogIn },
    { id: 'operations', label: 'Ménage & maintenance', icon: ShieldCheck },
    {
      id: 'lodgings',
      label: 'Établissements',
      icon: Building2,
      badge: hotels.length,
    },
    {
      id: 'bookings',
      label: 'Réservations',
      icon: Calendar,
      badge:
        pendingBookings.length,
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: UserRound,
    },
    {
      id: 'rooms',
      label: 'Chambres & offres',
      icon: Bed,
      badge: rooms.length,
    },
    {
      id: 'calendar',
      label: 'Calendrier',
      icon: Clock,
    },
    {
      id: 'finances',
      label: 'Finances',
      icon: WalletCards,
    },
    {
      id: 'statistics',
      label: 'Statistiques',
      icon: BarChart3,
    },
    {
      id: 'reviews',
      label: 'Avis',
      icon: Star,
    },
    { id: 'team', label: 'Équipe · Pro', icon: Users },
    { id: 'subscription', label: 'Abonnement', icon: Sparkles },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: Settings,
    },
  ];

  const changeSection = (
    section: DashboardSection
  ) => {
    setActiveSection(section);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}

      <header className="border-b border-[#1B382D] bg-[#284C3B] text-white">
        <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#B79B69]" />

                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E1E8DF]">
                  Espace hôte
                </span>
              </div>

              <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">
                Gérez votre activité
              </h1>
            </div>

            <div className="flex flex-col min-[380px]:flex-row min-[380px]:flex-wrap min-[380px]:items-center gap-2">
              {hotels.length >
                0 && (
                <div className="flex w-full min-w-0 min-[380px]:w-auto items-center gap-2 rounded-xl border border-white/15 bg-black/10 px-3 py-2">
                  <Building2
                    size={16}
                    className="shrink-0 text-[#E1E8DF]"
                  />

                  <select
                    value={
                      selectedHotel?.id ||
                      ''
                    }
                    onChange={(
                      event
                    ) => {
                      const lodging =
                        hotels.find(
                          (item) =>
                            item.id ===
                            event.target
                              .value
                        );

                      if (lodging) {
                        void handleHotelChange(
                          lodging
                        );
                      }
                    }}
                    className="min-w-0 w-full max-w-[220px] cursor-pointer bg-transparent text-xs font-bold text-white outline-none"
                    aria-label="Établissement actif"
                  >
                    {hotels.map(
                      (hotel) => (
                        <option
                          key={
                            hotel.id
                          }
                          value={
                            hotel.id
                          }
                          className="bg-[#1B382D]"
                        >
                          {hotel.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              <button type="button" onClick={() => void loadOwnerData()} disabled={isLoading} title="Actualiser les données" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50"><RefreshCw size={15}/> Actualiser</button>
              <button
                type="button"
                onClick={onAddLodging}
                className="inline-flex w-full min-[380px]:w-auto items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#284C3B] transition hover:bg-[#F2F5EE]"
              >
                <PlusCircle
                  size={16}
                />
                Ajouter un hébergement
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* MOBILE NAV                                                       */}
      {/* ================================================================ */}

      <div className="border-b border-[#E9E2D5] bg-white lg:hidden">
        <div className="px-3 py-3 sm:px-6">
          <button
            type="button"
            onClick={() =>
              setIsMobileMenuOpen(
                (previous) =>
                  !previous
              )
            }
            className="flex w-full items-center justify-between rounded-xl border border-[#E9E2D5] px-4 py-3 text-sm font-bold"
          >
            <span>
              {
                navigationItems.find(
                  (item) =>
                    item.id ===
                    activeSection
                )?.label
              }
            </span>

            <MoreHorizontal
              size={18}
            />
          </button>

          {isMobileMenuOpen && (
            <div className="mt-2 grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 rounded-2xl border border-[#E9E2D5] bg-white p-2 shadow-lg">
              {navigationItems.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() =>
                        changeSection(
                          item.id
                        )
                      }
                      className={`flex items-center gap-2 rounded-xl px-3 py-3 text-left text-xs font-bold ${
                        activeSection ===
                        item.id
                          ? 'bg-[#EFF3ED] text-[#284C3B]'
                          : 'text-[#6B6658] hover:bg-[#F7F5EF]'
                      }`}
                    >
                      <Icon
                        size={16}
                      />

                      <span className="truncate">
                        {
                          item.label
                        }
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* LAYOUT                                                           */}
      {/* ================================================================ */}

      <div className="mx-auto flex max-w-[1500px]">
        {/* SIDEBAR */}

        <aside className="hidden w-[250px] shrink-0 border-r border-[#E9E2D5] bg-white lg:block">
          <div className="sticky top-0 p-4">
            <p className="px-3 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#999489]">
              Gestion
            </p>

            <nav className="space-y-1">
              {navigationItems.map(
                (item) => {
                  const Icon =
                    item.icon;

                  const active =
                    activeSection ===
                    item.id;

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() =>
                        changeSection(
                          item.id
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? 'bg-[#EFF3ED] text-[#284C3B]'
                          : 'text-[#59645B] hover:bg-[#F7F5EF] hover:text-[#30352F]'
                      }`}
                    >
                      <Icon
                        size={18}
                      />

                      <span className="flex-1">
                        {
                          item.label
                        }
                      </span>

                      {typeof item.badge ===
                        'number' &&
                        item.badge >
                          0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              active
                                ? 'bg-[#284C3B] text-white'
                                : 'bg-[#E9E2D5] text-[#6B6658]'
                            }`}
                          >
                            {
                              item.badge
                            }
                          </span>
                        )}
                    </button>
                  );
                }
              )}
            </nav>

            <div className="mt-6 rounded-2xl border border-[#DCE7DD] bg-[#F4F7F1] p-4">
              <ShieldCheck
                size={20}
                className="text-[#284C3B]"
              />

              <p className="mt-3 text-xs font-bold text-[#30352F]">
                Espace sécurisé
              </p>

              <p className="mt-1 text-[11px] leading-relaxed text-[#6F756D]">
                Les vérifications
                nécessaires à la
                publication seront
                demandées
                progressivement.
              </p>
            </div>
          </div>
        </aside>

        {/* CONTENT */}

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {isLoading ? (
            <LoadingState />
          ) : hotels.length ===
              0 ? (
            <EmptyHostState
              onCreate={onAddLodging}
            />
          ) : (
            selectedHotel && (
              <div className="space-y-6">
                {/* PROPERTY CONTEXT */}

                <LodgingContextCard
                  lodging={
                    selectedHotel
                  }
                  completion={
                    profileCompletion
                  }
                  onOpenSettings={() =>
                    changeSection(
                      'settings'
                    )
                  }
                />

                {/* OVERVIEW */}

                {activeSection ===
                  'overview' && (
                  <OverviewSection
                    bookings={
                      bookings
                    }
                    recentBookings={
                      recentBookings
                    }
                    rooms={rooms}
                    totalRevenue={
                      totalRevenue
                    }
                    pendingRevenue={
                      pendingRevenue
                    }
                    totalNights={
                      totalNights
                    }
                    pendingCount={
                      pendingBookings.length
                    }
                    profileCompletion={
                      profileCompletion
                    }
                    onNavigate={
                      changeSection
                    }
                    onUpdateBookingStatus={
                      handleUpdateBookingStatus
                    }
                  />
                )}

                {activeSection === 'reception' && (
                  <ReceptionWorkspace bookings={bookings} onOpenBookings={() => changeSection('bookings')} />
                )}
                {activeSection === 'operations' && (
                  <OperationsWorkspace rooms={rooms} />
                )}
                {activeSection === 'team' && (
                  <ProWorkspace title="Gestion du personnel" description="Jusqu'à 5 collaborateurs avec des rôles distincts sur Pro. Les invitations et les permissions nécessitent une vérification d'abonnement et des droits côté serveur." />
                )}
                {activeSection === 'subscription' && (
                  <SubscriptionWorkspace />
                )}

                {/* LODGINGS */}

                {activeSection ===
                  'lodgings' && (
                  <LodgingsSection
                    hotels={
                      hotels
                    }
                    selectedHotel={
                      selectedHotel
                    }
                    onSelect={
                      handleHotelChange
                    }
                    onCreate={onAddLodging}
                  />
                )}

                {/* BOOKINGS */}

                {activeSection ===
                  'bookings' && (
                  <BookingsSection
                    bookings={
                      bookings
                    }
                    lodgingName={
                      selectedHotel.name
                    }
                    updatingBookingId={updatingBookingId}
                    onUpdateStatus={
                      handleUpdateBookingStatus
                    }
                    rooms={rooms}
                    hotelId={selectedHotel.id}
                    manualReservations={manualReservations.filter(r => r.hotelId === selectedHotel.id)}
                    onAddManual={(reservation) => setManualReservations(previous => [...previous, reservation])}
                    onUpdateManual={(id, patch) => setManualReservations(previous => previous.map(r => r.id === id ? { ...r, ...patch } : r))}
                  />
                )}

                {activeSection === 'clients' && (
                  <ClientsSection bookings={bookings} manualReservations={manualReservations.filter(r => r.hotelId === selectedHotel.id)} />
                )}

                                {/* ROOMS */}

                {activeSection ===
                  'rooms' && (
                  <RoomsSection
                    rooms={rooms}
                    onEdit={openRoomEditor}
                    onCreate={() =>
                      setIsAddRoomOpen(
                        true
                      )
                    }
                    onCalendar={(
                      roomId
                    ) => {
                      setCalendarSelectedRoomId(
                        roomId
                      );

                      changeSection(
                        'calendar'
                      );
                    }}
                  />
                )}

                {/* CALENDAR */}

                {activeSection ===
                  'calendar' && (
                  <RoomAvailabilityCalendar
                    rooms={rooms}
                    selectedRoomId={
                      calendarSelectedRoomId ||
                      (rooms.length >
                      0
                        ? rooms[0]
                            .id
                        : undefined)
                    }
                    onRoomSelect={(
                      id
                    ) =>
                      setCalendarSelectedRoomId(
                        id
                      )
                    }
                  />
                )}

                {/* FINANCES */}

                {activeSection ===
                  'finances' && (
                  <FinancesSection
                    totalRevenue={
                      totalRevenue
                    }
                    pendingRevenue={
                      pendingRevenue
                    }
                    recordedCommission={
                      recordedCommission
                    }
                    netRecordedRevenue={netRecordedRevenue}
                    bookings={
                      bookings
                    }
                  />
                )}

                {/* STATISTICS */}

                {activeSection ===
                  'statistics' && (
                  <StatisticsSection
                    bookings={
                      bookings
                    }
                    rooms={rooms}
                    totalRevenue={
                      totalRevenue
                    }
                    totalNights={
                      totalNights
                    }
                    averageStay={averageStay}
                    averageBookingValue={averageBookingValue}
                    cancellationRate={cancellationRate}
                  />
                )}

                {/* REVIEWS */}

                {activeSection ===
                  'reviews' && (
                  <ReviewsSection
                    lodging={selectedHotel}
                    completedBookings={completedBookings.length}
                  />
                )}

                {/* SETTINGS */}

                {activeSection ===
                  'settings' && (
                  <SettingsSection
                    lodging={
                      selectedHotel
                    }
                    draft={
                      lodgingDraft
                    }
                    completion={
                      profileCompletion
                    }
                    hasChanges={
                      hasLodgingDraftChanges
                    }
                    onChange={
                      updateLodgingDraft
                    }
                    onReset={
                      resetLodgingDraft
                    }
                    onSaveLocal={
                      applyLodgingDraftLocally
                    }
                    onOpenSupabaseModal={
                      onOpenSupabaseModal
                    }
                  />
                )}
              </div>
            )
          )}
        </main>
      </div>

      {/* ================================================================ */}
      {/* CREATE ROOM MODAL                                                */}
      {/* ================================================================ */}

      {isAddRoomOpen &&
        selectedHotel && (
          <ModalShell
            title="Ajouter une chambre / offre"
            subtitle={
              selectedHotel.name
            }
            onClose={() =>
              setIsAddRoomOpen(
                false
              )
            }
            compact
          >
            <form
              onSubmit={
                handleCreateRoomSubmit
              }
              className="space-y-5"
            >
              <FormField
                label="Nom de l’offre"
                required
              >
                <FormInput
                  value={
                    newRoomName
                  }
                  onChange={(
                    event
                  ) =>
                    setNewRoomName(
                      event.target
                        .value
                    )
                  }
                  placeholder="Ex. Chambre double vue mer"
                  required
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Prix / nuit"
                  required
                >
                  <FormInput
                    type="number"
                    min={1}
                    value={
                      newRoomPrice
                    }
                    onChange={(
                      event
                    ) =>
                      setNewRoomPrice(
                        Number(
                          event
                            .target
                            .value
                        )
                      )
                    }
                    required
                  />
                </FormField>

                <FormField
                  label="Quantité"
                  required
                >
                  <FormInput
                    type="number"
                    min={1}
                    value={
                      newRoomQty
                    }
                    onChange={(
                      event
                    ) =>
                      setNewRoomQty(
                        Number(
                          event
                            .target
                            .value
                        )
                      )
                    }
                    required
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Capacité adultes">
                  <FormInput
                    type="number"
                    min={1}
                    max={20}
                    value={
                      newRoomCapacity
                    }
                    onChange={(
                      event
                    ) =>
                      setNewRoomCapacity(
                        Number(
                          event
                            .target
                            .value
                        )
                      )
                    }
                  />
                </FormField>

                <FormField label="Type de lit">
                  <FormInput
                    value={
                      newRoomBedType
                    }
                    onChange={(
                      event
                    ) =>
                      setNewRoomBedType(
                        event.target
                          .value
                      )
                    }
                  />
                </FormField>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E9E2D5] p-4 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={
                    newRoomBreakfast
                  }
                  onChange={(
                    event
                  ) =>
                    setNewRoomBreakfast(
                      event.target
                        .checked
                    )
                  }
                  className="h-4 w-4 accent-[#284C3B]"
                />

                Petit-déjeuner inclus
              </label>

              <FormField
                label="Photo"
                hint="URL temporaire"
              >
                <FormInput
                  type="url"
                  value={
                    newRoomPhotoUrl
                  }
                  onChange={(
                    event
                  ) =>
                    setNewRoomPhotoUrl(
                      event.target
                        .value
                    )
                  }
                  placeholder="https://..."
                />
              </FormField>

              <ModalActions
                loading={
                  isCreatingRoom
                }
                submitLabel="Ajouter l’offre"
                loadingLabel="Ajout..."
                onCancel={() =>
                  setIsAddRoomOpen(
                    false
                  )
                }
              />
            </form>
          </ModalShell>
        )}

      {editingRoom && editingRoomDraft && (
        <ModalShell
          title="Modifier la chambre / offre"
          subtitle={selectedHotel?.name || 'Établissement'}
          onClose={closeRoomEditor}
        >
          <form
            onSubmit={applyEditingRoomLocally}
            className="space-y-5"
          >
            <div className="rounded-xl border border-[#E9E2D5] bg-[#F7F5EF] p-4 text-xs leading-relaxed text-[#6F756D]">
              Ces modifications sont temporaires côté frontend.
              L’enregistrement Supabase sera branché pendant la passe backend.
            </div>

            <FormField label="Nom de l’offre" required>
              <FormInput
                value={editingRoomDraft.name || ''}
                onChange={(event) =>
                  updateEditingRoomDraft(
                    'name',
                    event.target.value
                  )
                }
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Prix / nuit" required>
                <FormInput
                  type="number"
                  min={1}
                  value={editingRoomDraft.price_per_night || 0}
                  onChange={(event) =>
                    updateEditingRoomDraft(
                      'price_per_night',
                      Number(event.target.value)
                    )
                  }
                  required
                />
              </FormField>

              <FormField label="Nombre de chambres" required>
                <FormInput
                  type="number"
                  min={1}
                  value={editingRoomDraft.total_rooms || 0}
                  onChange={(event) =>
                    updateEditingRoomDraft(
                      'total_rooms',
                      Number(event.target.value)
                    )
                  }
                  required
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Capacité adultes" required>
                <FormInput
                  type="number"
                  min={1}
                  max={20}
                  value={editingRoomDraft.capacity_adults || 1}
                  onChange={(event) =>
                    updateEditingRoomDraft(
                      'capacity_adults',
                      Number(event.target.value)
                    )
                  }
                  required
                />
              </FormField>

              <FormField label="Capacité enfants">
                <FormInput
                  type="number"
                  min={0}
                  max={20}
                  value={editingRoomDraft.capacity_children ?? 0}
                  onChange={(event) =>
                    updateEditingRoomDraft(
                      'capacity_children',
                      Number(event.target.value)
                    )
                  }
                />
              </FormField>
            </div>

            <FormField label="Type de lit">
              <FormInput
                value={editingRoomDraft.bed_type || ''}
                onChange={(event) =>
                  updateEditingRoomDraft(
                    'bed_type',
                    event.target.value
                  )
                }
              />
            </FormField>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E9E2D5] p-4 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(editingRoomDraft.breakfast_included)}
                onChange={(event) =>
                  updateEditingRoomDraft(
                    'breakfast_included',
                    event.target.checked
                  )
                }
                className="h-4 w-4 accent-[#284C3B]"
              />
              Petit-déjeuner inclus
            </label>

            <FormField label="Photo principale" hint="URL temporaire">
              <FormInput
                type="url"
                value={editingRoomDraft.photos?.[0] || ''}
                onChange={(event) =>
                  updateEditingRoomDraft(
                    'photos',
                    event.target.value.trim()
                      ? [event.target.value]
                      : []
                  )
                }
                placeholder="https://..."
              />
            </FormField>

            <FormField
              label="Équipements"
              hint="Séparez les éléments par des virgules."
            >
              <FormInput
                value={(editingRoomDraft.amenities || []).join(', ')}
                onChange={(event) =>
                  updateEditingRoomDraft(
                    'amenities',
                    event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="wifi, climatisation, balcon..."
              />
            </FormField>

            <div className="flex flex-col gap-3 border-t border-[#E9E2D5] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={resetEditingRoomDraft}
                disabled={!hasEditingRoomChanges}
                className="rounded-xl border border-[#E9E2D5] px-4 py-3 text-sm font-bold text-[#59645B] hover:bg-[#F7F5EF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Réinitialiser
              </button>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={closeRoomEditor}
                  className="rounded-xl border border-[#E9E2D5] px-5 py-3 text-sm font-bold text-[#59645B] hover:bg-[#F7F5EF]"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={!hasEditingRoomChanges}
                  className="rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-bold text-white hover:bg-[#1B382D] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Appliquer à l’aperçu
                </button>
              </div>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};


/* ========================================================================== */
/* MANAGER WORKSPACES — no fabricated operational state                       */
/* ========================================================================== */
const managerPanel = 'rounded-2xl border border-[#E9E2D5] bg-white p-5 sm:p-6';

const ReceptionWorkspace: React.FC<{
  bookings: Booking[];
  onOpenBookings: () => void;
}> = ({ bookings, onOpenBookings }) => {
  const today = new Date();
  const day = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const arrivals = bookings.filter(b => b.status === 'confirmed' && b.check_in === day);
  const departures = bookings.filter(b => b.status === 'confirmed' && b.check_out === day);
  const pending = bookings.filter(b => b.status === 'pending');
  const queues = [
    { title: 'Arrivées prévues', data: arrivals, icon: LogIn },
    { title: 'Départs prévus', data: departures, icon: LogOut },
    { title: 'À confirmer', data: pending, icon: Clock },
  ];
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-widest text-[#B79B69]">Opérations quotidiennes</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#284C3B]">Réception</h2><p className="mt-2 text-sm text-[#6F756D]">Planning du jour calculé à partir des réservations enregistrées.</p></div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">Les listes indiquent des arrivées et départs <strong>prévus</strong>, et non des check-in ou check-out réellement effectués. La gestion des statuts de présence et l'attribution physique des chambres seront connectées pendant la phase backend.</div>
    <div className="grid gap-4 xl:grid-cols-3">{queues.map(queue => { const Icon = queue.icon; return <section key={queue.title} className={managerPanel}><div className="flex items-center gap-2 text-[#284C3B]"><Icon size={19}/><h3 className="font-bold">{queue.title}</h3></div><p className="mt-3 font-serif text-3xl font-bold">{queue.data.length}</p><div className="mt-4 space-y-2">{queue.data.length === 0 ? <p className="text-xs text-[#6F756D]">Aucun dossier dans cette file.</p> : queue.data.slice(0, 8).map(booking => <div key={booking.id} className="rounded-xl border border-[#E9E2D5] p-3"><p className="truncate text-sm font-semibold">{booking.guest_name || 'Voyageur'}</p><p className="mt-1 text-xs text-[#6F756D]">{formatDate(booking.check_in)} → {formatDate(booking.check_out)}</p></div>)}</div><button type="button" onClick={onOpenBookings} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#284C3B]">Gérer les réservations <ChevronRight size={15}/></button></section>; })}</div>
  </div>;
};

const OperationsWorkspace: React.FC<{rooms: RoomType[]}> = ({rooms}) => <div className="space-y-5">
  <div><p className="text-xs font-bold uppercase tracking-widest text-[#B79B69]">Exploitation</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#284C3B]">Ménage & maintenance</h2><p className="mt-2 text-sm text-[#6F756D]">Préparation des opérations de terrain, sans simuler l'état réel des chambres.</p></div>
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">Module en préparation : les statuts « propre », « à nettoyer », « en intervention » et « hors service » ne sont pas encore enregistrés. Aucune chambre n'est considérée prête automatiquement.</div>
  <div className="grid gap-4 sm:grid-cols-2">{rooms.length ? rooms.map(room => <article key={room.id} className={managerPanel}><div className="flex items-center gap-2"><Bed size={18} className="text-[#284C3B]"/><h3 className="font-bold">{room.name}</h3></div><p className="mt-2 text-xs text-[#6F756D]">{room.total_rooms} unité(s) dans cette catégorie</p><p className="mt-4 rounded-lg bg-[#F7F5EF] p-3 text-xs text-[#6F756D]">État ménage et maintenance : non renseigné — suivi à connecter.</p></article>) : <div className={managerPanel}>Aucune catégorie de chambre enregistrée.</div>}</div>
</div>;

const ProWorkspace: React.FC<{title:string; description:string}> = ({title, description}) => <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[#B79B69]">TerangaSN Manager · Pro</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#284C3B]">{title}</h2></div><section className={managerPanel}><Sparkles className="text-[#B79B69]" size={28}/><h3 className="mt-4 text-lg font-bold">Fonction réservée à Pro / Enterprise</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6F756D]">{description}</p><p className="mt-4 rounded-xl bg-[#F7F5EF] p-3 text-xs leading-5 text-[#6F756D]">L'abonnement actif n'est pas encore fourni par l'API. Cette fonction reste désactivée pour tous jusqu'à la vérification serveur ; aucun paiement ni changement de formule n'est simulé.</p></section></div>;

const SubscriptionWorkspace: React.FC = () => <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[#B79B69]">Offre commerciale</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#284C3B]">Abonnement Manager</h2><p className="mt-2 text-sm text-[#6F756D]">Comparaison des formules. Le statut réel de votre abonnement sera affiché après connexion au service d'abonnements.</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Formule actuellement active : non vérifiée. Aucun privilège Pro n'est accordé depuis cette interface.</div><div className="grid gap-4 lg:grid-cols-3">{[
{plan:'Standard', price:'Gratuit', details:['1 établissement', 'Chambres illimitées', 'Réservations manuelles', 'Calendrier et statistiques de base', '8 % TTC sur les réservations issues de la marketplace']},
{plan:'Pro', price:'39 900 FCFA TTC / mois', details:['3 établissements', 'Jusqu’à 5 collaborateurs', 'Statistiques et rapports avancés', '0 % de commission TerangaSN sur les réservations marketplace']},
{plan:'Enterprise', price:'Sur devis', details:['Limites et permissions contractuelles', 'Fonctions multiétablissements avancées', 'Accompagnement et intégrations à définir']},
].map(item=><article key={item.plan} className={managerPanel}><p className="text-xs font-bold uppercase tracking-widest text-[#B79B69]">{item.plan}</p><h3 className="mt-3 font-serif text-xl font-bold text-[#284C3B]">{item.price}</h3><ul className="mt-5 space-y-3">{item.details.map(detail=><li key={detail} className="flex items-start gap-2 text-sm text-[#59645B]"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#284C3B]"/>{detail}</li>)}</ul></article>)}</div><p className="text-xs leading-6 text-[#6F756D]">Sur toutes les formules, les réservations directes (téléphone, sur place, WhatsApp ou lien direct) ne supportent aucune commission TerangaSN. Des frais de prestataire de paiement peuvent s'appliquer séparément. Les limites devront être appliquées côté serveur.</p></div>;

/* ========================================================================== */
/* OVERVIEW                                                                   */
/* ========================================================================== */

interface OverviewSectionProps {
  bookings: Booking[];
  recentBookings: Booking[];
  rooms: RoomType[];
  totalRevenue: number;
  pendingRevenue: number;
  totalNights: number;
  pendingCount: number;
  profileCompletion: number;

  onNavigate: (
    section: DashboardSection
  ) => void;

  onUpdateBookingStatus: (
    bookingId: string,
    status:
      | 'confirmed'
      | 'cancelled'
      | 'completed'
  ) => Promise<void>;
}

const OverviewSection: React.FC<
  OverviewSectionProps
> = ({
  bookings,
  recentBookings,
  rooms,
  totalRevenue,
  pendingRevenue,
  totalNights,
  pendingCount,
  profileCompletion,
  onNavigate,
  onUpdateBookingStatus,
}) => (
  <div className="space-y-6">
    <DailyOperations bookings={bookings} onNavigate={onNavigate} />
    <div className="rounded-2xl border border-[#E9E2D5] bg-white px-5 py-4 text-xs leading-6 text-[#6F756D]">
      <strong className="text-[#284C3B]">Vue d’ensemble :</strong> les chiffres ci-dessous concernent les réservations chargées depuis TerangaSN. Les réservations manuelles en aperçu ne sont pas comptabilisées et les montants confirmés ne signifient pas « encaissés ».
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Réservations"
        value={String(
          bookings.length
        )}
        detail={
          pendingCount > 0
            ? `${pendingCount} en attente`
            : 'Aucune en attente'
        }
        icon={Calendar}
      />

      <StatCard
        label="Montant des séjours confirmés"
        value={formatFCFA(
          totalRevenue
        )}
        detail="Montants réservés, pas nécessairement encaissés"
        icon={TrendingUp}
      />

      <StatCard
        label="Demandes en attente"
        value={formatFCFA(
          pendingRevenue
        )}
        detail="Montant non encore confirmé"
        icon={Clock}
      />

      <StatCard
        label="Nuitées"
        value={String(
          totalNights
        )}
        detail={`${rooms.length} offre${
          rooms.length > 1
            ? 's'
            : ''
        }`}
        icon={Bed}
      />
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
      <section className="overflow-hidden rounded-2xl border border-[#E9E2D5] bg-white">
        <SectionHeader
          title="Réservations récentes"
          description="Les dernières demandes reçues pour cet établissement."
          actionLabel="Voir toutes"
          onAction={() =>
            onNavigate(
              'bookings'
            )
          }
        />

        {recentBookings.length ===
        0 ? (
          <SimpleEmptyState
            icon={Calendar}
            title="Aucune réservation"
            description="Les nouvelles réservations apparaîtront ici."
          />
        ) : (
          <div className="divide-y divide-[#E9E2D5]">
            {recentBookings.map(
              (booking) => (
                <div
                  key={
                    booking.id
                  }
                  className="flex flex-col gap-3 sm:gap-4 px-4 sm:px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-col min-[380px]:flex-row min-[380px]:flex-wrap min-[380px]:items-center gap-2">
                      <p className="font-bold">
                        {
                          booking.guest_name
                        }
                      </p>

                      <StatusBadge
                        status={
                          booking.status
                        }
                      />
                    </div>

                    <p className="mt-1 text-xs text-[#6F756D]">
                      {formatDate(
                        booking.check_in
                      )}{' '}
                      →{' '}
                      {formatDate(
                        booking.check_out
                      )}
                      {' • '}
                      {
                        booking.nights_count
                      }{' '}
                      nuit(s)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="font-serif font-bold">
                      {formatFCFA(
                        booking.total_price
                      )}
                    </span>

                    {booking.status ===
                      'pending' && (
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateBookingStatus(
                            booking.id,
                            'confirmed'
                          )
                        }
                        className="rounded-lg bg-[#284C3B] px-3 py-2 text-xs font-bold text-white"
                      >
                        Confirmer
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF3ED] text-[#284C3B]">
              <Sparkles
                size={19}
              />
            </div>

            <div>
              <p className="font-bold">
                Préparation de la
                fiche
              </p>

              <p className="text-xs text-[#6F756D]">
                Complétez votre
                établissement
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between">
            <span className="font-serif text-3xl font-bold">
              {
                profileCompletion
              }
              %
            </span>

            <span className="text-xs font-semibold text-[#6F756D]">
              complété
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECE9E0]">
            <div
              className="h-full rounded-full bg-[#284C3B]"
              style={{
                width: `${profileCompletion}%`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                'settings'
              )
            }
            className="mt-5 flex w-full items-center justify-between rounded-xl border border-[#E9E2D5] px-4 py-3 text-sm font-bold transition hover:bg-[#F7F5EF]"
          >
            Compléter la fiche

            <ChevronRight
              size={16}
            />
          </button>
        </section>

        <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8C887D]">
            Actions rapides
          </p>

          <div className="mt-4 space-y-2">
            <QuickAction
              icon={Bed}
              label="Gérer les offres"
              onClick={() =>
                onNavigate(
                  'rooms'
                )
              }
            />

            <QuickAction
              icon={Calendar}
              label="Mettre à jour les disponibilités"
              onClick={() =>
                onNavigate(
                  'calendar'
                )
              }
            />

            <QuickAction
              icon={
                CircleDollarSign
              }
              label="Consulter les finances"
              onClick={() =>
                onNavigate(
                  'finances'
                )
              }
            />
          </div>
        </section>
      </div>
    </div>
  </div>
);

/* ========================================================================== */
/* DAILY OPERATIONS — dates locales, réservations réelles uniquement           */
/* ========================================================================== */

const DailyOperations: React.FC<{
  bookings: Booking[];
  onNavigate: (section: DashboardSection) => void;
}> = ({ bookings, onNavigate }) => {
  const today = new Date();
  const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const active = bookings.filter(b => b.status === 'confirmed');
  const arrivals = active.filter(b => b.check_in === localDate);
  const departures = active.filter(b => b.check_out === localDate);
  const waiting = bookings.filter(b => b.status === 'pending');
  const dateLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const tiles = [
    { label: 'Arrivées aujourd’hui', count: arrivals.length, icon: LogIn, hint: 'Séjours confirmés', tone: 'bg-[#EFF3ED] text-[#284C3B]' },
    { label: 'Départs aujourd’hui', count: departures.length, icon: LogOut, hint: 'Séjours confirmés', tone: 'bg-[#F5F0E7] text-[#806747]' },
    { label: 'À confirmer', count: waiting.length, icon: AlertCircle, hint: 'Demandes en attente', tone: 'bg-[#FFF7E8] text-[#9A6700]' },
  ];
  return (
    <section className="overflow-hidden rounded-3xl border border-[#E9E2D5] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#E9E2D5] bg-[#FBFAF7] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#B79B69]">Votre journée</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-[#284C3B] sm:text-2xl">À suivre aujourd’hui</h2>
          <p className="mt-1 text-xs capitalize text-[#6F756D]">{dateLabel} · établissement sélectionné</p>
        </div>
        <button type="button" onClick={() => onNavigate('bookings')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1B382D]">
          Voir les réservations <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="rounded-2xl border border-[#E9E2D5] p-4">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tile.tone}`}><Icon size={19} /></div>
              <p className="mt-3 text-3xl font-bold text-[#30352F]">{tile.count}</p>
              <p className="mt-1 text-sm font-bold text-[#30352F]">{tile.label}</p>
              <p className="mt-1 text-xs text-[#6F756D]">{tile.hint}</p>
            </div>
          );
        })}
      </div>
      {(arrivals.length > 0 || departures.length > 0 || waiting.length > 0) ? (
        <div className="border-t border-[#E9E2D5] px-5 py-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#6F756D]">À traiter</p>
          <div className="space-y-2">
            {waiting.slice(0, 3).map(b => (
              <button key={`pending-${b.id}`} type="button" onClick={() => onNavigate('bookings')} className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#FFF9EE] px-3 py-3 text-left text-sm hover:bg-[#FFF3D9]">
                <span className="min-w-0 truncate"><strong>{b.guest_name || 'Client'}</strong><span className="ml-2 text-xs text-[#6F756D]">Demande à confirmer · {formatDate(b.check_in)}</span></span>
                <ChevronRight size={16} className="shrink-0 text-[#9A6700]" />
              </button>
            ))}
            {arrivals.slice(0, 3).map(b => (
              <button key={`arrival-${b.id}`} type="button" onClick={() => onNavigate('bookings')} className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#F2F6F1] px-3 py-3 text-left text-sm hover:bg-[#E6EFE6]">
                <span className="min-w-0 truncate"><strong>{b.guest_name || 'Client'}</strong><span className="ml-2 text-xs text-[#6F756D]">Arrivée prévue aujourd’hui</span></span>
                <ChevronRight size={16} className="shrink-0 text-[#284C3B]" />
              </button>
            ))}
            {departures.slice(0, 3).map(b => (
              <button key={`departure-${b.id}`} type="button" onClick={() => onNavigate('bookings')} className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#F7F4EF] px-3 py-3 text-left text-sm hover:bg-[#F0E9DE]">
                <span className="min-w-0 truncate"><strong>{b.guest_name || 'Client'}</strong><span className="ml-2 text-xs text-[#6F756D]">Départ prévu aujourd’hui</span></span>
                <ChevronRight size={16} className="shrink-0 text-[#806747]" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="border-t border-[#E9E2D5] px-5 py-4 text-sm text-[#6F756D]">Aucune arrivée, aucun départ et aucune demande en attente aujourd’hui.</p>
      )}
      <p className="border-t border-[#E9E2D5] bg-[#FBFAF7] px-5 py-3 text-[11px] text-[#6F756D]">
        Dates calculées selon votre appareil. Les arrivées et départs sont prévus, pas validés par un check-in/check-out. Les brouillons manuels ne sont pas inclus.
      </p>
    </section>
  );
};

/* ========================================================================== */
/* LODGINGS                                                                   */
/* ========================================================================== */

interface LodgingsSectionProps {
  hotels: Lodging[];
  selectedHotel: Lodging;

  onSelect: (
    lodging: Lodging
  ) => Promise<void>;

  onCreate: () => void;
}

const LodgingsSection: React.FC<
  LodgingsSectionProps
> = ({
  hotels,
  selectedHotel,
  onSelect,
  onCreate,
}) => (
  <section className="space-y-4">
    <div className="flex flex-col gap-4 rounded-2xl border border-[#E9E2D5] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-serif text-lg font-bold">
          Mes établissements
        </h2>

        <p className="mt-1 text-xs text-[#6F756D]">
          Gérez tous vos
          hébergements depuis le
          même compte.
        </p>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1B382D]"
      >
        <PlusCircle size={15} />
        Ajouter
      </button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {hotels.map((hotel) => {
        const active =
          selectedHotel.id ===
          hotel.id;

        const photo =
          hotel.photos?.[0];

        return (
          <button
            key={hotel.id}
            type="button"
            onClick={() =>
              void onSelect(
                hotel
              )
            }
            className={`overflow-hidden rounded-2xl border bg-white text-left transition ${
              active
                ? 'border-[#284C3B] ring-2 ring-[#284C3B]/10'
                : 'border-[#E9E2D5] hover:border-[#A8BDAE]'
            }`}
          >
            <div className="h-36 bg-[#EEECE5]">
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[#9B978D]">
                  <Building2
                    size={30}
                  />
                </div>
              )}
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#284C3B]">
                    {getCategoryLabel(
                      hotel.category
                    )}
                  </span>

                  <h3 className="mt-1 font-serif text-lg font-bold">
                    {hotel.name}
                  </h3>
                </div>

                {active && (
                  <CheckCircle2
                    size={20}
                    className="text-[#284C3B]"
                  />
                )}
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-[#6F756D]">
                <MapPin
                  size={13}
                />
                {hotel.city},{' '}
                {hotel.region}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-[#E9E2D5] pt-4">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    hotel.is_published
                      ? 'bg-[#EFF3ED] text-[#284C3B]'
                      : 'bg-[#FFF7E8] text-[#9A6700]'
                  }`}
                >
                  {hotel.is_published
                    ? 'Publié'
                    : 'En préparation'}
                </span>

                <span className="text-xs font-bold text-[#284C3B]">
                  Gérer
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </section>
);

/* ========================================================================== */
/* BOOKINGS                                                                   */
/* ========================================================================== */

interface BookingsSectionProps {
  bookings: Booking[];
  lodgingName: string;
  rooms: RoomType[];
  hotelId: string;
  manualReservations: ManualReservation[];
  onAddManual: (reservation: ManualReservation) => void;
  onUpdateManual: (id: string, patch: Partial<ManualReservation>) => void;
  updatingBookingId: string | null;
  onUpdateStatus: (bookingId: string, status: 'confirmed' | 'cancelled' | 'completed') => Promise<void>;
}
const BookingsSection: React.FC<BookingsSectionProps> = ({
  bookings, lodgingName, rooms, hotelId, manualReservations, onAddManual, onUpdateManual, onUpdateStatus, updatingBookingId,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [source, setSource] = useState<ManualSource>('telephone');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [bookingSort, setBookingSort] = useState('arrival');
  const [manualSearch, setManualSearch] = useState('');
  const normalizedSearch = bookingSearch.trim().toLocaleLowerCase('fr');
  const visibleBookings = bookings.filter(b => {
    const matchesStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
    const matchesSearch = !normalizedSearch || [b.guest_name, b.guest_phone, b.guest_email, b.room_type?.name, b.id].some(v => String(v || '').toLocaleLowerCase('fr').includes(normalizedSearch));
    return matchesStatus && matchesSearch;
  }).sort((a, b) => bookingSort === 'amount' ? Number(b.total_price || 0) - Number(a.total_price || 0) : bookingSort === 'recent' ? String((b as Booking & { created_at?: string }).created_at || b.check_in).localeCompare(String((a as Booking & { created_at?: string }).created_at || a.check_in)) : String(a.check_in).localeCompare(String(b.check_in)));
  const visibleManual = manualReservations.filter(r => [r.guestName, r.guestPhone, manualSourceLabels[r.source]].some(v => v.toLocaleLowerCase('fr').includes(manualSearch.trim().toLocaleLowerCase('fr'))));
  const activeRoom = rooms.find(room => room.id === roomId);
  const exportReservations = () => downloadCSV('reservations-terangasn-avec-apercus.csv', [
    ['Origine', 'Client', 'Téléphone', 'Arrivée', 'Départ', 'Offre', 'Montant FCFA', 'Statut', 'Paiement'],
    ...bookings.map(b => ['TerangaSN', b.guest_name, b.guest_phone, b.check_in, b.check_out, b.room_type?.name || '', b.total_price, b.status, getPaymentStatusLabel(b.payment_status)]),
    ...manualReservations.map(r => [manualSourceLabels[r.source], r.guestName, r.guestPhone, r.checkIn, r.checkOut, rooms.find(room => room.id === r.roomId)?.name || '', r.amount, r.status, r.payment]),
  ]);
  const addReservation = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim() || !roomId || !checkIn || !checkOut || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      setError('Renseignez le client, l’offre, les dates et un montant valide.'); return;
    }
    if (checkIn >= checkOut) { setError('La date de départ doit être après la date d’arrivée.'); return; }
    // Contrôle prudent : la quantité des offres est prise en compte. Les réservations
    // de la plateforme sont uniquement comparées lorsque leur type de chambre est connu.
    const overlappingManual = manualReservations.filter(r => r.roomId === roomId && r.status !== 'cancelled' && dateOverlap(checkIn, checkOut, r.checkIn, r.checkOut)).length;
    const overlappingOnline = bookings.filter(b => (b as Booking & { room_type_id?: string }).room_type_id === roomId && (b.status === 'confirmed' || b.status === 'pending') && dateOverlap(checkIn, checkOut, b.check_in, b.check_out)).length;
    if (overlappingManual + overlappingOnline >= (activeRoom?.total_rooms || 1)) {
      setError('Capacité potentiellement atteinte sur ces dates. Vérifiez les disponibilités dans le calendrier.'); return;
    }
    onAddManual({ id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, hotelId, roomId, guestName: name.trim(), guestPhone: phone.trim(), checkIn, checkOut, source, amount: Number(amount), status: 'confirmed', payment: 'unpaid' });
    setName(''); setPhone(''); setRoomId(''); setCheckIn(''); setCheckOut(''); setAmount(''); setShowForm(false);
  };
  return <section className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border border-[#E9E2D5] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-serif text-xl font-bold">Réservations</h2><p className="mt-1 text-xs text-[#6F756D]">{lodgingName} · Marketplace et saisies manuelles</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportReservations} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E2D5] px-4 py-2.5 text-xs font-bold"><Download size={15}/> Exporter CSV</button>
        <button type="button" onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-2 rounded-xl bg-[#284C3B] px-4 py-2.5 text-xs font-bold text-white"><PlusCircle size={15}/> Réservation manuelle</button>
      </div>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
      <strong>Mode aperçu :</strong> les réservations manuelles sont conservées uniquement tant que cette page reste ouverte. Elles ne bloquent pas encore le calendrier Supabase et ne sont pas synchronisées entre appareils. Vérifiez toujours les disponibilités avant de confirmer.
    </div>
    <div className="grid gap-3 rounded-2xl border border-[#E9E2D5] bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_170px]">
      <label className="flex items-center gap-2 rounded-xl border border-[#E9E2D5] px-3"><Search size={16} className="text-[#6F756D]"/><input aria-label="Rechercher une réservation" value={bookingSearch} onChange={e => setBookingSearch(e.target.value)} placeholder="Client, téléphone, offre, référence…" className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"/></label>
      <label className="flex items-center gap-2 rounded-xl border border-[#E9E2D5] px-3"><Filter size={15} className="text-[#6F756D]"/><select aria-label="Filtrer par statut" value={bookingStatusFilter} onChange={e => setBookingStatusFilter(e.target.value)} className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"><option value="all">Tous les statuts</option><option value="pending">En attente</option><option value="confirmed">Confirmées</option><option value="completed">Terminées</option><option value="cancelled">Annulées</option></select></label>
      <select aria-label="Trier les réservations" value={bookingSort} onChange={e => setBookingSort(e.target.value)} className="rounded-xl border border-[#E9E2D5] bg-white px-3 py-3 text-sm"><option value="arrival">Arrivée proche</option><option value="recent">Plus récentes</option><option value="amount">Montant décroissant</option></select>
    </div>
    {showForm && <form onSubmit={addReservation} className="space-y-4 rounded-2xl border border-[#DCE7DD] bg-white p-5">
      <h3 className="font-bold">Nouvelle réservation hors marketplace</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Nom du client" required><FormInput value={name} onChange={e => setName(e.target.value)} required /></FormField>
        <FormField label="Téléphone"><FormInput value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 ..." /></FormField>
        <FormField label="Canal"><select className="w-full rounded-xl border border-[#E9E2D5] bg-white px-3 py-3 text-sm" value={source} onChange={e => setSource(e.target.value as ManualSource)}>{(Object.keys(manualSourceLabels) as ManualSource[]).map(key => <option key={key} value={key}>{manualSourceLabels[key]}</option>)}</select></FormField>
        <FormField label="Chambre / offre" required><select required className="w-full rounded-xl border border-[#E9E2D5] bg-white px-3 py-3 text-sm" value={roomId} onChange={e => setRoomId(e.target.value)}><option value="">Choisir une offre</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name} ({room.total_rooms} unité(s))</option>)}</select></FormField>
        <FormField label="Arrivée" required><FormInput type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} required /></FormField>
        <FormField label="Départ" required><FormInput type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} required /></FormField>
        <FormField label="Montant total (FCFA)" required><FormInput type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} required /></FormField>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" className="rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-bold text-white">Ajouter à l’aperçu</button><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-5 py-3 text-sm">Fermer</button></div>
    </form>}
    <div className="overflow-hidden rounded-2xl border border-[#E9E2D5] bg-white">
      <SectionHeader title={`Marketplace (${visibleBookings.length}/${bookings.length})`} description="Réservations réellement chargées depuis la plateforme. Confirmer ne signifie pas encaisser." />
      {visibleBookings.length === 0 ? <SimpleEmptyState icon={Calendar} title="Aucune réservation correspondante" description="Les demandes apparaîtront ici." /> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-[#F7F5EF] text-[#6F756D]"><tr>{['Client', 'Séjour', 'Offre', 'Montant', 'Paiement', 'Statut', 'Actions'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#E9E2D5]">{visibleBookings.map(b => <tr key={b.id}><td className="px-4 py-4"><strong>{b.guest_name}</strong><p className="text-[#6F756D]">{b.guest_phone || b.guest_email}</p></td><td className="px-4 py-4">{formatDate(b.check_in)} → {formatDate(b.check_out)}</td><td className="px-4 py-4">{b.room_type?.name || 'Offre'}</td><td className="px-4 py-4 font-bold">{formatFCFA(b.total_price)}</td><td className="px-4 py-4">{getPaymentStatusLabel(b.payment_status)}</td><td className="px-4 py-4"><StatusBadge status={b.status}/></td><td className="px-4 py-4"><div className="flex gap-2">{b.status === 'pending' && <button type="button" disabled={updatingBookingId !== null} className="rounded-lg disabled:opacity-50 bg-[#284C3B] px-3 py-2 font-bold text-white" onClick={() => void onUpdateStatus(b.id, 'confirmed')}>Confirmer</button>}{b.status === 'confirmed' && <button type="button" disabled={updatingBookingId !== null} className="rounded-lg disabled:opacity-50 border px-3 py-2" onClick={() => void onUpdateStatus(b.id, 'completed')}>Terminer</button>}{(b.status === 'pending' || b.status === 'confirmed') && <button type="button" disabled={updatingBookingId !== null} className="rounded-lg disabled:opacity-50 border px-3 py-2 text-rose-700" onClick={() => { if (window.confirm('Annuler cette réservation ?')) void onUpdateStatus(b.id, 'cancelled'); }}>Annuler</button>}</div></td></tr>)}</tbody></table></div>}
    </div>
    <div className="overflow-hidden rounded-2xl border border-[#E9E2D5] bg-white">
      <div className="border-b border-[#E9E2D5] p-4"><label className="flex max-w-md items-center gap-2 rounded-xl border border-[#E9E2D5] px-3"><Search size={16}/><input aria-label="Rechercher une saisie manuelle" value={manualSearch} onChange={e => setManualSearch(e.target.value)} placeholder="Rechercher une saisie manuelle" className="w-full min-w-0 py-3 text-sm outline-none"/></label></div>
      <SectionHeader title={`Réservations manuelles (${manualReservations.length})`} description="Saisie locale : WhatsApp, téléphone, accueil ou autre. Commission TerangaSN non calculée." />
      {visibleManual.length === 0 ? <SimpleEmptyState icon={Phone} title="Aucune saisie manuelle" description="Ajoutez une réservation reçue en dehors de TerangaSN."/> : <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-xs"><thead className="bg-[#F7F5EF]"><tr>{['Client', 'Canal', 'Dates', 'Offre', 'Montant', 'Paiement', 'Actions'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#E9E2D5]">{visibleManual.map(r => <tr key={r.id} className={r.status === 'cancelled' ? 'opacity-50' : ''}><td className="px-4 py-4"><strong>{r.guestName}</strong><p>{r.guestPhone}</p></td><td className="px-4 py-4">{manualSourceLabels[r.source]}</td><td className="px-4 py-4">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</td><td className="px-4 py-4">{rooms.find(room => room.id === r.roomId)?.name || '—'}</td><td className="px-4 py-4 font-bold">{formatFCFA(r.amount)}</td><td className="px-4 py-4">{r.payment === 'paid' ? 'Payé (aperçu)' : 'Non payé'}</td><td className="px-4 py-4"><div className="flex gap-2">{r.status !== 'cancelled' && <><button type="button" className="rounded-lg border px-3 py-2" onClick={() => onUpdateManual(r.id, { payment: r.payment === 'paid' ? 'unpaid' : 'paid' })}>{r.payment === 'paid' ? 'Annuler paiement' : 'Marquer payé'}</button><button type="button" className="rounded-lg border px-3 py-2 text-rose-700" onClick={() => onUpdateManual(r.id, { status: 'cancelled' })}>Annuler</button></>}</div></td></tr>)}</tbody></table></div>}
    </div>
  </section>;
};

interface ClientsSectionProps { bookings: Booking[]; manualReservations: ManualReservation[]; }
const ClientsSection: React.FC<ClientsSectionProps> = ({ bookings, manualReservations }) => {
  const [clientSearch, setClientSearch] = useState('');
  const clients = [
    ...bookings.map(b => ({ id: `online-${b.id}`, name: b.guest_name, phone: b.guest_phone || '', email: b.guest_email || '', origin: 'TerangaSN', stay: b.check_in })),
    ...manualReservations.map(r => ({ id: r.id, name: r.guestName, phone: r.guestPhone, email: '', origin: manualSourceLabels[r.source], stay: r.checkIn })),
  ];
  const visibleClients = clients.filter(c => [c.name, c.phone, c.email, c.origin].some(v => v.toLocaleLowerCase('fr').includes(clientSearch.trim().toLocaleLowerCase('fr'))));
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E9E2D5] bg-white p-5"><div><h2 className="font-serif text-xl font-bold">Clients</h2><p className="mt-1 text-xs text-[#6F756D]">Contacts issus des réservations de cet établissement, sans CRM persistant pour l’instant.</p></div><button type="button" onClick={() => downloadCSV('clients-terangasn.csv', [['Nom', 'Téléphone', 'Email', 'Origine', 'Arrivée'], ...clients.map(c => [c.name, c.phone, c.email, c.origin, c.stay])])} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"><Download size={15}/> Exporter CSV</button></div><label className="flex max-w-lg items-center gap-2 rounded-xl border border-[#E9E2D5] bg-white px-4"><Search size={16}/><input aria-label="Rechercher un client" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Rechercher un nom, téléphone ou email" className="w-full py-3 text-sm outline-none"/></label>{visibleClients.length === 0 ? <SimpleEmptyState icon={Users} title="Aucun client" description="Les voyageurs apparaîtront avec les premières réservations."/> : <div className="grid gap-3 md:grid-cols-2">{visibleClients.map(c => <div key={c.id} className="rounded-2xl border border-[#E9E2D5] bg-white p-5"><p className="font-bold">{c.name}</p><p className="mt-1 text-xs text-[#6F756D]">{c.origin} · Arrivée {formatDate(c.stay)}</p><p className="mt-3 text-sm">{c.phone || c.email || 'Contact non renseigné'}</p></div>)}</div>}</section>;
};

/* ========================================================================== */
/* ROOMS                                                                      */
/* ========================================================================== */

interface RoomsSectionProps {
  rooms: RoomType[];
  onCreate: () => void;
  onEdit: (room: RoomType) => void;
  onCalendar: (roomId: string) => void;
}

const RoomsSection: React.FC<
  RoomsSectionProps
> = ({
  rooms,
  onCreate,
  onEdit,
  onCalendar,
}) => (
  <section className="space-y-4">
    <div className="flex flex-col gap-4 rounded-2xl border border-[#E9E2D5] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-serif text-lg font-bold">
          Chambres & offres
        </h2>
        <p className="mt-1 text-xs text-[#6F756D]">
          Gérez vos chambres et offres réservables,
          leurs capacités et leurs tarifs.
        </p>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1B382D]"
      >
        <PlusCircle size={15} />
        Ajouter une offre
      </button>
    </div>

    {rooms.length === 0 ? (
      <SimpleEmptyState
        icon={Bed}
        title="Aucune offre créée"
        description="Ajoutez votre première chambre ou offre réservable."
        actionLabel="Ajouter une offre"
        onAction={onCreate}
      />
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <article
            key={room.id}
            className="overflow-hidden rounded-2xl border border-[#E9E2D5] bg-white"
          >
            <div className="h-36 bg-[#EEECE5]">
              {room.photos?.[0] ? (
                <img
                  src={room.photos[0]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[#9B978D]">
                  <Bed size={28} />
                </div>
              )}
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-bold">
                    {room.name}
                  </h3>
                  <p className="mt-1 text-xs text-[#6F756D]">
                    {room.bed_type || 'Type de lit à préciser'}
                  </p>
                </div>

                <span className="whitespace-nowrap font-serif font-bold text-[#8B5E34]">
                  {formatFCFA(room.price_per_night)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-lg bg-[#F7F5EF] px-2 py-1 font-semibold">
                  {room.capacity_adults} adulte(s)
                </span>

                {Number(room.capacity_children || 0) > 0 && (
                  <span className="rounded-lg bg-[#F7F5EF] px-2 py-1 font-semibold">
                    {room.capacity_children} enfant(s)
                  </span>
                )}

                <span className="rounded-lg bg-[#F7F5EF] px-2 py-1 font-semibold">
                  {room.total_rooms} chambre(s)
                </span>

                {room.breakfast_included && (
                  <span className="rounded-lg bg-[#EFF3ED] px-2 py-1 font-semibold text-[#284C3B]">
                    Petit-déjeuner
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(room)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#E9E2D5] px-4 py-2.5 text-xs font-bold text-[#59645B] hover:bg-[#F7F5EF]"
                >
                  <Settings size={14} />
                  Modifier
                </button>

                <button
                  type="button"
                  onClick={() => onCalendar(room.id)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#E9E2D5] px-4 py-2.5 text-xs font-bold text-[#284C3B] hover:bg-[#F7F5EF]"
                >
                  <Calendar size={14} />
                  Calendrier
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);

/* ========================================================================== */
/* FINANCES                                                                   */
/* ========================================================================== */

interface FinancesSectionProps {
  totalRevenue: number;
  pendingRevenue: number;
  recordedCommission: number;
  netRecordedRevenue: number;
  bookings: Booking[];
}

const getPaymentStatusLabel = (
  status?: string | null
) => {
  switch (status) {
    case 'on_site_paid':
      return 'Payé sur place';
    case 'on_site_unpaid':
      return 'À payer sur place';
    case 'refunded':
      return 'Remboursé';
    case 'partially_refunded':
      return 'Partiellement remboursé';
    default:
      return status || 'Non renseigné';
  }
};

const FinancesSection: React.FC<
  FinancesSectionProps
> = ({
  totalRevenue,
  pendingRevenue,
  recordedCommission,
  netRecordedRevenue,
  bookings,
}) => {
  const paidBookings = bookings.filter(
    (booking) =>
      booking.payment_status === 'on_site_paid' && booking.status !== 'cancelled'
  );

  const paidAmount = paidBookings.reduce(
    (total, booking) =>
      total + (booking.total_price || 0),
    0
  );

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E9E2D5] bg-[#F7F5EF] px-5 py-4 text-xs leading-6 text-[#59645B]">
        <strong className="text-[#284C3B]">Lecture des montants :</strong> les séjours confirmés ou terminés ne sont pas tous encaissés. « Paiements enregistrés » repose sur le statut de paiement des réservations en base. Les saisies manuelles de démonstration ne sont pas incluses dans ces indicateurs.
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Montant confirmé"
          value={formatFCFA(totalRevenue)}
          detail="Montants réservés, pas nécessairement encaissés"
          icon={WalletCards}
        />
        <StatCard
          label="Paiements enregistrés"
          value={formatFCFA(paidAmount)}
          detail={`${paidBookings.length} réservation(s) marquée(s) payée(s)`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Commission plateforme"
          value={formatFCFA(recordedCommission)}
          detail="Uniquement les commissions déjà enregistrées"
          icon={CircleDollarSign}
        />
        <StatCard
          label="Montant net théorique"
          value={formatFCFA(netRecordedRevenue)}
          detail="Montant confirmé moins commissions enregistrées ; non encaissé"
          icon={TrendingUp}
        />
      </div>

      {pendingRevenue > 0 && (
        <div className="rounded-2xl border border-[#F2D9A6] bg-[#FFF9ED] p-5">
          <div className="flex items-start gap-3">
            <Clock
              size={20}
              className="mt-0.5 shrink-0 text-[#9A6700]"
            />
            <div>
              <p className="font-bold text-[#7A5300]">
                {formatFCFA(pendingRevenue)} liés aux demandes en attente
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#8A6A28]">
                Ce montant n’est pas inclus dans le chiffre d’affaires confirmé.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E9E2D5] bg-white">
        <SectionHeader
          title="Journal financier"
          description="Montants et statuts réellement présents sur les réservations chargées."
        />

        {bookings.length === 0 ? (
          <div className="p-5">
            <SimpleEmptyState
              icon={WalletCards}
              title="Aucun mouvement"
              description="Les opérations liées aux réservations apparaîtront ici."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-[#E9E2D5] bg-[#F7F5EF] text-[#6F756D]">
                <tr>
                  <th className="px-5 py-4">Réservation</th>
                  <th className="px-5 py-4">Voyageur</th>
                  <th className="px-5 py-4">Paiement</th>
                  <th className="px-5 py-4">Montant</th>
                  <th className="px-5 py-4">Commission</th>
                  <th className="px-5 py-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E2D5]">
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-[#FCFBF8]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-mono text-[11px] font-bold">
                        {booking.booking_number ||
                          booking.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-[10px] text-[#8C887D]">
                        {formatDate(booking.check_in)} →{' '}
                        {formatDate(booking.check_out)}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {booking.guest_name}
                    </td>
                    <td className="px-5 py-4">
                      {getPaymentStatusLabel(
                        booking.payment_status
                      )}
                    </td>
                    <td className="px-5 py-4 font-serif text-sm font-bold">
                      {formatFCFA(booking.total_price || 0)}
                    </td>
                    <td className="px-5 py-4">
                      {typeof booking.commission_amount ===
                      'number'
                        ? formatFCFA(
                            booking.commission_amount
                          )
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
        <div className="flex items-start gap-3">
          <FileText
            size={20}
            className="mt-0.5 shrink-0 text-[#284C3B]"
          />
          <div>
            <p className="font-bold">
              Facturation & reversements
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[#6F756D]">
              Les frais PSP, reversements, factures et soldes réellement dus seront ajoutés quand le flux de paiement final sera branché. Aucun taux ou frais fictif n’est calculé ici.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ========================================================================== */
/* STATISTICS                                                                 */
/* ========================================================================== */

interface StatisticsSectionProps {
  bookings: Booking[];
  rooms: RoomType[];
  totalRevenue: number;
  totalNights: number;
  averageStay: number;
  averageBookingValue: number;
  cancellationRate: number;
}

const StatisticsSection: React.FC<
  StatisticsSectionProps
> = ({
  bookings,
  rooms,
  totalRevenue,
  totalNights,
  averageStay,
  averageBookingValue,
  cancellationRate,
}) => {
  const confirmedBookings =
    bookings.filter(
      (booking) =>
        booking.status === 'confirmed' ||
        booking.status === 'completed'
    );

  const pending = bookings.filter(
    (booking) => booking.status === 'pending'
  ).length;

  const completed = bookings.filter(
    (booking) => booking.status === 'completed'
  ).length;

  const roomPerformance = rooms
    .map((room) => {
      const related = confirmedBookings.filter(
        (booking) =>
          booking.room_type?.id === room.id ||
          (booking as any).room_type_id === room.id
      );

      return {
        room,
        reservations: related.length,
        nights: related.reduce(
          (sum, booking) =>
            sum + (booking.nights_count || 0),
          0
        ),
        revenue: related.reduce(
          (sum, booking) =>
            sum + (booking.total_price || 0),
          0
        ),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const maxRoomRevenue = Math.max(
    1,
    ...roomPerformance.map(
      (item) => item.revenue
    )
  );

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Montant des séjours confirmés"
          value={formatFCFA(totalRevenue)}
          detail="Confirmés et terminés, paiement non garanti"
          icon={TrendingUp}
        />
        <StatCard
          label="Panier moyen"
          value={formatFCFA(
            Math.round(averageBookingValue)
          )}
          detail="Par réservation confirmée/terminée"
          icon={CircleDollarSign}
        />
        <StatCard
          label="Durée moyenne"
          value={`${averageStay.toFixed(1)} nuit(s)`}
          detail={`${totalNights} nuitée(s) enregistrée(s)`}
          icon={Bed}
        />
        <StatCard
          label="Annulations"
          value={`${cancellationRate}%`}
          detail={`${pending} en attente • ${completed} terminée(s)`}
          icon={XCircle}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="rounded-2xl border border-[#E9E2D5] bg-white">
          <SectionHeader
            title="Performance par offre"
            description="Calculée à partir des réservations confirmées ou terminées actuellement chargées."
          />

          {roomPerformance.length === 0 ? (
            <div className="p-5">
              <SimpleEmptyState
                icon={BarChart3}
                title="Aucune offre à analyser"
                description="Ajoutez des chambres ou offres pour comparer leurs performances."
              />
            </div>
          ) : (
            <div className="divide-y divide-[#E9E2D5]">
              {roomPerformance.map(
                ({
                  room,
                  reservations,
                  nights,
                  revenue,
                }) => (
                  <div key={room.id} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold">
                          {room.name}
                        </p>
                        <p className="mt-1 text-[11px] text-[#6F756D]">
                          {reservations} réservation(s) •{' '}
                          {nights} nuitée(s)
                        </p>
                      </div>
                      <p className="font-serif font-bold">
                        {formatFCFA(revenue)}
                      </p>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEECE5]">
                      <div
                        className="h-full rounded-full bg-[#284C3B]"
                        style={{
                          width: `${Math.max(
                            revenue > 0 ? 6 : 0,
                            Math.round(
                              (revenue /
                                maxRoomRevenue) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#284C3B]">
              Standard
            </p>
            <h3 className="mt-2 font-serif text-lg font-bold">
              Indicateurs essentiels
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#6F756D]">
              CA, panier moyen, durée moyenne, annulations, nuitées et performance par offre restent accessibles sans masquer les informations essentielles de votre activité.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2DDCF] bg-[#F7F5EF] p-5">
            <Sparkles
              size={20}
              className="text-[#8B5E34]"
            />
            <h3 className="mt-3 font-bold">
              Analyses avancées
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#6F756D]">
              Comparaisons de périodes, tendances, prévisions, analyses multi-établissements et rapports enrichis pourront compléter les formules supérieures lorsque les données backend seront disponibles.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ========================================================================== */
/* REVIEWS                                                                    */
/* ========================================================================== */

interface ReviewsSectionProps {
  lodging: Lodging;
  completedBookings: number;
}

const ReviewsSection: React.FC<
  ReviewsSectionProps
> = ({
  lodging,
  completedBookings,
}) => (
  <section className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Note actuelle"
        value={
          typeof lodging.rating === 'number'
            ? `${lodging.rating.toFixed(1)}/5`
            : '—'
        }
        detail="Note enregistrée sur la fiche"
        icon={Star}
      />
      <StatCard
        label="Avis enregistrés"
        value={String(
          lodging.reviews_count || 0
        )}
        detail="Compteur actuellement disponible"
        icon={MessageSquareText}
      />
      <StatCard
        label="Séjours terminés"
        value={String(completedBookings)}
        detail="Réservations pouvant alimenter la réputation"
        icon={CheckCircle2}
      />
    </div>

    <div className="rounded-2xl border border-[#E9E2D5] bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EFF3ED] text-[#284C3B]">
          <MessageSquareText size={20} />
        </div>
        <div>
          <h2 className="font-serif text-lg font-bold">
            Gestion des avis
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6F756D]">
            Cette page ne charge pas encore la liste détaillée des avis. Pour éviter d’afficher de faux commentaires, seules la note et le compteur déjà présents sur la fiche sont utilisés ici.
          </p>
          <p className="mt-3 text-xs font-semibold text-[#284C3B]">
            Lors de la passe backend, cette section recevra les avis réels, leur modération et la réponse publique de l’établissement.
          </p>
        </div>
      </div>
    </div>
  </section>
);

/* ========================================================================== */
/* SETTINGS                                                                   */
/* ========================================================================== */

interface SettingsSectionProps {
  lodging: Lodging;
  draft: Partial<Lodging> | null;
  completion: number;
  hasChanges: boolean;
  onChange: (
    field: keyof Lodging,
    value: any
  ) => void;
  onReset: () => void;
  onSaveLocal: () => void;
  onOpenSupabaseModal: () => void;
}

const SettingsSection: React.FC<
  SettingsSectionProps
> = ({
  lodging,
  draft,
  completion,
  hasChanges,
  onChange,
  onReset,
  onSaveLocal,
  onOpenSupabaseModal,
}) => {
  const current = draft || lodging;

  const photos =
    current.photos || [];

  const amenities =
    current.amenities || [];

  const updatePhoto = (
    index: number,
    value: string
  ) => {
    const next = [...photos];
    next[index] = value;

    onChange(
      'photos',
      next.filter(
        (photo) =>
          photo.trim().length > 0
      )
    );
  };

  const addPhoto = () => {
    onChange('photos', [
      ...photos,
      '',
    ]);
  };

  const removePhoto = (
    index: number
  ) => {
    onChange(
      'photos',
      photos.filter(
        (_, photoIndex) =>
          photoIndex !== index
      )
    );
  };

  const amenitiesText =
    amenities.join(', ');

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#E9E2D5] bg-white">
        <SectionHeader
          title="Gérer la fiche"
          description="Préparez les informations visibles de votre établissement. Pour le moment, les modifications restent côté frontend et ne sont pas encore enregistrées dans Supabase."
        />

        <div className="space-y-8 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#284C3B]">
              Informations générales
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField
                label="Nom de l’établissement"
                required
              >
                <FormInput
                  value={
                    current.name || ''
                  }
                  onChange={(event) =>
                    onChange(
                      'name',
                      event.target.value
                    )
                  }
                  placeholder="Nom de l’établissement"
                />
              </FormField>

              <FormField label="Type d’hébergement">
                <FormSelect
                  value={
                    current.category ||
                    'hotel'
                  }
                  onChange={(event) =>
                    onChange(
                      'category',
                      event.target.value
                    )
                  }
                >
                  <option value="hotel">
                    Hôtel
                  </option>
                  <option value="lodge">
                    Lodge & Écolodge
                  </option>
                  <option value="campement">
                    Campement touristique
                  </option>
                  <option value="residence">
                    Résidence
                  </option>
                  <option value="villa">
                    Villa
                  </option>
                  <option value="appartement">
                    Appartement
                  </option>
                  <option value="chambre_hotes">
                    Chambre d&apos;hôtes
                  </option>
                </FormSelect>
              </FormField>

              <FormField
                label="Région"
                required
              >
                <FormInput
                  value={
                    current.region || ''
                  }
                  onChange={(event) =>
                    onChange(
                      'region',
                      event.target.value
                    )
                  }
                  placeholder="Ex. Thiès"
                />
              </FormField>

              <FormField
                label="Ville"
                required
              >
                <FormInput
                  value={
                    current.city || ''
                  }
                  onChange={(event) =>
                    onChange(
                      'city',
                      event.target.value
                    )
                  }
                  placeholder="Ex. Saly"
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField
                  label="Adresse"
                  required
                >
                  <FormInput
                    value={
                      current.address ||
                      ''
                    }
                    onChange={(event) =>
                      onChange(
                        'address',
                        event.target.value
                      )
                    }
                    placeholder="Adresse ou repère précis"
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E9E2D5] pt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#284C3B]">
              Présentation
            </p>

            <div className="mt-4">
              <FormField
                label="Description"
                hint="Présentez l’expérience, l’emplacement et les points forts."
              >
                <textarea
                  value={
                    current.description ||
                    ''
                  }
                  onChange={(event) =>
                    onChange(
                      'description',
                      event.target.value
                    )
                  }
                  rows={7}
                  placeholder="Décrivez votre hébergement..."
                  className="w-full resize-y rounded-xl border border-[#DCD8CC] bg-white px-4 py-3 text-sm leading-relaxed outline-none transition placeholder:text-[#AAA69C] focus:border-[#284C3B] focus:ring-2 focus:ring-[#284C3B]/10"
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-[#E9E2D5] pt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#284C3B]">
              Contact
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField label="Téléphone">
                <FormInput
                  type="tel"
                  value={
                    current.phone || ''
                  }
                  onChange={(event) =>
                    onChange(
                      'phone',
                      event.target.value
                    )
                  }
                  placeholder="+221 ..."
                />
              </FormField>

              <FormField label="E-mail">
                <FormInput
                  type="email"
                  value={
                    current.email || ''
                  }
                  onChange={(event) =>
                    onChange(
                      'email',
                      event.target.value
                    )
                  }
                  placeholder="contact@..."
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-[#E9E2D5] pt-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#284C3B]">
                  Photos
                </p>

                <p className="mt-1 text-xs text-[#6F756D]">
                  Les URL sont temporaires en attendant le stockage des fichiers.
                </p>
              </div>

              <button
                type="button"
                onClick={addPhoto}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8D4C8] px-4 py-2.5 text-xs font-bold text-[#284C3B] hover:bg-[#F7F5EF]"
              >
                <PlusCircle
                  size={14}
                />
                Ajouter une photo
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {photos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D8D4C8] bg-[#F7F5EF] p-5 text-center text-xs text-[#6F756D]">
                  Aucune photo ajoutée.
                </div>
              ) : (
                photos.map(
                  (photo, index) => (
                    <div
                      key={`${index}-${photo}`}
                      className="flex gap-2"
                    >
                      <FormInput
                        type="url"
                        value={photo}
                        onChange={(
                          event
                        ) =>
                          updatePhoto(
                            index,
                            event.target
                              .value
                          )
                        }
                        placeholder="https://..."
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removePhoto(
                            index
                          )
                        }
                        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-[#E9E2D5] text-[#6F756D] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Supprimer la photo"
                      >
                        <X
                          size={16}
                        />
                      </button>
                    </div>
                  )
                )
              )}
            </div>
          </div>

          <div className="border-t border-[#E9E2D5] pt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#284C3B]">
              Équipements & services
            </p>

            <div className="mt-4">
              <FormField
                label="Équipements"
                hint="Séparez les éléments par des virgules."
              >
                <FormInput
                  value={
                    amenitiesText
                  }
                  onChange={(event) =>
                    onChange(
                      'amenities',
                      event.target.value
                        .split(',')
                        .map(
                          (item) =>
                            item.trim()
                        )
                        .filter(Boolean)
                    )
                  }
                  placeholder="wifi, climatisation, piscine..."
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-[#E9E2D5] pt-7">
            <div className="rounded-2xl border border-[#E2DDCF] bg-[#F7F5EF] p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={20}
                  className="mt-0.5 shrink-0 text-[#284C3B]"
                />

                <div>
                  <p className="font-bold">
                    Règles, horaires et publication
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-[#6F756D]">
                    Les horaires de check-in/check-out, règles de séjour, conditions de publication et justificatifs seront reliés à leurs champs définitifs lors de la passe backend. Aucun champ non confirmé par le modèle actuel n’est inventé ici.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E9E2D5] pt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#284C3B]">
              Préparation à la publication
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: 'Nom de l’établissement',
                  done: Boolean(current.name),
                },
                {
                  label: 'Adresse complète',
                  done: Boolean(current.address),
                },
                {
                  label: 'Description',
                  done: Boolean(current.description),
                },
                {
                  label: 'Contact',
                  done: Boolean(current.phone || current.email),
                },
                {
                  label: 'Au moins une photo',
                  done: photos.length > 0,
                },
                {
                  label: 'Équipements renseignés',
                  done: amenities.length > 0,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-[#E9E2D5] bg-[#F7F5EF] px-4 py-3"
                >
                  {item.done ? (
                    <CheckCircle2
                      size={16}
                      className="shrink-0 text-[#284C3B]"
                    />
                  ) : (
                    <Clock
                      size={16}
                      className="shrink-0 text-[#9A6700]"
                    />
                  )}
                  <span className="text-xs font-semibold">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E9E2D5] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#6F756D]">
              {hasChanges
                ? 'Modifications locales non appliquées.'
                : 'Aucune modification locale en attente.'}
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onReset}
                disabled={!hasChanges}
                className="rounded-xl border border-[#E9E2D5] px-4 py-2.5 text-xs font-bold text-[#59645B] hover:bg-[#F7F5EF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Annuler les modifications
              </button>

              <button
                type="button"
                onClick={onSaveLocal}
                disabled={!hasChanges}
                className="rounded-xl bg-[#284C3B] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1B382D] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Appliquer à l’aperçu
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8C887D]">
            Complétude
          </p>

          <p className="mt-3 font-serif text-3xl font-bold">
            {completion}%
          </p>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECE9E0]">
            <div
              className="h-full bg-[#284C3B]"
              style={{
                width: `${completion}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5 md:col-span-2">
          <ShieldCheck
            size={21}
            className="text-[#284C3B]"
          />

          <h3 className="mt-3 font-bold">
            Publication & vérification
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-[#6F756D]">
            La fiche peut être préparée avant la vérification. Les contrôles d’identité, du droit de gestion et les autres éléments nécessaires seront demandés progressivement avant les actions qui l’exigent.
          </p>


        </div>
      </div>
    </section>
  );
};

/* ========================================================================== */
/* LODGING CONTEXT                                                            */
/* ========================================================================== */

interface LodgingContextCardProps {
  lodging: Lodging;
  completion: number;
  onOpenSettings: () => void;
}

const LodgingContextCard: React.FC<
  LodgingContextCardProps
> = ({
  lodging,
  completion,
  onOpenSettings,
}) => (
  <section className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#EFF3ED] text-[#284C3B]">
          {lodging.photos?.[0] ? (
            <img
              src={
                lodging.photos[0]
              }
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Building2
              size={22}
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-col min-[380px]:flex-row min-[380px]:flex-wrap min-[380px]:items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#284C3B]">
              {getCategoryLabel(
                lodging.category
              )}
            </span>

            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                lodging.is_published
                  ? 'bg-[#EFF3ED] text-[#284C3B]'
                  : 'bg-[#FFF7E8] text-[#9A6700]'
              }`}
            >
              {lodging.is_published
                ? 'Publié'
                : 'En préparation'}
            </span>
          </div>

          <h2 className="mt-1 break-words sm:truncate font-serif text-lg sm:text-xl font-bold">
            {lodging.name}
          </h2>

          <p className="mt-1 flex items-center gap-1 text-xs text-[#6F756D]">
            <MapPin size={12} />
            {lodging.city}
            {lodging.region
              ? `, ${lodging.region}`
              : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-[#F7F5EF] px-4 py-2">
          <p className="text-[10px] font-bold uppercase text-[#999489]">
            Fiche
          </p>

          <p className="text-sm font-bold">
            {completion}% complétée
          </p>
        </div>

        <button
          type="button"
          onClick={
            onOpenSettings
          }
          className="inline-flex items-center gap-2 rounded-xl border border-[#E9E2D5] px-4 py-2.5 text-xs font-bold hover:bg-[#F7F5EF]"
        >
          <Settings size={15} />
          Gérer la fiche
        </button>
      </div>
    </div>
  </section>
);

/* ========================================================================== */
/* GENERIC COMPONENTS                                                         */
/* ========================================================================== */

const LoadingState = () => (
  <div className="flex min-h-[400px] items-center justify-center">
    <div className="text-center">
      <Loader2
        size={28}
        className="mx-auto animate-spin text-[#284C3B]"
      />

      <p className="mt-3 text-sm font-semibold text-[#6F756D]">
        Chargement de votre
        espace hôte...
      </p>
    </div>
  </div>
);

const EmptyHostState: React.FC<{
  onCreate: () => void;
}> = ({ onCreate }) => (
  <div className="mx-auto max-w-2xl rounded-2xl sm:rounded-3xl border border-dashed border-[#D8D4C8] bg-white p-5 sm:p-12 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF3ED] text-[#284C3B]">
      <Building2 size={30} />
    </div>

    <h2 className="mt-5 font-serif text-2xl font-bold">
      Ajoutez votre premier
      hébergement
    </h2>

    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#6F756D]">
      Votre espace hôte est prêt.
      Créez maintenant un
      établissement en brouillon,
      puis ajoutez ses offres,
      disponibilités et
      informations de publication.
    </p>

    <button
      type="button"
      onClick={onCreate}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-bold text-white hover:bg-[#1B382D]"
    >
      <PlusCircle size={17} />
      Ajouter un hébergement
    </button>
  </div>
);

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
}

const StatCard: React.FC<
  StatCardProps
> = ({
  label,
  value,
  detail,
  icon: Icon,
}) => (
  <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C887D]">
          {label}
        </p>

        <p className="mt-3 font-serif text-xl font-bold sm:text-2xl">
          {value}
        </p>
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF3ED] text-[#284C3B]">
        <Icon size={17} />
      </div>
    </div>

    <p className="mt-3 text-[11px] leading-relaxed text-[#8C887D]">
      {detail}
    </p>
  </div>
);

const StatusBadge: React.FC<{
  status: string;
}> = ({ status }) => (
  <span
    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${getBookingStatusClasses(
      status
    )}`}
  >
    {getBookingStatusLabel(
      status
    )}
  </span>
);

interface SectionHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SectionHeader: React.FC<
  SectionHeaderProps
> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="flex flex-col gap-3 border-b border-[#E9E2D5] px-4 sm:px-5 py-4 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="font-serif text-lg font-bold">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-xs text-[#6F756D]">
          {description}
        </p>
      )}
    </div>

    {actionLabel &&
      onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#284C3B]"
        >
          {actionLabel}

          <ChevronRight
            size={14}
          />
        </button>
      )}
  </div>
);

interface QuickActionProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

const QuickAction: React.FC<
  QuickActionProps
> = ({
  icon: Icon,
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-xs font-bold text-[#59645B] transition hover:border-[#E9E2D5] hover:bg-[#F7F5EF]"
  >
    <Icon
      size={16}
      className="text-[#284C3B]"
    />

    <span className="flex-1">
      {label}
    </span>

    <ChevronRight
      size={14}
      className="text-[#AAA69C]"
    />
  </button>
);

interface SimpleEmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SimpleEmptyState: React.FC<
  SimpleEmptyStateProps
> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="rounded-2xl border border-dashed border-[#D8D4C8] bg-white p-6 sm:p-10 text-center">
    <Icon
      size={26}
      className="mx-auto text-[#8C887D]"
    />

    <h3 className="mt-3 font-bold">
      {title}
    </h3>

    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#6F756D]">
      {description}
    </p>

    {actionLabel &&
      onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-xl bg-[#284C3B] px-4 py-2.5 text-xs font-bold text-white"
        >
          {actionLabel}
        </button>
      )}
  </div>
);

interface ComingSoonSectionProps {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  description: string;
}

const ComingSoonSection: React.FC<
  ComingSoonSectionProps
> = ({
  icon: Icon,
  eyebrow,
  title,
  description,
}) => (
  <div className="rounded-2xl border border-[#E9E2D5] bg-white p-5 sm:p-10">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFF3ED] text-[#284C3B]">
      <Icon size={22} />
    </div>

    <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#284C3B]">
      {eyebrow}
    </p>

    <h2 className="mt-2 font-serif text-xl font-bold">
      {title}
    </h2>

    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6F756D]">
      {description}
    </p>
  </div>
);

interface SettingsRowProps {
  label: string;
  value: string;
}

const SettingsRow: React.FC<
  SettingsRowProps
> = ({
  label,
  value,
}) => (
  <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]">
    <span className="text-xs font-semibold text-[#8C887D]">
      {label}
    </span>

    <span className="break-words text-sm font-medium">
      {value}
    </span>
  </div>
);

/* ========================================================================== */
/* MODAL                                                                      */
/* ========================================================================== */

interface ModalShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
  compact?: boolean;
}

const ModalShell: React.FC<
  ModalShellProps
> = ({
  title,
  subtitle,
  children,
  onClose,
  compact = false,
}) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#30352F]/60 p-0 sm:p-4 backdrop-blur-sm">
    <div
      className={`max-h-[94dvh] sm:max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-3xl border border-[#E9E2D5] bg-white shadow-2xl ${
        compact
          ? 'max-w-xl'
          : 'max-w-2xl'
      }`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#1B382D] bg-[#284C3B] px-4 sm:px-6 py-4 sm:py-5 text-white">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#E1E8DF]">
            {subtitle}
          </p>

          <h2 className="mt-1 font-serif text-xl font-bold">
            {title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  </div>
);

interface FormFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

const FormField: React.FC<
  FormFieldProps
> = ({
  label,
  hint,
  required,
  children,
}) => (
  <div className="space-y-2">
    <label className="block text-xs font-bold text-[#3E3A34]">
      {label}

      {required && (
        <span className="ml-1 text-rose-600">
          *
        </span>
      )}

      {hint && (
        <span className="ml-2 font-normal text-[#999489]">
          {hint}
        </span>
      )}
    </label>

    {children}
  </div>
);

const FormInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({
  className = '',
  ...props
}) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-[#DCD8CC] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#AAA69C] focus:border-[#284C3B] focus:ring-2 focus:ring-[#284C3B]/10 ${className}`}
  />
);

const FormSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement>
> = ({
  className = '',
  children,
  ...props
}) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-[#DCD8CC] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#284C3B] focus:ring-2 focus:ring-[#284C3B]/10 ${className}`}
  >
    {children}
  </select>
);

interface ModalActionsProps {
  loading: boolean;
  submitLabel: string;
  loadingLabel: string;
  onCancel: () => void;
}

const ModalActions: React.FC<
  ModalActionsProps
> = ({
  loading,
  submitLabel,
  loadingLabel,
  onCancel,
}) => (
  <div className="flex flex-col-reverse gap-3 border-t border-[#E9E2D5] pt-5 sm:flex-row sm:justify-end">
    <button
      type="button"
      onClick={onCancel}
      className="rounded-xl border border-[#E9E2D5] px-5 py-3 text-sm font-bold text-[#59645B] hover:bg-[#F7F5EF]"
    >
      Annuler
    </button>

    <button
      type="submit"
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-5 py-3 text-sm font-bold text-white hover:bg-[#1B382D] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <Loader2
          size={16}
          className="animate-spin"
        />
      )}

      {loading
        ? loadingLabel
        : submitLabel}
    </button>
  </div>
);

export default HotelierDashboardPage;