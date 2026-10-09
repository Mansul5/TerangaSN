import React, { useEffect, useState } from 'react';



import {

  MapPin,

  Heart,

  Share2,

  ShieldCheck,

  Clock,

  MessageSquarePlus,

  Loader2,

  AlertCircle,

  ChevronLeft,
  ChevronRight,
  Star,
  Navigation,
  Images,
  Users,
  CheckCircle2,

} from 'lucide-react';



import { Lodging, RoomType, Review } from '@/src/types';



import {

  fetchHotelById,

  fetchHotelRooms,

  fetchHotelReviews,

  submitReview,

  toggleFavorite,

  calculateStayPricing,

  checkRoomAvailabilityRPC,

} from '@/src/lib/supabase/api';



import {

  formatFCFA,

  formatDistance,


  getCategoryLabel,

  calculateNights,

} from '@/src/lib/formatters';



import { BadgeEquipement } from '@/src/components/BadgeEquipement';

import { RoomCard } from '@/src/components/RoomCard';

import { ReviewCard } from '@/src/components/ReviewCard';



import { useAuth } from '@/src/context/AuthContext';



interface HotelDetailPageProps {

  hotelId: string;



  searchParams?: {

    checkIn?: string;

    checkOut?: string;

    adults?: number;

    children?: number;

    rooms?: number;

  };



  onBack: () => void;



  onProceedToBooking: (bookingPayload: {

    hotel: Lodging;

    roomType: RoomType;

    checkIn: string;

    checkOut: string;

    adults: number;

    children: number;

    roomsCount: number;

    nightsCount: number;

    totalPrice: number;

  }) => void;



  onAuthRequired: () => void;

}



const getDateString = (date: Date): string => {

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;

};



const getTomorrowDate = (): string => {

  const date = new Date();

  date.setDate(date.getDate() + 1);

  return getDateString(date);

};



const getDefaultCheckOutDate = (): string => {

  const date = new Date();

  date.setDate(date.getDate() + 3);

  return getDateString(date);

};



export const HotelDetailPage: React.FC<HotelDetailPageProps> = ({

  hotelId,

  searchParams,

  onBack,

  onProceedToBooking,

  onAuthRequired,

}) => {

  const { user } = useAuth();



  const [hotel, setHotel] = useState<Lodging | null>(null);

  const [rooms, setRooms] = useState<RoomType[]>([]);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);



  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);



  const [checkIn, setCheckIn] = useState<string>(

    searchParams?.checkIn || getTomorrowDate()

  );



  const [checkOut, setCheckOut] = useState<string>(

    searchParams?.checkOut || getDefaultCheckOutDate()

  );



  const [adults, setAdults] = useState<number>(

    searchParams?.adults || 2

  );



  const [children, setChildren] = useState<number>(

    searchParams?.children || 0

  );



  const [roomsCount, setRoomsCount] = useState<number>(

    searchParams?.rooms || 1

  );

  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);

  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const [isReviewFormOpen, setIsReviewFormOpen] =

    useState<boolean>(false);



  const [reviewRating, setReviewRating] = useState<number>(5);



  const [reviewComment, setReviewComment] =

    useState<string>('');



  const [reviewGuestName, setReviewGuestName] =

    useState<string>(

      user?.email?.split('@')[0] || ''

    );



  const [reviewSubmitting, setReviewSubmitting] =

    useState<boolean>(false);



  const [reviewSuccess, setReviewSuccess] =

    useState<boolean>(false);

  const [roomPricingMap, setRoomPricingMap] = useState<

    Record<

      string,

      {

        totalPrice: number;

        averageNightlyPrice: number;

        hasSpecialRates: boolean;

        isAvailable: boolean;

        minAvailable?: number;

      }

    >

  >({});



  const nightsCount = calculateNights(

    checkIn,

    checkOut

  );

  useEffect(() => {

    if (user?.email && !reviewGuestName) {

      setReviewGuestName(

        user.email.split('@')[0]

      );

    }

  }, [user, reviewGuestName]);

  useEffect(() => {

    if (

      !rooms.length ||

      !checkIn ||

      !checkOut ||

      nightsCount <= 0

    ) {

      setRoomPricingMap({});

      return;

    }



    let isMounted = true;



    const loadPricingAndAvailability =

      async () => {

        const results: Record<

          string,

          {

            totalPrice: number;

            averageNightlyPrice: number;

            hasSpecialRates: boolean;

            isAvailable: boolean;

            minAvailable?: number;

          }

        > = {};



        for (const room of rooms) {

          try {

            const [

              pricing,

              availabilityResult,

            ] = await Promise.all([

              calculateStayPricing(

                room,

                checkIn,

                checkOut,

                roomsCount

              ),



              checkRoomAvailabilityRPC(

                room.id,

                checkIn,

                checkOut,

                roomsCount

              ),

            ]);



            

            const isAvail =

              availabilityResult.isAvailable;



            results[room.id] = {

              totalPrice: pricing.totalPrice,

              averageNightlyPrice:

                pricing.averageNightlyPrice,

              hasSpecialRates:

                pricing.hasSpecialRates,

              isAvailable: isAvail,

              minAvailable:

                pricing.minAvailable,

            };

          } catch {

            

            results[room.id] = {

              totalPrice:

                room.price_per_night *

                nightsCount *

                roomsCount,



              averageNightlyPrice:

                room.price_per_night,



              hasSpecialRates: false,



              isAvailable: false,



              minAvailable: 0,

            };

          }

        }



        if (isMounted) {

          setRoomPricingMap(results);

        }

      };



    loadPricingAndAvailability();



    return () => {

      isMounted = false;

    };

  }, [

    rooms,

    checkIn,

    checkOut,

    roomsCount,

    nightsCount,

  ]);

  useEffect(() => {

    let isMounted = true;



    const loadHotelDetails = async () => {

      setIsLoading(true);

      setErrorMsg(null);

      setActivePhotoIdx(0);

      setSelectedRoom(null);

      setRoomPricingMap({});
      setReviewsLoaded(false);

      try {

        const [

          hotelRes,

          roomsRes,

          reviewsRes,

        ] = await Promise.all([

          fetchHotelById(hotelId),

          fetchHotelRooms(hotelId),

          fetchHotelReviews(hotelId),

        ]);



        if (!isMounted) return;



        if (

          hotelRes.error ||

          !hotelRes.data

        ) {

          setHotel(null);

          setRooms([]);

          setReviews([]);



          setErrorMsg(

            'Impossible de charger les détails de ce logement.'

          );

        } else {

          setHotel(hotelRes.data);
          setReviewsLoaded(!reviewsRes.error);



          setRooms(

            roomsRes.data || []

          );



          setReviews(

            reviewsRes.data || []

          );



          if (

            roomsRes.data &&

            roomsRes.data.length > 0

          ) {

            setSelectedRoom(

              roomsRes.data[0]

            );

          }

        }

      } catch (err: any) {

        if (!isMounted) return;



        setHotel(null);

        setRooms([]);

        setReviews([]);



        setErrorMsg(

          err?.message ||

            'Erreur inconnue'

        );

      } finally {

        if (isMounted) {

          setIsLoading(false);

        }

      }

    };



    loadHotelDetails();



    window.scrollTo({

      top: 0,

      behavior: 'smooth',

    });



    return () => {

      isMounted = false;

    };

  }, [hotelId]);



  const handleFavoriteToggle = async () => {

    if (!user) {

      onAuthRequired();

      return;

    }



    try {

      const { isFavorite: updated } =

        await toggleFavorite(

          user.id,

          hotelId

        );



      setIsFavorite(updated);

    } catch (err: any) {

      alert(

        err?.message ||

          'Impossible de modifier vos favoris pour le moment.'

      );

    }

  };



  const handleShare = async () => {

    try {

      await navigator.clipboard.writeText(

        window.location.href

      );



      setCopiedLink(true);



      setTimeout(() => {

        setCopiedLink(false);

      }, 2000);

    } catch {

      alert(

        'Impossible de copier le lien. Vous pouvez copier l’adresse de la page manuellement.'

      );

    }

  };



  const handleReviewSubmit = async (

    e: React.FormEvent

  ) => {

    e.preventDefault();



    if (!user) {

      onAuthRequired();

      return;

    }



    if (!reviewComment.trim()) {

      return;

    }



    try {

      setReviewSubmitting(true);



      const { error } =

        await submitReview({

          hotel_id: hotelId,

          user_id: user.id,

          rating: reviewRating,

          comment:

            reviewComment.trim(),

          guest_name:

            reviewGuestName.trim() ||

            'Voyageur',

        });



      if (error) {

        throw error;

      }



      setReviewSuccess(true);

      setReviewComment('');



      setTimeout(() => {

        setIsReviewFormOpen(false);

        setReviewSuccess(false);

      }, 2000);

    } catch (err: any) {

      alert(

        err?.message ||

          'Erreur lors de l’envoi de votre avis'

      );

    } finally {

      setReviewSubmitting(false);

    }

  };



  const handleCheckInChange = (

    value: string

  ) => {

    setCheckIn(value);



    

    if (!checkOut || value >= checkOut) {

      const nextDay = new Date(

        `${value}T00:00:00`

      );



      nextDay.setDate(

        nextDay.getDate() + 1

      );



      setCheckOut(

        getDateString(nextDay)

      );

    }

  };



  const handleCheckOutChange = (

    value: string

  ) => {

    if (value <= checkIn) {

      const nextDay = new Date(

        `${checkIn}T00:00:00`

      );



      nextDay.setDate(

        nextDay.getDate() + 1

      );



      setCheckOut(

        getDateString(nextDay)

      );



      return;

    }



    setCheckOut(value);

  };



  const handleProceed = () => {

    if (!hotel || !selectedRoom) {

      return;

    }



    if (

      !checkIn ||

      !checkOut ||

      nightsCount <= 0

    ) {

      alert(

        'Veuillez sélectionner des dates de séjour valides.'

      );



      return;

    }



    const pricing =

      roomPricingMap[

        selectedRoom.id

      ];



    

    if (!pricing) {

      alert(

        'La disponibilité de cette chambre est encore en cours de vérification. Veuillez patienter quelques secondes.'

      );



      return;

    }



    if (!pricing.isAvailable) {

      alert(

        "Cette offre n'est pas disponible pour les dates sélectionnées."

      );



      return;

    }



    const totalPrice =

      pricing.totalPrice ||

      selectedRoom.price_per_night *

        nightsCount *

        roomsCount;



    onProceedToBooking({

      hotel,

      roomType: selectedRoom,

      checkIn,

      checkOut,

      adults,

      children,

      roomsCount,

      nightsCount,

      totalPrice,

    });

  };



  if (isLoading) {

    return (

      <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center p-6">

        <div className="text-center space-y-3">

          <Loader2

            className="animate-spin text-[#284C3B] mx-auto"

            size={36}

          />



          <p className="text-sm font-semibold text-[#666A61]">

            Chargement du logement...

          </p>

        </div>

      </div>

    );

  }



  if (errorMsg || !hotel) {

    return (

      <div className="min-h-screen bg-[#F7F5EF] py-16 px-4 max-w-2xl mx-auto text-center space-y-4">

        <div className="w-16 h-16 bg-[#F1EDE4] text-[#997648] rounded-full flex items-center justify-center mx-auto">

          <AlertCircle size={32} />

        </div>



        <h2 className="text-2xl font-serif font-bold text-[#30352F]">

          Logement non trouvé

        </h2>



        <p className="text-sm text-[#666A61]">

          {errorMsg ||

            'Ce logement n’existe pas ou a été supprimé.'}

        </p>



        <button

          type="button"

          onClick={onBack}

          className="px-5 py-2.5 bg-[#284C3B] text-white rounded-xl font-bold text-xs hover:bg-[#1B382D] transition cursor-pointer"

        >

          Retour aux résultats

        </button>

      </div>

    );

  }



  const photos =

    hotel.photos &&

    hotel.photos.length > 0

      ? hotel.photos

      : [

          'https\://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',

        ];



  // Only published/approved reviews contribute to the public score.
  // Some API implementations already filter to approved reviews and omit status.
  const publishedReviews = reviews.filter((review) => {
    const status = (review as Review & { status?: string }).status;
    return !status || status === 'approved';
  });
  const ratedReviews = publishedReviews.filter((review) =>
    Number.isFinite(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5
  );
  const averageRating = ratedReviews.length
    ? ratedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / ratedReviews.length
    : null;

  // Coordinates may be provided under different names depending on the schema.
  const location = hotel as Lodging & {
    latitude?: number | string | null;
    longitude?: number | string | null;
    lat?: number | string | null;
    lng?: number | string | null;
  };
  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng);
  const hasCoordinates = (location.latitude ?? location.lat) != null &&
    (location.longitude ?? location.lng) != null &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  const directionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude}%2C${longitude}`
    : null;

  const selectedRoomPricing =

    selectedRoom

      ? roomPricingMap[

          selectedRoom.id

        ]

      : undefined;



  const selectedRoomTotal =

    selectedRoomPricing?.totalPrice ||

    (selectedRoom

      ? selectedRoom.price_per_night *

        nightsCount *

        roomsCount

      : 0);



  return (

    <div className="bg-[#F7F5EF] min-h-screen pb-24 overflow-x-clip">

      

      <div className="bg-white border-b border-[#E9E2D5] sticky top-16 z-20 px-3 min-[360px]:px-4 sm:px-6 py-2.5 sm:py-3 shadow-xs">

        <div className="max-w-7xl mx-auto flex min-w-0 items-center justify-between gap-2">

          <button

            type="button"

            onClick={onBack}

            className="flex min-w-0 items-center gap-1 text-[11px] min-[360px]:text-xs sm:text-sm font-bold text-[#30352F] hover:text-[#284C3B] transition cursor-pointer"

          >

            <ChevronLeft size={18} />



            <span className="truncate">

              <span className="min-[360px]:hidden">Retour</span>

              <span className="hidden min-[360px]:inline">Tous les hébergements</span>

            </span>

          </button>



          <div className="flex shrink-0 items-center gap-1 min-[360px]:gap-2">

            <button

              type="button"

              onClick={

                handleFavoriteToggle

              }

              className="flex items-center gap-1.5 p-2 min-[360px]:px-3 min-[360px]:py-1.5 rounded-lg border border-[#E9E2D5] text-xs font-semibold hover:bg-[#F1EDE4] transition cursor-pointer"

            >

              <Heart

                size={14}

                className={

                  isFavorite

                    ? 'fill-[#997648] text-[#997648]'

                    : 'text-[#666A61]'

                }

              />



              <span className="hidden min-[360px]:inline">

                {isFavorite

                  ? 'Enregistré'

                  : 'Sauvegarder'}

              </span>

            </button>



            <button

              type="button"

              onClick={handleShare}

              className="flex items-center gap-1.5 p-2 min-[360px]:px-3 min-[360px]:py-1.5 rounded-lg border border-[#E9E2D5] text-xs font-semibold hover:bg-[#F1EDE4] transition cursor-pointer"

            >

              <Share2

                size={14}

                className="text-[#666A61]"

              />



              <span className="hidden min-[360px]:inline">

                {copiedLink

                  ? 'Lien copié !'

                  : 'Partager'}

              </span>

            </button>



            <button

              type="button"

              onClick={() => {

                const el =

                  document.getElementById(

                    'rooms-selection-section'

                  );



                el?.scrollIntoView({

                  behavior: 'smooth',

                });

              }}

              className="bg-[#284C3B] hover:bg-[#1B382D] text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs hidden sm:block cursor-pointer"

            >

              Réserver maintenant

            </button>

          </div>

        </div>

      </div>



      <div className="max-w-7xl mx-auto px-3 min-[360px]:px-4 sm:px-6 pt-5 sm:pt-6 space-y-6 sm:space-y-8">

        

        <div>

          <div className="flex flex-wrap items-center gap-2 mb-2">

            <span className="bg-[#E8F0E9] text-[#284C3B] text-xs font-bold px-2.5 py-0.5 rounded-md uppercase border border-[#D4E0D7]">

              {getCategoryLabel(

                hotel.category

              )}

            </span>



            <span className="text-xs text-[#777B73]">

              •

            </span>



            <span className="text-xs text-[#666A61] font-medium">

              Sénégal • {hotel.region} •{' '}

              {hotel.city}

            </span>

          </div>



          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

            <div>

              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#30352F] tracking-tight">

                {hotel.name}

              </h1>



              <p className="flex flex-wrap items-start gap-x-1.5 gap-y-1 text-xs sm:text-sm text-[#666A61] mt-1">

                <MapPin

                  size={15}

                  className="text-[#997648] shrink-0"

                />



                <span>

                  {hotel.address}

                </span>



                {hotel.distance_beach_m !==

                  null && (

                  <span className="text-[#284C3B] font-semibold ml-2">

                    (

                    {formatDistance(

                      hotel.distance_beach_m

                    )}{' '}

                    de la plage)

                  </span>

                )}

              </p>

            </div>



            

                          <div className="flex items-center gap-3 rounded-2xl border border-[#E9E2D5] bg-white px-4 py-3 shadow-sm shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-bold text-[#284C3B]">
                    {averageRating === null ? 'Nouvel établissement' : `${averageRating.toFixed(1)} / 5`}
                  </span>
                  <div className="flex gap-0.5" aria-label={averageRating === null ? 'Aucune note' : `Note moyenne ${averageRating.toFixed(1)} sur 5`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={13} className={averageRating !== null && star <= Math.round(averageRating) ? 'fill-[#B79B69] text-[#B79B69]' : 'text-[#D8D5CD]'} />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#777B73]">
                    {!reviewsLoaded ? 'Avis indisponibles' : `${ratedReviews.length} avis publié${ratedReviews.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#284C3B] text-white font-black text-lg flex items-center justify-center">
                  {averageRating === null ? '—' : averageRating.toFixed(1)}
                </div>
              </div>

          </div>

        </div>



        

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:h-[480px]">

          

          <div className="lg:col-span-8 h-[230px] min-[360px]:h-[280px] sm:h-[380px] lg:h-full rounded-2xl overflow-hidden shadow-xs bg-[#30352F] relative">

            <img

              src={

                photos[

                  activePhotoIdx

                ]

              }

              alt={hotel.name}

              className="w-full h-full object-cover"

            />



            <div className="absolute bottom-4 left-4 bg-[#30352F]/80 backdrop-blur-xs text-white text-xs px-3 py-1.5 rounded-lg font-semibold">

              Photo {activePhotoIdx + 1}{' '}

              sur {photos.length}

            </div>

          </div>



          

          <div className="lg:col-span-4 flex gap-2.5 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">

            {photos.map(

              (imgUrl, idx) => (

                <button

                  type="button"

                  key={`${imgUrl}-${idx}`}

                  onClick={() =>

                    setActivePhotoIdx(

                      idx

                    )

                  }

                  aria-label={`Afficher la photo ${

                    idx + 1

                  }`}

                  className={`h-20 w-28 shrink-0 min-[360px]:h-24 min-[360px]:w-36 lg:h-36 lg:w-auto rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${

                    activePhotoIdx ===

                    idx

                      ? 'border-[#284C3B] ring-2 ring-[#284C3B]/20'

                      : 'border-transparent opacity-75 hover:opacity-100'

                  }`}

                >

                  <img

                    src={imgUrl}

                    alt=""

                    className="w-full h-full object-cover"

                  />

                </button>

              )

            )}

          </div>

        </div>



        

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          

          <div className="lg:col-span-8 space-y-8">

            

            <div className="bg-white p-4 min-[360px]:p-5 sm:p-6 rounded-2xl border border-[#E9E2D5] shadow-xs space-y-4">

              <h3 className="text-lg font-serif font-bold text-[#30352F]">

                À propos du logement

              </h3>



              <p className="text-sm text-[#30352F] leading-relaxed whitespace-pre-line">

                {hotel.description}

              </p>



              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 min-[360px]:gap-4 pt-4 border-t border-[#E9E2D5] text-xs">

                <div className="flex items-center gap-2 text-[#30352F]">

                  <Clock

                    size={16}

                    className="text-[#284C3B] shrink-0"

                  />



                  <div>

                    <span className="font-bold">

                      Arrivée :

                    </span>{' '}

                    à partir de{' '}

                    {hotel.check_in_time ||

                      '14:00'}

                  </div>

                </div>



                <div className="flex items-center gap-2 text-[#30352F]">

                  <Clock

                    size={16}

                    className="text-[#997648] shrink-0"

                  />



                  <div>

                    <span className="font-bold">

                      Départ :

                    </span>{' '}

                    jusqu'à{' '}

                    {hotel.check_out_time ||

                      '12:00'}

                  </div>

                </div>

              </div>

            </div>



            

            <div className="bg-white p-4 min-[360px]:p-5 sm:p-6 rounded-2xl border border-[#E9E2D5] shadow-xs space-y-4">

              <h3 className="text-lg font-serif font-bold text-[#30352F]">

                Équipements & Services

              </h3>



              <div className="flex flex-wrap gap-2">

                {hotel.amenities?.map(

                  (amenity) => (

                    <BadgeEquipement

                      key={amenity}

                      id={amenity}

                      size="lg"

                    />

                  )

                )}

              </div>

            </div>



            

            <div

              id="rooms-selection-section"

              className="space-y-4"

            >

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>

                  <h3 className="text-xl font-serif font-bold text-[#30352F]">

                    Disponibilités

                  </h3>



                  <p className="text-xs text-[#666A61]">

                    Sélectionnez l'offre qui

                    vous convient pour{' '}

                    {nightsCount} nuit

                    {nightsCount > 1

                      ? 's'

                      : ''}

                  </p>

                </div>

              </div>



              {rooms.length === 0 ? (

                <div className="bg-white p-8 rounded-2xl border border-[#E9E2D5] text-center space-y-2">

                  <p className="text-sm font-bold text-[#30352F]">

                    Aucune offre enregistrée

                    pour ce logement

                  </p>



                  <p className="text-xs text-[#666A61]">

                    Le gestionnaire n'a pas encore

                    ajouté d'offre pour ce logement.

                  </p>

                </div>

              ) : (

                <div className="space-y-4">

                  {rooms.map(

                    (room) => (

                      <RoomCard

                        key={room.id}

                        room={room}

                        nightsCount={

                          nightsCount

                        }

                        isSelected={

                          selectedRoom?.id ===

                          room.id

                        }

                        onSelect={(r) =>

                          setSelectedRoom(r)

                        }

                        pricing={

                          roomPricingMap[

                            room.id

                          ]

                        }

                      />

                    )

                  )}

                </div>

              )}

            </div>



            

            <div className="bg-white p-6 rounded-2xl border border-[#E9E2D5] shadow-xs space-y-6">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="text-lg font-serif font-bold text-[#30352F]">

                    Avis des voyageurs

                  </h3>



                  <p className="text-xs text-[#666A61]">

                    {ratedReviews.length} avis publiés

                  </p>

                </div>



                <button

                  type="button"

                  onClick={() =>

                    setIsReviewFormOpen(

                      !isReviewFormOpen

                    )

                  }

                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8F0E9] text-[#284C3B] hover:bg-[#DCE9CF] rounded-lg text-xs font-bold transition cursor-pointer border border-[#D4E0D7]"

                >

                  <MessageSquarePlus

                    size={14}

                  />



                  <span>

                    Donner mon avis

                  </span>

                </button>

              </div>



              

              {isReviewFormOpen && (

                <form

                  onSubmit={

                    handleReviewSubmit

                  }

                  className="bg-[#F7F5EF] p-4 rounded-xl border border-[#E9E2D5] space-y-3"

                >

                  <h4 className="text-xs font-bold text-[#30352F] uppercase tracking-wider">

                    Partagez votre expérience

                    sur cet établissement

                  </h4>



                  {reviewSuccess && (

                    <div className="p-3 bg-[#E8F0E9] border border-[#D4E0D7] text-[#284C3B] text-xs rounded-lg font-bold">

                      Avis envoyé avec succès !

                      Il sera publié après

                      modération.

                    </div>

                  )}



                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div>

                      <label

                        htmlFor="review-guest-name"

                        className="block text-xs font-bold text-[#30352F] mb-1"

                      >

                        Votre nom

                      </label>



                      <input

                        id="review-guest-name"

                        type="text"

                        required

                        value={

                          reviewGuestName

                        }

                        onChange={(e) =>

                          setReviewGuestName(

                            e.target.value

                          )

                        }

                        placeholder="Ex: Awa Ndiaye"

                        className="w-full text-xs px-3 py-2 bg-white border border-[#E9E2D5] rounded-lg outline-none focus:border-[#284C3B]"

                      />

                    </div>



                    <div>

                      <label

                        htmlFor="review-rating"

                        className="block text-xs font-bold text-[#30352F] mb-1"

                      >

                        Note globale (/5)

                      </label>



                      <select

                        id="review-rating"

                        value={

                          reviewRating

                        }

                        onChange={(e) =>

                          setReviewRating(

                            Number(

                              e.target.value

                            )

                          )

                        }

                        className="w-full text-xs px-3 py-2 bg-white border border-[#E9E2D5] rounded-lg outline-none font-bold text-[#30352F] focus:border-[#284C3B]"

                      >

                        <option value={5}>

                          5 - Exceptionnel

                        </option>



                        <option value={4}>

                          4 - Très bien

                        </option>



                        <option value={3}>

                          3 - Bien

                        </option>



                        <option value={2}>

                          2 - Moyen

                        </option>



                        <option value={1}>

                          1 - Décevant

                        </option>

                      </select>

                    </div>

                  </div>



                  <div>

                    <label

                      htmlFor="review-comment"

                      className="block text-xs font-bold text-[#30352F] mb-1"

                    >

                      Votre commentaire

                    </label>



                    <textarea

                      id="review-comment"

                      required

                      rows={3}

                      value={

                        reviewComment

                      }

                      onChange={(e) =>

                        setReviewComment(

                          e.target.value

                        )

                      }

                      placeholder="Accueil chaleureux, cadre paisible face à la mer..."

                      className="w-full text-xs p-3 bg-white border border-[#E9E2D5] rounded-lg outline-none focus:border-[#284C3B]"

                    />

                  </div>



                  <div className="flex justify-end gap-2">

                    <button

                      type="button"

                      onClick={() =>

                        setIsReviewFormOpen(

                          false

                        )

                      }

                      className="px-3 py-1.5 text-xs text-[#666A61] font-bold hover:bg-[#F1EDE4] rounded-lg cursor-pointer"

                    >

                      Annuler

                    </button>



                    <button

                      type="submit"

                      disabled={

                        reviewSubmitting

                      }

                      className="px-4 py-1.5 bg-[#284C3B] hover:bg-[#1B382D] text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50"

                    >

                      {reviewSubmitting

                        ? 'Envoi...'

                        : 'Publier mon avis'}

                    </button>

                  </div>

                </form>

              )}



              

              {publishedReviews.length === 0 ? (

                <p className="text-xs text-[#777B73] italic">

                  Aucun avis pour le moment.

                  Soyez le premier à partager

                  votre expérience !

                </p>

              ) : (

                <div className="space-y-3">

                  {publishedReviews.map(

                    (rev) => (

                      <ReviewCard

                        key={rev.id}

                        review={rev}

                      />

                    )

                  )}

                </div>

              )}

            </div>

          </div>



          

          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-32">

            

            <div className="bg-white p-4 min-[360px]:p-5 rounded-2xl border-2 border-[#284C3B] shadow-md space-y-4">

              <div className="flex items-center justify-between pb-3 border-b border-[#E9E2D5]">

                <span className="text-xs font-bold uppercase tracking-wider text-[#284C3B]">

                  Récapitulatif séjour

                </span>



                <span className="text-xs font-bold text-[#997648] bg-[#F1EDE4] px-2 py-0.5 rounded border border-[#E9E2D5]">

                  {nightsCount} nuit

                  {nightsCount > 1

                    ? 's'

                    : ''}

                </span>

              </div>



              

              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 text-xs">

                <div className="bg-[#F7F5EF] p-2.5 rounded-xl border border-[#E9E2D5]">

                  <label

                    htmlFor="detail-check-in-input"

                    className="text-[10px] text-[#666A61] font-bold uppercase block"

                  >

                    Arrivée

                  </label>



                  <input

                    id="detail-check-in-input"

                    type="date"

                    value={checkIn}

                    min={getDateString(

                      new Date()

                    )}

                    onChange={(e) =>

                      handleCheckInChange(

                        e.target.value

                      )

                    }

                    className="w-full font-bold text-[#30352F] bg-transparent outline-none cursor-pointer"

                  />

                </div>



                <div className="bg-[#F7F5EF] p-2.5 rounded-xl border border-[#E9E2D5]">

                  <label

                    htmlFor="detail-check-out-input"

                    className="text-[10px] text-[#666A61] font-bold uppercase block"

                  >

                    Départ

                  </label>



                  <input

                    id="detail-check-out-input"

                    type="date"

                    value={checkOut}

                    min={checkIn}

                    onChange={(e) =>

                      handleCheckOutChange(

                        e.target.value

                      )

                    }

                    className="w-full font-bold text-[#30352F] bg-transparent outline-none cursor-pointer"

                  />

                </div>

              </div>



              

              {selectedRoom ? (

                <div className="bg-[#E8F0E9] p-3.5 rounded-xl border border-[#D4E0D7] space-y-1">

                  <p className="text-[11px] font-bold text-[#284C3B] uppercase">

                    Offre sélectionnée :

                  </p>



                  <p className="text-xs font-bold text-[#30352F]">

                    {selectedRoom.name}

                  </p>



                  <p className="text-xs text-[#997648] font-semibold">

                    {formatFCFA(

                      selectedRoomPricing?.averageNightlyPrice ||

                        selectedRoom.price_per_night

                    )}{' '}

                    / nuit

                  </p>



                  {selectedRoomPricing?.hasSpecialRates && (

                    <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">

                      Tarif saisonnier appliqué

                    </span>

                  )}



                  {selectedRoomPricing?.isAvailable ===

                    false && (

                    <p className="text-xs font-bold text-rose-700 mt-1">

                      ⚠️ Non disponible pour ces

                      dates

                    </p>

                  )}



                  {!selectedRoomPricing && (

                    <p className="text-[10px] text-[#666A61] mt-1">

                      Vérification de la

                      disponibilité...

                    </p>

                  )}

                </div>

              ) : (

                <p className="text-xs text-[#997648] bg-[#F1EDE4] p-2.5 rounded-xl border border-[#E9E2D5]">

                  Veuillez choisir une offre dans

                  la liste.

                </p>

              )}



              

              {selectedRoom && (

                <div className="pt-2 border-t border-[#E9E2D5] space-y-1">

                  <div className="flex justify-between text-xs text-[#666A61]">

                    <span>

                      Pour {nightsCount} nuit

                      {nightsCount > 1

                        ? 's'

                        : ''}{' '}

                      ({roomsCount} ch.)

                    </span>



                    <span>

                      {formatFCFA(

                        selectedRoomTotal

                      )}

                    </span>

                  </div>



                  <div className="flex justify-between items-baseline pt-2">

                    <span className="text-sm font-serif font-bold text-[#30352F]">

                      Total du séjour :

                    </span>



                    <span className="text-xl font-serif font-bold text-[#997648]">

                      {formatFCFA(

                        selectedRoomTotal

                      )}

                    </span>

                  </div>



                  <p className="text-[10px] text-[#777B73]">

                    Montant indicatif selon les conditions de réservation affichées

                  </p>

                </div>

              )}



              

              <button

                type="button"

                id="proceed-to-booking-btn"

                disabled={

                  !selectedRoom ||

                  !selectedRoomPricing ||

                  selectedRoomPricing.isAvailable ===

                    false ||

                  nightsCount <= 0

                }

                onClick={handleProceed}

                className="w-full py-3.5 bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white font-extrabold text-sm rounded-xl transition shadow-xs hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"

              >

                {selectedRoomPricing?.isAvailable ===

                false ? (

                  <span>

                    Non disponible pour ces dates

                  </span>

                ) : !selectedRoomPricing ? (

                  <span>

                    Vérification...

                  </span>

                ) : (

                  <span>

                    Continuer vers la réservation

                  </span>

                )}

              </button>



              <div className="flex items-center gap-2 text-xs text-[#666A61] pt-1">

                <ShieldCheck

                  size={16}

                  className="text-[#284C3B] shrink-0"

                />



                <span>

                  Consultez les conditions de paiement avant de confirmer

                </span>

              </div>

            </div>



            

            <div className="bg-white p-5 rounded-2xl border border-[#E9E2D5] shadow-xs space-y-3">

              <h4 className="font-serif font-bold text-sm text-[#30352F] flex items-center gap-1.5">

                <MapPin

                  size={16}

                  className="text-[#997648]"

                />



                <span>Emplacement</span>

              </h4>



              <p className="text-xs text-[#666A61]">

                {hotel.address}, {hotel.city}

              </p>



              {directionsUrl ? (
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#284C3B] hover:bg-[#1B382D] text-white py-3 text-sm font-bold transition">
                  <Navigation size={17} /> Obtenir l'itinéraire
                </a>
              ) : (
                <p className="text-xs text-[#777B73] bg-[#F7F5EF] rounded-xl p-3">Itinéraire indisponible : les coordonnées GPS de cet établissement n'ont pas encore été renseignées.</p>
              )}

            </div>

          </div>

        </div>

      </div>

    </div>

  );

};



export default HotelDetailPage;