import React, { useState, useEffect, useCallback } from 'react';

import { 

  Calendar as CalendarIcon,

  CheckCircle2,

  Lock,

  Unlock,

  Sparkles,

  AlertCircle,

  Loader2,


  CalendarCheck,

  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BedDouble,
  Info

} from 'lucide-react';

import { RoomType, RoomAvailability } from '@/src/types';
import {
  assignPhysicalRoom,
  fetchRoomUnitOccupancy,
  fetchRoomUnits,
  PhysicalRoomUnit,
  RoomUnitOccupancy,
  updateRoomUnit,
} from '@/src/lib/supabase/api';

type CalendarDay = RoomAvailability & {
  configured: boolean;
  sales_closed: boolean;
  booked_rooms: number;
  remaining_rooms: number;
  closure_reason?: string | null;
  reason?: string | null;
  active_units?: number;
  special_units?: number;
  special_unit_min_price?: number | null;
  special_unit_max_price?: number | null;
};

import { formatFCFA, formatDate } from '@/src/lib/formatters';
import { supabase } from '@/src/lib/supabase/client';

type CalendarBookingDetail = {
  id: string;
  booking_number: string;
  guest_name: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  rooms_count: number;
  nights_count: number;
  total_price: number;
  commission_amount: number;
  booking_source: string;
  status: string;
  payment_status: string;
};




interface RoomAvailabilityCalendarProps {

  rooms: RoomType[];

  selectedRoomId?: string;

  onRoomSelect?: (roomId: string) => void;

}



const CALENDAR_START_YEAR = 2026;

const CALENDAR_END_YEAR = 2045;



const MONTHS = [

  'Janvier',

  'Février',

  'Mars',

  'Avril',

  'Mai',

  'Juin',

  'Juillet',

  'Août',

  'Septembre',

  'Octobre',

  'Novembre',

  'Décembre',

];



const toDateString = (year: number, month: number, day: number) => {

  const d = new Date(year, month, day);

  return [

    d.getFullYear(),

    String(d.getMonth() + 1).padStart(2, '0'),

    String(d.getDate()).padStart(2, '0'),

  ].join('-');

};



export const RoomAvailabilityCalendar: React.FC<RoomAvailabilityCalendarProps> = ({

  rooms,

  selectedRoomId: initialRoomId,

  onRoomSelect,

}) => {

  const [selectedRoomId, setSelectedRoomId] = useState<string>(

    initialRoomId || (rooms.length > 0 ? rooms[0].id : '')

  );



  useEffect(() => {
    if (initialRoomId && rooms.some(room => room.id === initialRoomId)) {
      setSelectedRoomId(initialRoomId);
    } else if (!rooms.some(room => room.id === selectedRoomId)) {
      setSelectedRoomId(rooms[0]?.id || '');
    }
  }, [initialRoomId, rooms, selectedRoomId]);

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0] || null;

  useEffect(() => {
    setSelectedPhysicalUnitIds([]);
    setCalendarScope('category');
  }, [activeRoom?.id]);



  // Calendar View State: Current month/year

  const [currentDate, setCurrentDate] = useState<Date>(() => {

    const d = new Date();

    d.setDate(1);

    return d;

  });



  // Sélection guidée : année → mois → jour.

  // 2026 est volontairement la première année proposée.

  const [selectedDay, setSelectedDay] = useState<number>(() => {

    const d = new Date();

    return d.getDate();

  });




  const [availabilityList, setAvailabilityList] = useState<CalendarDay[]>([]);
  const [dayBookings, setDayBookings] = useState<CalendarBookingDetail[]>([]);
  const [dayBookingsLoading, setDayBookingsLoading] = useState(false);
  const [dayBookingsError, setDayBookingsError] = useState<string | null>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [physicalUnits, setPhysicalUnits] = useState<PhysicalRoomUnit[]>([]);
  const [physicalOccupancy, setPhysicalOccupancy] = useState<RoomUnitOccupancy[]>([]);
  const [closedPhysicalUnits, setClosedPhysicalUnits] = useState<Map<string, string | null>>(new Map());
  const [physicalRangeClosedUnitIds, setPhysicalRangeClosedUnitIds] = useState<Set<string>>(new Set());
  const [physicalUnitRates, setPhysicalUnitRates] = useState<Map<string, { price: number; reason: string | null }>>(new Map());
  const [physicalRangeRateUnitIds, setPhysicalRangeRateUnitIds] = useState<Set<string>>(new Set());
  const [selectedPhysicalUnitIds, setSelectedPhysicalUnitIds] = useState<string[]>([]);
  const [calendarScope, setCalendarScope] = useState<'category' | 'units'>('category');
  const [physicalUnitsLoading, setPhysicalUnitsLoading] = useState(false);
  const [physicalUnitsError, setPhysicalUnitsError] = useState<string | null>(null);
  const [physicalUnitActionId, setPhysicalUnitActionId] = useState<string | null>(null);
  const [physicalUnitActionError, setPhysicalUnitActionError] = useState<string | null>(null);
  const [reassignmentTargets, setReassignmentTargets] = useState<Record<string, string>>({});
  const [physicalUnitLabels, setPhysicalUnitLabels] = useState<Record<string, { code: string; name: string }>>({});
  const [physicalBlockReason, setPhysicalBlockReason] = useState('');
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [monthBookings, setMonthBookings] = useState<CalendarBookingDetail[]>([]);
  const [monthBookingsLoading, setMonthBookingsLoading] = useState(false);
  const [monthBookingsError, setMonthBookingsError] = useState<string | null>(null);
  const [timelineExpandedId, setTimelineExpandedId] = useState<string | null>(null);

  // Trois présentations d'un même jeu de données Supabase. Préférence locale facultative.
  const [calendarView, setCalendarView] = useState<'simple' | 'visual' | 'detailed'>(() => {
    try {
      const saved = window.localStorage.getItem('boly-pms-calendar-view');
      return saved === 'simple' || saved === 'visual' || saved === 'detailed' ? saved : 'visual';
    } catch {
      return 'visual';
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem('boly-pms-calendar-view', calendarView); } catch { /* stockage indisponible */ }
  }, [calendarView]);


  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);


  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);



  // Selected Date / Range Selection

  const [rangeStart, setRangeStart] = useState<string | null>(null);

  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const refreshPhysicalUnits = useCallback(async () => {
    if (!activeRoom || !rangeStart) {
      setPhysicalUnits([]);
      setPhysicalOccupancy([]);
      setClosedPhysicalUnits(new Map());
      setPhysicalRangeClosedUnitIds(new Set());
      setPhysicalUnitRates(new Map());
      setPhysicalRangeRateUnitIds(new Set());
      return;
    }

    setPhysicalUnitsLoading(true);
    setPhysicalUnitsError(null);
    try {
      const { data: units, error: unitsError } = await fetchRoomUnits(activeRoom.id);
      if (unitsError) throw unitsError;
      const activeUnits = units.filter((unit) => unit.is_active);
      const unitIds = activeUnits.map((unit) => unit.id);
      const endDate = rangeEnd || rangeStart;
      const [{ data: occupancy, error: occupancyError }, { data: closures, error: closuresError }, { data: rangeClosures, error: rangeClosuresError }, { data: rates, error: ratesError }, { data: rangeRates, error: rangeRatesError }] = await Promise.all([
        fetchRoomUnitOccupancy(unitIds),
        unitIds.length
          ? supabase.from('room_unit_availability')
            .select('room_unit_id,reason')
            .in('room_unit_id', unitIds)
            .eq('date', rangeStart)
            .eq('sales_closed', true)
          : Promise.resolve({ data: [], error: null }),
        unitIds.length
          ? supabase.from('room_unit_availability')
            .select('room_unit_id,date')
            .in('room_unit_id', unitIds)
            .gte('date', rangeStart)
            .lte('date', endDate)
            .eq('sales_closed', true)
          : Promise.resolve({ data: [], error: null }),
        unitIds.length
          ? supabase.from('room_unit_rate_overrides')
            .select('room_unit_id,price_override,reason')
            .in('room_unit_id', unitIds)
            .eq('date', rangeStart)
          : Promise.resolve({ data: [], error: null }),
        unitIds.length
          ? supabase.from('room_unit_rate_overrides')
            .select('room_unit_id,date')
            .in('room_unit_id', unitIds)
            .gte('date', rangeStart)
            .lte('date', endDate)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (occupancyError) throw occupancyError;
      if (closuresError) throw closuresError;
      if (rangeClosuresError) throw rangeClosuresError;
      if (ratesError) throw ratesError;
      if (rangeRatesError) throw rangeRatesError;
      setPhysicalUnits(activeUnits);
      setPhysicalOccupancy(occupancy);
      setPhysicalUnitLabels(Object.fromEntries(activeUnits.map((unit) => [
        unit.id,
        { code: unit.unit_code || '', name: unit.unit_name || '' },
      ])));
      setClosedPhysicalUnits(new Map(
        (closures || []).map((item: { room_unit_id: string; reason: string | null }) => [item.room_unit_id, item.reason])
      ));
      setPhysicalRangeClosedUnitIds(new Set(
        (rangeClosures || []).map((item: { room_unit_id: string }) => item.room_unit_id)
      ));
      setPhysicalUnitRates(new Map(
        (rates || []).map((item: { room_unit_id: string; price_override: number; reason: string | null }) => [
          item.room_unit_id,
          { price: Number(item.price_override), reason: item.reason },
        ])
      ));
      setPhysicalRangeRateUnitIds(new Set(
        (rangeRates || []).map((item: { room_unit_id: string }) => item.room_unit_id)
      ));
    } catch (error) {
      setPhysicalUnits([]);
      setPhysicalOccupancy([]);
      setClosedPhysicalUnits(new Map());
      setPhysicalRangeClosedUnitIds(new Set());
      setPhysicalUnitRates(new Map());
      setPhysicalRangeRateUnitIds(new Set());
      setPhysicalUnitsError(error instanceof Error ? error.message : 'Impossible de charger les chambres physiques.');
    } finally {
      setPhysicalUnitsLoading(false);
    }
  }, [activeRoom?.id, rangeStart, rangeEnd]);

  useEffect(() => {
    void refreshPhysicalUnits();
  }, [refreshPhysicalUnits]);



  // Edit Form state for selected range

  const [editRoomsCount, setEditRoomsCount] = useState<number>(activeRoom?.total_rooms || 1);

  const [editPriceOverride, setEditPriceOverride] = useState<string>('');

  // Chaque modification doit être explicitement choisie.
  const [changeCapacity, setChangeCapacity] = useState(false);
  const [changePrice, setChangePrice] = useState(false);



  // Sync active room changes

  useEffect(() => {

    if (activeRoom) {

      setEditRoomsCount(activeRoom.total_rooms);

    }

  }, [activeRoom]);



  // Read the saved values directly from Supabase. Never re-initialize rows
  // during a read: initialization must not overwrite seasonal prices.
  const readAvailability = async (roomId: string, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = new Date(year, month, 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(year, month + 1, 0);
    end.setDate(end.getDate() + 14);
    let startDate = toDateString(start.getFullYear(), start.getMonth(), start.getDate());
    let endDate = toDateString(end.getFullYear(), end.getMonth(), end.getDate());
    if (rangeStart && rangeStart < startDate) startDate = rangeStart;
    if (rangeEnd && rangeEnd > endDate) endDate = rangeEnd;
    const [{ data, error }, { data: units, error: unitsError }, { data: bookings, error: bookingsError }] = await Promise.all([
      supabase.rpc('get_room_calendar_status_v2', {
      p_room_type_id: roomId,
      p_start_date: startDate,
      p_end_date: endDate,
      }),
      supabase.from('room_units').select('id').eq('room_type_id', roomId).eq('is_active', true),
      supabase.from('bookings')
        .select('check_in,check_out,rooms_count,status')
        .eq('room_type_id', roomId)
        .lte('check_in', endDate)
        .gt('check_out', startDate)
        .in('status', ['pending', 'confirmed', 'completed']),
    ]);
    if (error) throw error;
    if (unitsError) throw unitsError;
    if (bookingsError) throw bookingsError;
    const unitIds = (units || []).map((unit) => unit.id);
    const { data: closures, error: closuresError } = unitIds.length
      ? await supabase.from('room_unit_availability')
        .select('room_unit_id,date')
        .in('room_unit_id', unitIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('sales_closed', true)
      : { data: [], error: null };
    if (closuresError) throw closuresError;
    return ((data || []) as any[]).map((day) => {
      const booked = (bookings || []).reduce((count, booking) =>
        booking.check_in <= day.date && booking.check_out > day.date
          ? count + Number(booking.rooms_count)
          : count, 0);
      const blocked = (closures || []).filter((closure) => closure.date === day.date).length;
      const baseCapacity = Math.min(Number(day.rooms_available), Number(activeRoom?.id === roomId ? activeRoom.total_rooms : (units || []).length));
      const capacity = Math.min(baseCapacity, Math.max(0, (units || []).length - blocked));
      return {
        ...day,
        room_type_id: roomId,
        rooms_available: capacity,
        booked_rooms: booked,
        remaining_rooms: Boolean(day.sales_closed) ? 0 : Math.max(0, capacity - booked),
        configured: Boolean(day.configured),
        sales_closed: Boolean(day.sales_closed),
      };
    }) as CalendarDay[];
  };

  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    void readAvailability(activeRoom.id, currentDate)
      .then(data => {
        if (!cancelled) setAvailabilityList(data);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to load availability:', err);
          setAvailabilityList([]);
          setLoadError(err?.message || 'Impossible de charger les disponibilités.');
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [activeRoom?.id, currentDate, rangeStart, rangeEnd]);

  // Read actual bookings for the selected night. Checkout is exclusive.
  useEffect(() => {
    if (!activeRoom || !rangeStart) {
      setDayBookings([]);
      setDayBookingsLoading(false);
      setDayBookingsError(null);
      setExpandedBookingId(null);
      return;
    }

    let cancelled = false;
    const roomTypeId = activeRoom.id;
    const selectedDate = rangeStart;

    const loadDayBookings = async () => {
      setDayBookingsLoading(true);
      setDayBookingsError(null);
      setExpandedBookingId(null);

      try {
        const [year, month, day] = selectedDate.split('-').map(Number);
        const nextDay = toDateString(year, month - 1, day + 1);
        const { data, error } = await supabase
          .from('bookings')
          .select('id,booking_number,guest_name,guest_phone,check_in,check_out,rooms_count,nights_count,total_price,commission_amount,booking_source,status,payment_status')
          .eq('room_type_id', roomTypeId)
          .lt('check_in', nextDay)
          .gt('check_out', selectedDate)
          .in('status', ['pending', 'confirmed', 'completed'])
          .order('check_in', { ascending: true });

        if (cancelled) return;
        if (error) throw error;
        setDayBookings((data || []) as CalendarBookingDetail[]);
      } catch (error: unknown) {
        if (cancelled) return;
        setDayBookings([]);
        setDayBookingsError(error instanceof Error ? error.message : 'Impossible de charger les réservations.');
      } finally {
        if (!cancelled) setDayBookingsLoading(false);
      }
    };

    void loadDayBookings();
    return () => { cancelled = true; };
  }, [activeRoom?.id, rangeStart]);

  // Vue chronologique : réservations réelles de la catégorie, sans attribution
  // fictive à des chambres physiques. Le jour de départ est exclusif.
  useEffect(() => {
    if (!activeRoom) { setMonthBookings([]); return; }
    let cancelled = false;
    const start = toDateString(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = toDateString(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setMonthBookingsLoading(true);
    setMonthBookingsError(null);
    void (async () => {
      try {
        const { data, error } = await supabase.from('bookings')
          .select('id,booking_number,guest_name,guest_phone,check_in,check_out,rooms_count,nights_count,total_price,commission_amount,booking_source,status,payment_status')
          .eq('room_type_id', activeRoom.id)
          .lt('check_in', end).gt('check_out', start)
          .in('status', ['pending', 'confirmed', 'completed'])
          .order('check_in', { ascending: true });
        if (error) throw error;
        if (!cancelled) setMonthBookings((data || []) as CalendarBookingDetail[]);
      } catch (error: unknown) {
        if (!cancelled) {
          setMonthBookings([]);
          setMonthBookingsError(error instanceof Error ? error.message : 'Impossible de lire les réservations.');
        }
      } finally { if (!cancelled) setMonthBookingsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [activeRoom?.id, currentDate]);

  const moveMonth = (delta: number) => {
    setCurrentDate(current => {
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      return next.getFullYear() >= CALENDAR_START_YEAR && next.getFullYear() <= CALENDAR_END_YEAR ? next : current;
    });
    handleClearSelection();
  };

  // Navigation guidée : année → mois → jour.

  const handleYearChange = (yearValue: number) => {

    const nextYear = Math.max(CALENDAR_START_YEAR, Math.min(CALENDAR_END_YEAR, yearValue));

    const maxDay = new Date(nextYear, currentDate.getMonth() + 1, 0).getDate();

    const nextDay = Math.min(selectedDay, maxDay);



    setCurrentDate(new Date(nextYear, currentDate.getMonth(), 1));

    setSelectedDay(nextDay);

    handleClearSelection();

  };



  const handleMonthChange = (monthValue: number) => {

    const maxDay = new Date(currentDate.getFullYear(), monthValue + 1, 0).getDate();

    const nextDay = Math.min(selectedDay, maxDay);



    setCurrentDate(new Date(currentDate.getFullYear(), monthValue, 1));

    setSelectedDay(nextDay);

    handleClearSelection();

  };



  const handleDayChange = (dayValue: number) => {

    const maxDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    const nextDay = Math.max(1, Math.min(maxDay, dayValue));



    setSelectedDay(nextDay);

    handleDateClick(toDateString(currentDate.getFullYear(), currentDate.getMonth(), nextDay));

  };



  const handleTodayMonth = () => {

    const d = new Date();

    const year = Math.max(CALENDAR_START_YEAR, Math.min(CALENDAR_END_YEAR, d.getFullYear()));

    const maxDay = new Date(year, d.getMonth() + 1, 0).getDate();



    setCurrentDate(new Date(year, d.getMonth(), 1));

    setSelectedDay(Math.min(d.getDate(), maxDay));

    handleClearSelection();

  };



  // Date selection click handler

  const handleDateClick = (dateStr: string) => {

    const clickedDate = new Date(`${dateStr}T00:00:00`);

    if (!Number.isNaN(clickedDate.getTime())) {

      setSelectedDay(clickedDate.getDate());

    }



    if (!rangeStart || (rangeStart && rangeEnd)) {

      // Start new selection

      setRangeStart(dateStr);

      setRangeEnd(null);
      setChangeCapacity(false);
      setChangePrice(false);

      // Pre-fill current values for this single date

      const existing = availabilityList.find(a => a.date === dateStr);

      if (existing) {

        setEditRoomsCount(existing.rooms_available);

        setEditPriceOverride(existing.price_override !== null ? String(existing.price_override) : '');

      } else {

        setEditRoomsCount(activeRoom?.total_rooms || 1);

        setEditPriceOverride('');

      }

    } else {

      // Second click: finish range

      if (dateStr < rangeStart) {

        setRangeEnd(rangeStart);

        setRangeStart(dateStr);

      } else {

        setRangeEnd(dateStr);

      }

    }

  };



  // Clear selection

  const handleClearSelection = () => {

    setRangeStart(null);

    setRangeEnd(null);

  };



  const runCalendarAction = async (
    action: 'close_sales' | 'reopen_sales' | 'set_price' | 'remove_price' | 'set_capacity',
    roomUnitIds: string[] | null = null,
    priceOverride: number | null = null,
    roomsAvailable: number | null = null,
  ) => {
    if (!activeRoom || !rangeStart || isSaving) return;
    const start = rangeStart;
    const end = rangeEnd || rangeStart;
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      const { error } = await supabase.rpc('set_room_calendar_action', {
        p_room_type_id: activeRoom.id,
        p_start_date: start,
        p_end_date: end,
        p_action: action,
        p_room_unit_ids: roomUnitIds,
        p_rooms_available: roomsAvailable,
        p_price_override: priceOverride,
        p_reason: physicalBlockReason.trim() || null,
      });
      if (error) throw error;
      const refreshed = await readAvailability(activeRoom.id, currentDate);
      setAvailabilityList(refreshed);
      await refreshPhysicalUnits();
      const target = roomUnitIds
        ? `${roomUnitIds.length} unité${roomUnitIds.length > 1 ? 's' : ''}`
        : 'toute la catégorie';
      const labels: Record<typeof action, string> = {
        close_sales: 'Ventes fermées',
        reopen_sales: 'Ventes rouvertes',
        set_price: 'Tarif spécial appliqué',
        remove_price: 'Tarif spécial retiré',
        set_capacity: 'Capacité mise à jour',
      };
      setFeedbackMsg({ type: 'success', text: `${labels[action]} pour ${target}, du ${formatDate(start)} au ${formatDate(end)}.` });
      setSelectedPhysicalUnitIds([]);
    } catch (error) {
      setFeedbackMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Impossible de modifier le calendrier.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // rooms_available is the SALES CAPACITY, not the remaining inventory.
  const handleSetSalesStatus = async (closeSales: boolean) => {
    if (!activeRoom || !rangeStart || isSaving) return;
    const start = rangeStart;
    const end = rangeEnd || rangeStart;
    const selected = availabilityList.filter(day => day.date >= start && day.date <= end);
    if (start < toDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) return;
    if (closeSales ? selected.every(day => day.sales_closed) : !selected.some(day => day.sales_closed)) return;
    await runCalendarAction(closeSales ? 'close_sales' : 'reopen_sales');
  };

  const handleApplyBlock = () => handleSetSalesStatus(true);
  const handleApplyRestoreCapacity = () => handleSetSalesStatus(false);

  const handleSetSelectedUnitsStatus = async (closeSales: boolean) => {
    if (!selectedPhysicalUnitIds.length) return;
    await runCalendarAction(
      closeSales ? 'close_sales' : 'reopen_sales',
      selectedPhysicalUnitIds,
    );
  };

  const handleReassignPhysicalRoom = async (bookingId: string, oldUnitId: string) => {
    const newUnitId = reassignmentTargets[bookingId];
    if (!newUnitId || physicalUnitActionId) return;
    setPhysicalUnitActionId(bookingId);
    setPhysicalUnitActionError(null);
    try {
      const { error } = await assignPhysicalRoom(bookingId, oldUnitId, newUnitId);
      if (error) throw error;
      setReassignmentTargets((previous) => ({ ...previous, [bookingId]: '' }));
      await refreshPhysicalUnits();
    } catch (error) {
      setPhysicalUnitActionError(error instanceof Error ? error.message : 'Impossible de changer l’affectation.');
    } finally {
      setPhysicalUnitActionId(null);
    }
  };

  const handleSavePhysicalRoomLabel = async (unit: PhysicalRoomUnit) => {
    const label = physicalUnitLabels[unit.id];
    if (!label || physicalUnitActionId) return;
    setPhysicalUnitActionId(unit.id);
    setPhysicalUnitActionError(null);
    try {
      const { error } = await updateRoomUnit(unit.id, {
        unitCode: label.code,
        unitName: label.name,
      });
      if (error) throw error;
      await refreshPhysicalUnits();
    } catch (error) {
      setPhysicalUnitActionError(error instanceof Error ? error.message : 'Impossible d’enregistrer le nom de la chambre.');
    } finally {
      setPhysicalUnitActionId(null);
    }
  };

  // Apply only the changes explicitly requested by the owner.
  const handleSaveCustomChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !rangeStart || isSaving) return;
    const start = rangeStart;
    const end = rangeEnd || rangeStart;
    const today = toDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if (start < today) {
      setFeedbackMsg({ type: 'error', text: 'Les dates passées ne sont pas modifiables.' });
      return;
    }
    if (!changeCapacity && !changePrice) {
      setFeedbackMsg({ type: 'error', text: 'Choisissez au moins une modification : disponibilité ou tarif.' });
      return;
    }
    if (changeCapacity && (!Number.isInteger(editRoomsCount) || editRoomsCount < 0 || editRoomsCount > activeRoom.total_rooms)) {
      setFeedbackMsg({ type: 'error', text: `Saisissez une capacité entre 0 et ${activeRoom.total_rooms}.` });
      return;
    }
    const priceNum = editPriceOverride.trim() === '' ? null : Number(editPriceOverride);
    if (changePrice && priceNum !== null && (!Number.isSafeInteger(priceNum) || priceNum < 0)) {
      setFeedbackMsg({ type: 'error', text: 'Le tarif spécial doit être un montant entier positif ou nul en FCFA.' });
      return;
    }
    if (changePrice && priceNum === null && !availabilityList.some(day =>
      day.date >= start && day.date <= end && day.price_override !== null
    )) {
      setFeedbackMsg({ type: 'error', text: 'Aucun tarif spécial n’existe sur cette période à retirer.' });
      return;
    }
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      const { error } = await supabase.rpc('update_room_calendar_range', {
        p_room_type_id: activeRoom.id,
        p_start_date: start,
        p_end_date: end,
        p_rooms_available: changeCapacity ? editRoomsCount : null,
        p_price_override: changePrice ? priceNum : null,
        p_update_price: changePrice,
        p_reason: physicalBlockReason.trim() || null,
      });
      if (error) throw error;
      const saved = await readAvailability(activeRoom.id, currentDate);
      setAvailabilityList(saved);
      setFeedbackMsg({
        type: 'success',
        text: changeCapacity && changePrice
          ? 'Disponibilités et tarifs enregistrés.'
          : changeCapacity ? 'Disponibilités enregistrées en mode manuel.' : 'Tarifs enregistrés sans modifier les disponibilités.',
      });
      handleClearSelection();
      setChangeCapacity(false);
      setChangePrice(false);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setIsSaving(false);
    }
  };


  // Calendar matrix calculations

  const year = currentDate.getFullYear();

  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });



  const firstDayOfMonth = new Date(year, month, 1);

  const lastDayOfMonth = new Date(year, month + 1, 0);



  // Day index 0=Dimanche, convert to Monday=0

  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  const daysInMonth = lastDayOfMonth.getDate();



  // Create grid cells

  const calendarCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isPast: boolean }[] = [];



  const todayStr = toDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());



  // Pre-padding from prev month

  const prevMonthLastDay = new Date(year, month, 0).getDate();

  for (let i = startDayOfWeek - 1; i >= 0; i--) {

    const day = prevMonthLastDay - i;

    const d = new Date(year, month - 1, day);

    const ds = toDateString(d.getFullYear(), d.getMonth(), d.getDate());

    calendarCells.push({

      dateStr: ds,

      dayNum: day,

      isCurrentMonth: false,

      isPast: ds < todayStr,

    });

  }



  // Current month days

  for (let d = 1; d <= daysInMonth; d++) {

    const dateObj = new Date(year, month, d);

    const ds = toDateString(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    calendarCells.push({

      dateStr: ds,

      dayNum: d,

      isCurrentMonth: true,

      isPast: ds < todayStr,

    });

  }



  // Post-padding to complete 35 or 42 grid cells

  const remaining = 35 - calendarCells.length > 0 ? 35 - calendarCells.length : 42 - calendarCells.length;

  for (let d = 1; d <= remaining; d++) {

    const dateObj = new Date(year, month + 1, d);

    const ds = toDateString(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    calendarCells.push({

      dateStr: ds,

      dayNum: d,

      isCurrentMonth: false,

      isPast: ds < todayStr,

    });

  }



  // Lookup map

  const availMap = new Map<string, CalendarDay>();

  availabilityList.forEach(a => availMap.set(a.date, a));



  // Compute month overview stats

  const monthAvailList = availabilityList.filter(a => a.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));

  const blockedDaysCount = monthAvailList.filter(a => a.sales_closed).length;

  const specialRatesCount = monthAvailList.filter(a =>
    a.price_override !== null
    || Boolean(a.active_units && a.active_units > 0 && a.special_units === a.active_units)
  ).length;
  const selectedCalendarDay = rangeStart ? availMap.get(rangeStart) : null;
  const selectedBooked = selectedCalendarDay?.booked_rooms ?? 0;
  const selectedRemaining = selectedCalendarDay?.remaining_rooms ?? 0;
  const selectedClosed = Boolean(selectedCalendarDay?.sales_closed);
  const selectedBlocked = selectedCalendarDay
    ? Math.max(0, (activeRoom?.total_rooms ?? 0) - selectedBooked - selectedRemaining)
    : 0;



  if (!activeRoom) {

    return (

      <div className="bg-white p-8 rounded-3xl border border-[#E6E2D3] text-center space-y-3">

        <p className="font-bold text-sm text-[#2D2A26]">Aucun type de chambre sélectionné</p>

        <p className="text-xs text-[#6B6658]">Veuillez d'abord ajouter un type de chambre pour gérer le calendrier des disponibilités.</p>

      </div>

    );

  }



  return (

    <div className="space-y-6">



      {/* Header & Room Selector */}

      <div className="bg-white p-6 rounded-3xl border border-[#E6E2D3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">

        <div>

          <span className="text-xs text-[#8B5E34] font-bold uppercase tracking-wider block">Back-office Gestionnaire</span>

          <h3 className="text-lg font-serif font-bold text-[#2D2A26] flex items-center gap-2">

            <CalendarCheck size={20} className="text-[#284C3B]" />

            <span>Gestion des Disponibilités & Tarifs Saisonniers</span>

          </h3>

          <p className="text-xs text-[#6B6658] mt-0.5">

            Fermez les nouvelles ventes, ajustez la capacité de vente ou fixez des tarifs spéciaux (Magal, Tabaski, événements).

          </p>

        </div>



        {/* Room Switcher Dropdown */}

        {rooms.length > 1 && (

          <div className="flex items-center gap-2">

            <label className="text-xs font-bold text-[#2D2A26] whitespace-nowrap">Chambre :</label>

            <select

              value={activeRoom.id}

              onChange={(e) => {

                setSelectedRoomId(e.target.value);

                if (onRoomSelect) onRoomSelect(e.target.value);

                handleClearSelection();

              }}

              className="bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl px-3 py-2 text-xs font-bold text-[#2D2A26] outline-none focus:border-[#284C3B]"

            >

              {rooms.map(r => (

                <option key={r.id} value={r.id}>

                  {r.name} ({formatFCFA(r.price_per_night)} / nuit)

                </option>

              ))}

            </select>

          </div>

        )}

      </div>



      {/* Overview Cards */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">

        <div className="bg-white p-4 rounded-2xl border border-[#E6E2D3] shadow-xs flex items-center justify-between">

          <div>

            <span className="text-[#6B6658] font-medium block">Capacité nominale</span>

            <span className="text-base font-serif font-bold text-[#2D2A26]">{activeRoom.total_rooms} chambres</span>

          </div>

          <span className="p-2.5 bg-[#EFF3ED] text-[#284C3B] rounded-xl font-bold">

            {formatFCFA(activeRoom.price_per_night)} / nuit

          </span>

        </div>



        <div className="bg-white p-4 rounded-2xl border border-[#E6E2D3] shadow-xs flex items-center justify-between">

          <div>

            <span className="text-[#6B6658] font-medium block">Jours avec capacité à zéro</span>

            <span className="text-base font-serif font-bold text-rose-600">{blockedDaysCount} jour(s)</span>

          </div>

          <span className="p-2.5 bg-rose-50 text-rose-700 rounded-xl">

            <Lock size={16} />

          </span>

        </div>



        <div className="bg-white p-4 rounded-2xl border border-[#E6E2D3] shadow-xs flex items-center justify-between">

          <div>

            <span className="text-[#6B6658] font-medium block">Tarifs spéciaux configurés</span>

            <span className="text-base font-serif font-bold text-[#8B5E34]">{specialRatesCount} date(s)</span>

          </div>



        </div>

      </div>



      {loadError && (
        <div role="alert" className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">
          Chargement impossible : {loadError}
        </div>
      )}

      {feedbackMsg && (

        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${

          feedbackMsg.type === 'success' 

            ? 'bg-[#EFF3ED] border-[#DCE7DD] text-[#284C3B]'

            : 'bg-rose-50 border-rose-200 text-rose-700'

        }`}>

          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}

          <div className="flex-1 font-medium">{feedbackMsg.text}</div>

          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">

            <X size={14} />

          </button>

        </div>

      )}



      {/* Planning des séjours with physical room assignments. */}
      <section className="rounded-[26px] border border-[#E4E9E1] bg-white p-4 shadow-sm sm:p-6" aria-label="Planning des séjours">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A17A42]">TerangaSN · Gestion des séjours</p>
            <h4 className="mt-1 font-serif text-xl font-semibold text-[#244A39]">Calendrier PMS · {calendarView === 'simple' ? 'Vue simple' : calendarView === 'visual' ? 'Vue visuelle' : 'Vue détaillée'}</h4>
            <p className="mt-1 text-xs text-[#69786D]">Séjours en attente ou confirmés · {activeRoom.name} · arrivée incluse, départ exclu</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([['simple', 'Simple'], ['visual', 'Visuelle'], ['detailed', 'Détaillée']] as const).map(([view, label]) => (
              <button key={view} type="button" onClick={() => setCalendarView(view)} aria-pressed={calendarView === view}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244A39] ${calendarView === view ? 'bg-[#244A39] text-white' : 'bg-[#F3F5F0] text-[#244A39] hover:bg-[#E6EDE4]'}`}>{label}</button>
            ))}
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mois précédent" className="rounded-xl border border-[#E4E9E1] p-2"><ChevronLeft size={16}/></button>
            <span className="min-w-[115px] text-center text-xs font-semibold capitalize text-[#244A39]">{monthName}</span>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Mois suivant" className="rounded-xl border border-[#E4E9E1] p-2"><ChevronRight size={16}/></button>
          </div>
        </div>
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#E6E9DE] bg-[#F7F8F3] p-3 text-xs text-[#586B5D]">
          <Info size={16} className="mt-0.5 shrink-0 text-[#244A39]"/>
          <span>Les réservations affectent automatiquement des chambres physiques libres. Dans le détail d’une journée, vous pouvez bloquer une chambre seule ou déplacer une réservation vers une autre chambre libre.</span>
        </div>
        {calendarView !== 'simple' ? (
          <div className="space-y-3">
            {monthBookingsLoading && <p className="flex items-center gap-2 py-6 text-sm text-[#69786D]"><Loader2 size={16} className="animate-spin"/>Chargement des séjours…</p>}
            {monthBookingsError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{monthBookingsError}</p>}
            {!monthBookingsLoading && !monthBookingsError && monthBookings.length === 0 && <p className="rounded-xl bg-[#F7F8F3] p-5 text-center text-sm text-[#69786D]">Aucun séjour confirmé sur cette période.</p>}
            {!monthBookingsLoading && !monthBookingsError && monthBookings.length > 0 && (
              <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: Math.max(740, daysInMonth * 26 + 200) }}>
                  <div className="grid gap-0 border-b border-[#E4E9E1] pb-2" style={{ gridTemplateColumns: `190px repeat(${daysInMonth}, minmax(26px, 1fr))` }}>
                    <span className="text-[11px] font-semibold text-[#69786D]">{calendarView === 'detailed' ? 'Réservation / client' : 'Séjour / référence'}</span>
                    {Array.from({length: daysInMonth}, (_, index) => <span key={index} className={`text-center text-[10px] ${toDateString(year, month, index + 1) === todayStr ? 'font-bold text-[#244A39]' : 'text-[#8C948B]'}`}>{index + 1}</span>)}
                  </div>
                  {monthBookings.map(booking => {
                    const first = toDateString(year, month, 1);
                    const nextMonth = toDateString(year, month + 1, 1);
                    const visibleStart = booking.check_in > first ? booking.check_in : first;
                    const visibleEnd = booking.check_out < nextMonth ? booking.check_out : nextMonth;
                    const startIndex = Number(visibleStart.slice(8,10)) - 1;
                    const endIndex = visibleEnd === nextMonth ? daysInMonth : Number(visibleEnd.slice(8,10)) - 1;
                    return <div key={booking.id} className="border-b border-[#F0F1EB] py-2">
                      <div className="grid items-center" style={{ gridTemplateColumns: `190px repeat(${daysInMonth}, minmax(26px, 1fr))` }}>
                        <button type="button" onClick={() => { if (calendarView === 'visual') { setCalendarView('detailed'); setTimelineExpandedId(booking.id); } else setTimelineExpandedId(value => value === booking.id ? null : booking.id); }} className="flex min-w-0 items-center gap-2 pr-3 text-left" aria-expanded={timelineExpandedId === booking.id}>
                          <BedDouble size={14} className="shrink-0 text-[#244A39]"/><span className="min-w-0"><span className="block truncate text-xs font-semibold text-[#263D30]">{calendarView === 'detailed' ? (booking.guest_name || 'Client') : booking.booking_number}</span><span className="block truncate text-[10px] text-[#7B887D]">{booking.rooms_count} unité(s) · {calendarView === 'detailed' ? booking.booking_number : `${booking.nights_count} nuit(s)`}</span></span>
                        </button>
                        {Array.from({length: daysInMonth}, (_, index) => {
                          const occupied = index >= startIndex && index < endIndex;
                          return <button key={index} type="button" onClick={() => { if (calendarView === 'visual') { setCalendarView('detailed'); setTimelineExpandedId(booking.id); } else setTimelineExpandedId(value => value === booking.id ? null : booking.id); }} title={occupied ? `${booking.guest_name} : ${formatDate(booking.check_in)} → ${formatDate(booking.check_out)} (départ exclu)` : `Voir la réservation ${booking.booking_number}`} className={`h-9 border-r border-white/70 ${occupied ? 'bg-[#CFE3D5] hover:bg-[#B7D5C2]' : 'bg-[#F7F8F5] hover:bg-[#EEF1EB]'} ${occupied && index === startIndex ? 'rounded-l-lg' : ''} ${occupied && index === endIndex - 1 ? 'rounded-r-lg' : ''}`} aria-label={`${index+1} ${monthName} : ${occupied ? 'séjour en cours' : 'hors séjour'} — ${booking.guest_name}`}/>;
                        })}
                      </div>
                      {calendarView === 'detailed' && timelineExpandedId === booking.id && <div className="ml-0 mt-2 grid gap-2 rounded-xl border border-[#E3E9DF] bg-[#F8F9F5] p-3 text-xs text-[#33483B] sm:ml-[190px] sm:grid-cols-2">
                        <span><strong>Arrivée :</strong> {formatDate(booking.check_in)}</span><span><strong>Départ :</strong> {formatDate(booking.check_out)}</span>
                        <span><strong>Nuits :</strong> {booking.nights_count}</span><span><strong>Unités réservées :</strong> {booking.rooms_count}</span>
                        <span><strong>Client :</strong> {booking.guest_name || 'Non renseigné'}</span><span><strong>Téléphone :</strong> {booking.guest_phone || 'Non renseigné'}</span>
                        <span><strong>Total :</strong> {formatFCFA(booking.total_price)}</span><span><strong>Statut :</strong> {booking.status === 'confirmed' ? 'Confirmée' : booking.status === 'completed' ? 'Terminée' : booking.status}</span><span><strong>Paiement :</strong> {booking.payment_status === 'on_site_paid' ? 'Payé' : 'À vérifier'}</span>
                        <span className="sm:col-span-2"><strong>Référence :</strong> {booking.booking_number}</span>
                      </div>}
                    </div>;
                  })}
                </div>
              </div>
            )}
            <p className="text-[11px] text-[#7B887D]">Les cases vertes forment la barre du séjour : arrivée incluse, départ exclu. {calendarView === 'detailed' ? 'Cliquez sur une réservation pour consulter ses détails.' : 'Passez en vue Détaillée pour voir le client et les informations du séjour.'} Les quantités représentent des unités réservées, sans affectation à des chambres physiques.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="rounded-xl bg-[#F7F8F3] p-4 text-xs text-[#586B5D]">Vue Simple : consultez les disponibilités, les nuits réservées, les fermetures de ventes et les tarifs dans la grille mensuelle ci-dessous. Sélectionnez une date pour consulter les réservations et effectuer vos modifications.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#E4E9E1] p-3"><span className="block text-[11px] text-[#69786D]">Unités physiques</span><strong className="font-serif text-xl text-[#244A39]">{activeRoom.total_rooms}</strong></div>
              <div className="rounded-xl border border-[#E4E9E1] p-3"><span className="block text-[11px] text-[#69786D]">Jours ventes fermées</span><strong className="font-serif text-xl text-[#244A39]">{blockedDaysCount}</strong></div>
              <div className="rounded-xl border border-[#E4E9E1] p-3"><span className="block text-[11px] text-[#69786D]">Dates tarif spécial</span><strong className="font-serif text-xl text-[#244A39]">{specialRatesCount}</strong></div>
            </div>
          </div>
        )}
      </section>

      {/* CALENDAR & ACTION PANEL */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">



        {/* LEFT: Interactive Month Grid */}

        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-[#E6E2D3] shadow-xs space-y-4">



          {/* Sélection guidée : année → mois → jour */}

          <div className="pb-4 border-b border-[#E6E2D3] space-y-3">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

              <div>

                <h4 className="font-serif font-bold text-base text-[#2D2A26]">

                  Choisir une date

                </h4>

                <p className="text-[11px] text-[#6B6658] mt-0.5">

                  Sélectionnez d'abord l'année, puis le mois, puis le jour.

                </p>

              </div>



              <button

                type="button"

                onClick={handleTodayMonth}

                className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F0EDE4] border border-[#E6E2D3] rounded-xl text-xs font-bold text-[#2D2A26] cursor-pointer"

              >

                Aujourd'hui

              </button>

            </div>



            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

              <div>

                <label

                  htmlFor="calendar-year"

                  className="block text-[10px] font-bold uppercase tracking-wide text-[#6B6658] mb-1"

                >

                  1. Année

                </label>

                <select

                  id="calendar-year"

                  value={year}

                  onChange={(e) => handleYearChange(Number(e.target.value))}

                  className="w-full bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl px-3 py-2.5 text-xs font-bold text-[#2D2A26] outline-none focus:border-[#284C3B] cursor-pointer"

                >

                  {Array.from(

                    { length: CALENDAR_END_YEAR - CALENDAR_START_YEAR + 1 },

                    (_, index) => CALENDAR_START_YEAR + index

                  ).map((yearOption) => (

                    <option key={yearOption} value={yearOption}>

                      {yearOption}

                    </option>

                  ))}

                </select>

              </div>



              <div>

                <label

                  htmlFor="calendar-month"

                  className="block text-[10px] font-bold uppercase tracking-wide text-[#6B6658] mb-1"

                >

                  2. Mois

                </label>

                <select

                  id="calendar-month"

                  value={month}

                  onChange={(e) => handleMonthChange(Number(e.target.value))}

                  className="w-full bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl px-3 py-2.5 text-xs font-bold text-[#2D2A26] outline-none focus:border-[#284C3B] cursor-pointer"

                >

                  {MONTHS.map((monthNameOption, index) => (

                    <option key={monthNameOption} value={index}>

                      {monthNameOption}

                    </option>

                  ))}

                </select>

              </div>



              <div>

                <label

                  htmlFor="calendar-day"

                  className="block text-[10px] font-bold uppercase tracking-wide text-[#6B6658] mb-1"

                >

                  3. Jour

                </label>

                <select

                  id="calendar-day"

                  value={Math.min(selectedDay, daysInMonth)}

                  onChange={(e) => handleDayChange(Number(e.target.value))}

                  className="w-full bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl px-3 py-2.5 text-xs font-bold text-[#2D2A26] outline-none focus:border-[#284C3B] cursor-pointer"

                >

                  {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((dayOption) => (

                    <option key={dayOption} value={dayOption}>

                      {dayOption}

                    </option>

                  ))}

                </select>

              </div>

            </div>



            <div className="flex items-center gap-2 text-[11px] text-[#6B6658]">

              <CalendarIcon size={13} className="text-[#284C3B]" />

              <span className="font-bold text-[#2D2A26]">

                {monthName}

              </span>

              <span>•</span>

              <span>{daysInMonth} jours dans ce mois</span>

            </div>

          </div>



          {/* Weekday headers */}

          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-[#6B6658] pb-1">

            <span>Lun</span>

            <span>Mar</span>

            <span>Mer</span>

            <span>Jeu</span>

            <span>Ven</span>

            <span>Sam</span>

            <span>Dim</span>

          </div>



          {/* Days Grid */}

          {isLoading ? (

            <div className="h-64 flex flex-col items-center justify-center text-xs text-[#6B6658] gap-2">

              <Loader2 size={24} className="animate-spin text-[#284C3B]" />

              <span>Chargement du calendrier...</span>

            </div>

          ) : (

            <div className="grid grid-cols-7 gap-1.5">

              {calendarCells.map((cell) => {

                const avail = availMap.get(cell.dateStr);

                const roomsAvail = avail !== undefined ? avail.rooms_available : null;

                const priceOverride = avail?.price_override;
                const allUnitsSpecial = Boolean(
                  avail?.active_units
                  && avail.active_units > 0
                  && avail.special_units === avail.active_units
                );
                const sameUnitRate = allUnitsSpecial
                  && avail?.special_unit_min_price === avail.special_unit_max_price;
                const hasSpecialPrice = priceOverride !== null && priceOverride !== undefined || allUnitsSpecial;
                const effectivePrice = priceOverride !== null && priceOverride !== undefined
                  ? priceOverride
                  : sameUnitRate && avail?.special_unit_min_price !== null && avail?.special_unit_min_price !== undefined
                    ? avail.special_unit_min_price
                    : activeRoom.price_per_night;

                const isBlocked = Boolean(avail?.sales_closed);
                // Sans exception enregistrée, la RPC calcule la disponibilité
                // depuis la capacité physique et les réservations confirmées.
                const remaining = avail?.remaining_rooms ?? activeRoom.total_rooms;
                const booked = avail?.booked_rooms ?? 0;
                const isFull = !isBlocked && remaining === 0;
                const isPartial = !isBlocked && booked > 0 && remaining > 0;

                // Range selection styling

                const isStart = rangeStart === cell.dateStr;

                const isEnd = rangeEnd === cell.dateStr;

                const isInRange = rangeStart && rangeEnd && cell.dateStr >= rangeStart && cell.dateStr <= rangeEnd;

                const isSingleSelected = rangeStart === cell.dateStr && !rangeEnd;



                let cellBg = 'bg-[#FAF9F6] border-[#E6E2D3] text-[#2D2A26]';

                if (!cell.isCurrentMonth) {

                  cellBg = 'bg-gray-50/60 border-transparent text-[#8C887D] opacity-40';

                } else if (cell.isPast) {

                  cellBg = 'bg-gray-50 border-gray-200 text-gray-400 opacity-60';

                } else if (isBlocked) {

                  cellBg = 'bg-rose-50/80 border-rose-200 text-rose-900';

                } else if (isFull) {
                  cellBg = 'bg-orange-50 border-orange-200 text-orange-900';

                } else if (isPartial || isFull) {
                  cellBg = 'bg-sky-50/80 border-sky-200 text-sky-900';
                } else if (hasSpecialPrice) {

                  cellBg = 'bg-amber-50/90 border-amber-200 text-amber-900';

                }



                if (isStart || isEnd || isSingleSelected) {

                  cellBg = 'bg-[#284C3B] border-[#284C3B] text-white ring-2 ring-[#284C3B]/30 z-10 shadow-xs';

                } else if (isInRange) {

                  cellBg = 'bg-[#EFF3ED] border-[#DCE7DD] text-[#2D2A26]';

                }



                return (

                  <button

                    key={cell.dateStr}

                    type="button"

                    disabled={cell.isPast && !cell.isCurrentMonth}
                    title={isBlocked && avail?.closure_reason ? `Fermeture : ${avail.closure_reason}` : hasSpecialPrice && avail?.reason ? `Tarif spécial : ${avail.reason}` : hasSpecialPrice && allUnitsSpecial && (priceOverride === null || priceOverride === undefined) ? 'Tarif spécial sur toutes les unités' : ''}

                    onClick={() => handleDateClick(cell.dateStr)}

                    className={`min-h-[74px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all relative cursor-pointer select-none ${cellBg}`}

                  >

                    {/* Top Row: Day number & status icon */}

                    <div className="flex items-center justify-between w-full">

                      <span className={`text-xs font-bold ${isStart || isEnd || isSingleSelected ? 'text-white' : ''}`}>

                        {cell.dayNum}

                      </span>



                      {isBlocked ? (

                        <Lock size={10} className={isStart || isEnd ? 'text-white' : 'text-rose-600'} />

                      ) : hasSpecialPrice ? (

                        <Sparkles size={10} className={isStart || isEnd ? 'text-amber-200' : 'text-amber-600'} />

                      ) : null}

                    </div>



                    {/* Middle: Rooms availability tag */}

                    <div className="my-0.5">

                      <span className={`text-[10px] font-bold px-1 py-0.2 rounded block leading-tight truncate ${

                        isStart || isEnd || isSingleSelected

                          ? 'bg-white/20 text-white'

                          : isBlocked

                            ? 'text-rose-700 font-extrabold'

                            : 'text-[#284C3B]'

                      }`}>

                        {cell.isPast ? 'Historique' : isBlocked ? 'Ventes fermées' : isFull ? 'Complet' : isPartial ? `${booked} rés. · ${remaining} libre(s)` : `${remaining} disponible(s)`}

                      </span>

                    </div>



                    {/* Bottom: Price in FCFA */}

                    <div className="text-right">

                      <span className={`text-[10px] font-semibold block leading-none ${

                        isStart || isEnd || isSingleSelected

                          ? 'text-[#EFF3ED]'

                          : hasSpecialPrice

                            ? 'text-[#8B5E34] font-bold'

                            : 'text-[#6B6658]'

                      }`}>

                        {allUnitsSpecial && !sameUnitRate && (priceOverride === null || priceOverride === undefined)
                          ? 'Prix spécial'
                          : formatFCFA(effectivePrice)}
                      </span>
                      {hasSpecialPrice && (priceOverride !== null && priceOverride !== undefined || sameUnitRate) && effectivePrice < activeRoom.price_per_night && (
                        <span className="block text-[9px] text-[#8C887D] line-through">{formatFCFA(activeRoom.price_per_night)}</span>
                      )}
                      {hasSpecialPrice && (priceOverride !== null && priceOverride !== undefined || sameUnitRate) && effectivePrice < activeRoom.price_per_night && (
                        <span className="block text-[9px] text-[#8C887D]">−{Math.round((activeRoom.price_per_night - effectivePrice) * 100 / activeRoom.price_per_night)}%</span>
                      )}

                    </div>

                  </button>

                );

              })}

            </div>

          )}



          {/* Legend */}

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#6B6658] pt-4 border-t border-[#E6E2D3]">

            <div className="flex items-center gap-1.5">

              <div className="w-3 h-3 rounded bg-[#FAF9F6] border border-[#E6E2D3]" />

              <span>Disponibilité enregistrée (tarif normal)</span>

            </div>

            <div className="flex items-center gap-1.5">

              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />

              <span>Tarif spécial (Haute saison)</span>

            </div>

            <div className="flex items-center gap-1.5">

              <div className="w-3 h-3 rounded bg-rose-100 border border-rose-300" />

              <span>Fermeture volontaire des ventes</span>

            </div>

            <div className="flex items-center gap-1.5">

              <div className="w-3 h-3 rounded bg-[#284C3B]" />

              <span>Sélection active</span>

            </div>

          </div>



        </div>



        {/* RIGHT: Selected Range Action Panel */}

        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-[#E6E2D3] shadow-xs space-y-5">



          <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D3]">

            <h4 className="font-serif font-bold text-sm text-[#2D2A26]">

              Ajuster la période

            </h4>

            {rangeStart && (

              <button

                type="button"

                onClick={handleClearSelection}

                className="text-[11px] text-[#8C887D] hover:text-[#2D2A26] font-bold cursor-pointer"

              >

                Annuler

              </button>

            )}

          </div>



          {!rangeStart ? (

            <div className="p-6 bg-[#FAF9F6] rounded-2xl border border-dashed border-[#E6E2D3] text-center space-y-2">

              <CalendarIcon size={28} className="mx-auto text-[#8C887D]" />

              <p className="text-xs font-bold text-[#2D2A26]">Sélectionnez une date ou une plage</p>

              <p className="text-[11px] text-[#6B6658]">

                Cliquez sur une première date, puis sur une seconde pour sélectionner une période à modifier en masse.

              </p>

            </div>

          ) : (

            <div className="space-y-4">



              {/* Selected Dates Display */}

              <div className="p-3 bg-[#EFF3ED] border border-[#DCE7DD] rounded-2xl text-xs space-y-1">

                <span className="text-[10px] font-bold uppercase text-[#284C3B] block">Période sélectionnée</span>

                <p className="font-bold text-[#2D2A26]">

                  {rangeEnd && rangeEnd !== rangeStart ? (

                    <>Du {formatDate(rangeStart)} au {formatDate(rangeEnd)}</>

                  ) : (

                    <>Le {formatDate(rangeStart)}</>

                  )}

                </p>

              </div>



              {/* Category totals and individually managed physical rooms. */}
              {selectedCalendarDay && (
                <div className="space-y-3 rounded-2xl border border-[#E6E2D3] bg-[#FAF9F6] p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#2D2A26]">Disponibilité de la catégorie</span>
                    <span className="text-[10px] text-[#6B6658]">{activeRoom.total_rooms} chambre(s) au total</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><strong className="block text-lg">{selectedRemaining}</strong>Disponible(s)</div>
                    <div className="rounded-xl bg-sky-50 p-2 text-sky-800"><strong className="block text-lg">{selectedBooked}</strong>Réservée(s)</div>
                    <div className="rounded-xl bg-rose-50 p-2 text-rose-800"><strong className="block text-lg">{selectedBlocked}</strong>Bloquée(s) / hors vente</div>
                  </div>
                  <p className="text-[10px] text-[#6B6658]">{selectedClosed ? 'Ventes de toute la catégorie fermées : les réservations existantes sont conservées.' : selectedRemaining === 0 ? 'Aucune nouvelle réservation possible pour cette date.' : 'Les chambres libres peuvent être réservées.'}</p>
                  {selectedClosed && selectedCalendarDay.closure_reason && (
                    <p className="text-[10px] text-[#6B6658]">Motif de fermeture : {selectedCalendarDay.closure_reason}</p>
                  )}
                  {selectedCalendarDay.price_override !== null && (
                    <p className="text-[10px] text-[#6B6658]">
                      Tarif spécial de la catégorie : {selectedCalendarDay.price_override < activeRoom.price_per_night && (
                        <><s>{formatFCFA(activeRoom.price_per_night)}</s> · </>
                      )}
                      {formatFCFA(selectedCalendarDay.price_override)} / nuit
                      {selectedCalendarDay.price_override < activeRoom.price_per_night
                        ? ` · −${Math.round((activeRoom.price_per_night - selectedCalendarDay.price_override) * 100 / activeRoom.price_per_night)}%`
                        : ''}
                      {selectedCalendarDay.reason ? ` · ${selectedCalendarDay.reason}` : ''}
                    </p>
                  )}
                  {!selectedCalendarDay.configured && <p className="text-[10px] text-[#6B6658]">Capacité par défaut : aucun ajustement de capacité de la catégorie pour cette date.</p>}
                  <div className="space-y-2 border-t border-[#E6E2D3] pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-[#2D2A26]">Chambres physiques</strong>
                      <span className="text-[10px] text-[#6B6658]">État au {formatDate(rangeStart)}</span>
                      <label className="flex items-center gap-2 text-[10px] font-semibold text-[#6B6658]">
                        Périmètre
                        <select
                          value={calendarScope}
                          onChange={(event) => setCalendarScope(event.target.value as 'category' | 'units')}
                          className="rounded-lg border border-[#D8DED3] bg-white px-2 py-1.5 text-xs text-[#2D2A26]"
                        >
                          <option value="category">Toute la catégorie</option>
                          <option value="units">Unités sélectionnées</option>
                        </select>
                      </label>
                    </div>
                    <label className="block space-y-1 text-[10px] font-semibold text-[#6B6658]">
                      Motif facultatif
                      <input
                        value={physicalBlockReason}
                        maxLength={300}
                        onChange={(event) => setPhysicalBlockReason(event.target.value)}
                        placeholder="Ex. maintenance, événement, réduction…"
                        className="w-full rounded-lg border border-[#D8DED3] bg-white px-2 py-2 text-xs text-[#2D2A26]"
                      />
                    </label>
                    {physicalUnitsLoading && <p className="flex items-center gap-2 text-[#6B6658]"><Loader2 size={14} className="animate-spin"/>Chargement des chambres…</p>}
                    {physicalUnitsError && <p role="alert" className="text-rose-700">{physicalUnitsError}</p>}
                    {physicalUnitActionError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-rose-700">{physicalUnitActionError}</p>}
                    {!physicalUnitsLoading && !physicalUnitsError && physicalUnits.length === 0 && <p className="text-[#6B6658]">Aucune chambre individuelle n’est configurée pour cette catégorie.</p>}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {physicalUnits.map((unit) => {
                        const occupant = physicalOccupancy.find((entry) =>
                          entry.room_unit_id === unit.id
                          && ['pending', 'confirmed', 'completed'].includes(entry.status)
                          && entry.check_in <= rangeStart
                          && entry.check_out > rangeStart
                        );
                        const blocked = closedPhysicalUnits.has(unit.id);
                        const categoryClosed = Boolean(selectedCalendarDay?.sales_closed);
                        const unitUnavailable = blocked || categoryClosed;
                        const unitRate = physicalUnitRates.get(unit.id);
                        const categoryRate = selectedCalendarDay?.price_override;
                        const effectiveUnitRate = unitRate?.price ?? categoryRate ?? activeRoom.price_per_night;
                        const hasUnitSpecialRate = unitRate !== undefined || categoryRate !== null && categoryRate !== undefined;
                        const unitSavings = effectiveUnitRate < activeRoom.price_per_night
                          ? Math.round((activeRoom.price_per_night - effectiveUnitRate) * 100 / activeRoom.price_per_night)
                          : 0;
                        const unitSelected = selectedPhysicalUnitIds.includes(unit.id);
                        const label = unit.unit_name || unit.unit_code || 'Chambre';
                        const targets = occupant
                          ? physicalUnits.filter((target) =>
                            target.id !== unit.id
                            && !physicalOccupancy.some((entry) =>
                              entry.room_unit_id === target.id
                              && ['pending', 'confirmed', 'completed'].includes(entry.status)
                              && entry.check_in < occupant.check_out
                              && occupant.check_in < entry.check_out
                            )
                          )
                          : [];
                        return (
                          <article key={unit.id} className={`space-y-2 rounded-xl border p-3 ${occupant ? 'border-sky-200 bg-sky-50' : unitUnavailable ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                            <label className="flex items-center gap-2 text-[10px] font-semibold text-[#284C3B]">
                              <input
                                type="checkbox"
                                checked={unitSelected}
                                onChange={(event) => setSelectedPhysicalUnitIds((previous) => event.target.checked
                                  ? [...previous, unit.id]
                                  : previous.filter((id) => id !== unit.id))}
                              />
                              Inclure dans les actions de la période
                            </label>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="space-y-1">
                                <span className="block text-[10px] font-semibold text-[#6B6658]">Numéro / code</span>
                                <input
                                  aria-label={`Numéro de chambre ${unit.unit_code || ''}`}
                                  value={physicalUnitLabels[unit.id]?.code ?? unit.unit_code ?? ''}
                                  onChange={(event) => setPhysicalUnitLabels((previous) => ({
                                    ...previous,
                                    [unit.id]: { code: event.target.value, name: previous[unit.id]?.name ?? unit.unit_name ?? '' },
                                  }))}
                                  className="w-full rounded-lg border border-[#D8DED3] bg-white px-2 py-2 text-xs"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[10px] font-semibold text-[#6B6658]">Nom (facultatif)</span>
                                <input
                                  aria-label={`Nom de chambre ${unit.unit_code || ''}`}
                                  value={physicalUnitLabels[unit.id]?.name ?? unit.unit_name ?? ''}
                                  onChange={(event) => setPhysicalUnitLabels((previous) => ({
                                    ...previous,
                                    [unit.id]: { code: previous[unit.id]?.code ?? unit.unit_code ?? '', name: event.target.value },
                                  }))}
                                  className="w-full rounded-lg border border-[#D8DED3] bg-white px-2 py-2 text-xs"
                                />
                              </label>
                            </div>
                            {(physicalUnitLabels[unit.id]?.code !== (unit.unit_code || '')
                              || physicalUnitLabels[unit.id]?.name !== (unit.unit_name || '')) && (
                              <button
                                type="button"
                                disabled={physicalUnitActionId !== null}
                                onClick={() => void handleSavePhysicalRoomLabel(unit)}
                                className="rounded-lg border border-[#D8DED3] bg-white px-3 py-2 text-[10px] font-bold text-[#284C3B] disabled:opacity-50"
                              >
                                {physicalUnitActionId === unit.id ? 'Enregistrement…' : 'Enregistrer le numéro / nom'}
                              </button>
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <strong className="block text-[#2D2A26]">{label}</strong>
                                <span className="text-[10px] text-[#6B6658]">
                                  {occupant
                                    ? `Réservée · ${occupant.guest_name} · ${occupant.booking_number}${categoryClosed ? ' · ventes de la catégorie fermées' : blocked ? ` · ventes de l’unité fermées${closedPhysicalUnits.get(unit.id) ? ` · ${closedPhysicalUnits.get(unit.id)}` : ''}` : ''}`
                                    : categoryClosed
                                      ? `Ventes fermées pour toute la catégorie${selectedCalendarDay?.closure_reason ? ` · ${selectedCalendarDay.closure_reason}` : ''}`
                                      : blocked
                                        ? `Bloquée${closedPhysicalUnits.get(unit.id) ? ` · ${closedPhysicalUnits.get(unit.id)}` : ''}`
                                        : 'Disponible'}
                                </span>
                                <span className="block text-[10px] text-[#6B6658]">
                                  {hasUnitSpecialRate ? (
                                    <>{unitRate ? 'Tarif spécial unité' : 'Tarif spécial catégorie'} · {unitSavings > 0 && <><s>{formatFCFA(activeRoom.price_per_night)}</s> · </>}{formatFCFA(effectiveUnitRate)} / nuit{unitSavings > 0 ? ` · −${unitSavings}%` : ''}</>
                                  ) : <>Tarif de base · {formatFCFA(effectiveUnitRate)} / nuit</>}
                                  {unitRate?.reason ? ` · ${unitRate.reason}` : !unitRate && categoryRate !== null && categoryRate !== undefined && selectedCalendarDay?.reason ? ` · ${selectedCalendarDay.reason}` : ''}
                                </span>
                              </div>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${occupant ? 'bg-sky-100 text-sky-800' : unitUnavailable ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{occupant ? 'Réservée' : categoryClosed ? 'Catégorie fermée' : blocked ? 'Bloquée' : 'Disponible'}</span>
                            </div>
                            {occupant && occupant.status !== 'completed' && (
                              <div className="flex gap-2">
                                <select
                                  aria-label={`Nouvelle chambre pour la réservation ${occupant.booking_number}`}
                                  value={reassignmentTargets[occupant.booking_id] || ''}
                                  onChange={(event) => setReassignmentTargets((previous) => ({ ...previous, [occupant.booking_id]: event.target.value }))}
                                  className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-2 py-2 text-[10px]"
                                >
                                  <option value="">Déplacer vers…</option>
                                  {targets.map((target) => <option key={target.id} value={target.id}>{target.unit_name || target.unit_code}</option>)}
                                </select>
                                <button
                                  type="button"
                                  disabled={!reassignmentTargets[occupant.booking_id] || physicalUnitActionId !== null}
                                  onClick={() => void handleReassignPhysicalRoom(occupant.booking_id, unit.id)}
                                  className="rounded-lg bg-sky-800 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-50"
                                >
                                  {physicalUnitActionId === occupant.booking_id ? '…' : 'Déplacer'}
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    {calendarScope === 'units' && (
                      <div className="space-y-2 rounded-xl border border-[#D8DED3] bg-white p-3">
                        <p className="text-[10px] text-[#6B6658]">
                          {selectedPhysicalUnitIds.length
                            ? `${selectedPhysicalUnitIds.length} unité(s) sélectionnée(s) — les dates de début et de fin sont incluses.`
                            : 'Sélectionnez une ou plusieurs unités actives.'}
                        </p>
                        {selectedPhysicalUnitIds.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={isSaving || rangeStart < todayStr || selectedPhysicalUnitIds.every((id) => closedPhysicalUnits.has(id))}
                              onClick={() => void handleSetSelectedUnitsStatus(true)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-800 disabled:opacity-50"
                            >
                              Fermer les ventes des unités sélectionnées
                            </button>
                            {selectedPhysicalUnitIds.some((id) => physicalRangeClosedUnitIds.has(id)) && <button
                              type="button"
                              disabled={isSaving || rangeStart < todayStr}
                              onClick={() => void handleSetSelectedUnitsStatus(false)}
                              className="rounded-lg border border-[#DCE7DD] bg-[#EFF3ED] px-3 py-2 text-[10px] font-bold text-[#284C3B] disabled:opacity-50"
                            >
                              Rouvrir les unités fermées sélectionnées
                            </button>}
                          </div>
                        )}
                        {selectedPhysicalUnitIds.length > 0 && selectedPhysicalUnitIds.some((id) => physicalRangeRateUnitIds.has(id)) && (
                          <button
                            type="button"
                            disabled={isSaving || rangeStart < todayStr}
                            onClick={() => void runCalendarAction('remove_price', selectedPhysicalUnitIds)}
                            className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-900 disabled:opacity-50"
                          >
                            Retirer le tarif spécial des unités sélectionnées pour la période
                          </button>
                        )}
                        {selectedPhysicalUnitIds.length > 0 && (
                          <div className="flex gap-2">
                            <input
                              type="number"

                              min={0}
                              step={1}
                              value={editPriceOverride}
                              onChange={(event) => setEditPriceOverride(event.target.value)}
                              placeholder="Prix spécial par nuit (FCFA)"
                              className="min-w-0 flex-1 rounded-lg border border-[#D8DED3] px-3 py-2 text-xs"
                            />
                            <button
                              type="button"
                              disabled={isSaving || rangeStart < todayStr || editPriceOverride.trim() === '' || !Number.isSafeInteger(Number(editPriceOverride)) || Number(editPriceOverride) < 0}
                              onClick={() => void runCalendarAction('set_price', selectedPhysicalUnitIds, Number(editPriceOverride))}
                              className="rounded-lg bg-[#284C3B] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50"
                            >
                              Appliquer le tarif
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBookingsModal(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-3 py-3 font-bold text-white hover:bg-[#1B382D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#284C3B]"
                  >
                    <CalendarCheck size={15} />
                    Voir les réservations ({selectedBooked} unité{selectedBooked > 1 ? 's' : ''})
                  </button>
                </div>
              )}

              {/* Quick Actions */}

              {calendarScope === 'category' && (() => {
                const selected = availabilityList.filter(day => day.date >= rangeStart && day.date <= (rangeEnd || rangeStart));
                const anyClosed = selected.some(day => day.sales_closed);
                const anyOpen = selected.some(day => !day.sales_closed);
                const hasPast = rangeStart < todayStr;
                return <div className="grid grid-cols-1 gap-2">
                {!hasPast && anyOpen && <button

                  type="button"

                  onClick={handleApplyBlock}

                  disabled={isSaving}

                  className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-xs"

                >

                  <Lock size={14} />

                  <span>Fermer les ventes</span>

                </button>}

                {anyClosed && !hasPast && <button

                  type="button"

                  onClick={handleApplyRestoreCapacity}

                  disabled={isSaving}

                  className="p-2.5 bg-[#EFF3ED] hover:bg-[#DFEACF] text-[#284C3B] border border-[#DCE7DD] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-xs"

                >

                  <Unlock size={14} />

                  <span>Rouvrir les ventes</span>

                </button>}
                {hasPast && <p className="text-xs text-slate-600">Les dates passées sont consultables uniquement.</p>}
              </div>;
              })()}



              {/* Custom Edit Form */}

              {calendarScope === 'category' && rangeStart >= todayStr && <form onSubmit={handleSaveCustomChanges} className="space-y-3 pt-3 border-t border-[#E6E2D3] text-xs">



                <p className="text-[11px] text-[#6B6658]">Cochez uniquement les éléments à modifier. Les autres resteront inchangés.</p>
                <label className="flex items-center gap-2 font-bold text-[#2D2A26] cursor-pointer">
                  <input type="checkbox" checked={changeCapacity} onChange={e => setChangeCapacity(e.target.checked)} />
                  Modifier la capacité mise en vente
                </label>
                {/* Rooms Available */}

                {changeCapacity && <div>

                  <label className="block font-bold text-[#2D2A26] mb-1">

                    Capacité mise en vente (réservations incluses)

                  </label>

                  <input

                    type="number"

                    min={0}

                    max={activeRoom.total_rooms}

                    value={editRoomsCount}

                    onChange={(e) => setEditRoomsCount(Number(e.target.value))}

                    className="w-full p-2.5 bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl font-bold text-[#2D2A26] outline-none focus:border-[#284C3B]"

                  />

                  <span className="text-[10px] text-[#6B6658] mt-0.5 block">

                    Capacité physique : {activeRoom.total_rooms}. Les réservations confirmées sont déduites séparément.

                  </span>

                </div>}

                <label className="flex items-center gap-2 font-bold text-[#2D2A26] cursor-pointer">
                  <input type="checkbox" checked={changePrice} onChange={e => setChangePrice(e.target.checked)} />
                  {availabilityList.some(day => day.date >= rangeStart && day.date <= (rangeEnd || rangeStart) && day.price_override !== null)
                    ? 'Modifier ou retirer le tarif spécial'
                    : 'Appliquer un tarif spécial'}
                </label>
                {/* Price Override */}

                {changePrice && <div>

                  <label className="block font-bold text-[#2D2A26] mb-1 flex items-center justify-between">

                    <span>Prix spécial par nuit (FCFA)</span>

                    <span className="text-[10px] font-normal text-[#8C887D]">Optionnel</span>

                  </label>

                  <input

                    type="number"

                    min={0}

                    step={1}

                    value={editPriceOverride}

                    onChange={(e) => setEditPriceOverride(e.target.value)}

                    placeholder={`Prix de base : ${formatFCFA(activeRoom.price_per_night)}`}

                    className="w-full p-2.5 bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl font-bold text-[#8B5E34] outline-none focus:border-[#284C3B]"

                  />



                  {/* Quick percentage buttons */}

                  <div className="flex gap-1.5 mt-1.5">

                    <button

                      type="button"

                      onClick={() => setEditPriceOverride(String(Math.round(activeRoom.price_per_night * 1.15)))}

                      className="px-2 py-1 bg-[#FAF9F6] hover:bg-[#F0EDE4] border border-[#E6E2D3] rounded-lg text-[10px] font-bold text-[#2D2A26]"

                    >

                      +15%

                    </button>

                    <button

                      type="button"

                      onClick={() => setEditPriceOverride(String(Math.round(activeRoom.price_per_night * 1.30)))}

                      className="px-2 py-1 bg-[#FAF9F6] hover:bg-[#F0EDE4] border border-[#E6E2D3] rounded-lg text-[10px] font-bold text-[#2D2A26]"

                    >

                      +30% (Fêtes)

                    </button>

                    <button

                      type="button"

                      onClick={() => setEditPriceOverride('')}

                      className="px-2 py-1 bg-[#FAF9F6] hover:bg-[#F0EDE4] border border-[#E6E2D3] rounded-lg text-[10px] font-bold text-[#8C887D]"

                    >

                      Prix base

                    </button>

                  </div>

                </div>}

                <p className="text-[10px] text-[#6B6658]">
                  {availabilityList.some(day => day.date >= rangeStart && day.date <= (rangeEnd || rangeStart) && day.price_override !== null)
                    ? 'Un prix vide retire les tarifs spéciaux existants et rétablit le tarif normal.'
                    : 'Le tarif normal reste applicable tant qu’aucun prix spécial n’est saisi.'}
                </p>
                {/* Save Button */}

                <button

                  type="submit"

                  disabled={isSaving || (!changeCapacity && !changePrice)}

                  className="w-full py-3 bg-[#284C3B] hover:bg-[#1B382D] text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"

                >

                  {isSaving ? (

                    <>

                      <Loader2 size={16} className="animate-spin" />

                      <span>Enregistrement...</span>

                    </>

                  ) : (

                    <>

                      <CheckCircle2 size={16} />

                      <span>Enregistrer les modifications</span>

                    </>

                  )}

                </button>



              </form>}



            </div>

          )}



        </div>



      </div>



      {showBookingsModal && rangeStart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowBookingsModal(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="booking-night-title" className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#E6E2D3] bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="booking-night-title" className="font-serif text-lg font-bold text-[#2D2A26]">Réservations de cette nuit</h3>
                <p className="text-xs text-[#6B6658] mt-1">{formatDate(rangeStart)} · {activeRoom.name} · {selectedBooked} unité(s) réservée(s)</p>
              </div>
              <button type="button" aria-label="Fermer les détails" onClick={() => setShowBookingsModal(false)} className="rounded-xl border border-[#E6E2D3] p-2 hover:bg-[#FAF9F6]"><X size={18}/></button>
            </div>
            {dayBookingsLoading && <p className="text-sm text-[#6B6658] flex items-center gap-2"><Loader2 size={16} className="animate-spin"/> Chargement des réservations…</p>}
            {dayBookingsError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Impossible de charger les détails : {dayBookingsError}</p>}
            {!dayBookingsLoading && !dayBookingsError && dayBookings.length === 0 && (
              <p className="rounded-xl bg-[#FAF9F6] p-4 text-sm text-[#6B6658]">{selectedBooked > 0 ? 'Le calendrier comptabilise des chambres réservées, mais aucune fiche n’est accessible avec les droits de lecture actuels. Vérifiez les autorisations Supabase (RLS).' : 'Aucune réservation confirmée pour cette nuit.'}</p>
            )}
            {!dayBookingsLoading && dayBookings.map(booking => (
              <div key={booking.id} className="overflow-hidden rounded-xl border border-[#E6E2D3] text-sm">
                <button type="button" onClick={() => setExpandedBookingId(current => current === booking.id ? null : booking.id)} aria-expanded={expandedBookingId === booking.id} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[#FAF9F6]">
                  <span className="min-w-0"><span className="block font-bold text-[#2D2A26] truncate">{booking.guest_name}</span><span className="block text-xs text-[#6B6658]">{booking.rooms_count} unité(s) · {booking.booking_source === 'manual' ? 'Manuelle' : booking.booking_source === 'marketplace' ? 'TerangaSN' : booking.booking_source} · {formatFCFA(booking.total_price)}</span></span>
                  <ChevronDown size={17} className={`shrink-0 transition-transform ${expandedBookingId === booking.id ? 'rotate-180' : ''}`}/>
                </button>
                {expandedBookingId === booking.id && (
                  <div className="space-y-2 border-t border-[#E6E2D3] bg-[#FAF9F6] p-4 text-xs text-[#2D2A26]">
                    <p><strong>Référence :</strong> {booking.booking_number}</p>
                    <p><strong>Téléphone :</strong> {booking.guest_phone || 'Non renseigné'}</p>
                    <p><strong>Dates :</strong> {formatDate(booking.check_in)} → {formatDate(booking.check_out)} (départ non inclus)</p>
                    <p><strong>Durée :</strong> {booking.nights_count} nuit(s), {booking.rooms_count} unité(s)</p>
                    <p><strong>Montant total convenu :</strong> {formatFCFA(booking.total_price)}</p>
                    <p><strong>Commission TerangaSN :</strong> {formatFCFA(booking.commission_amount)}</p>
                    <p><strong>Paiement :</strong> {booking.payment_status === 'on_site_paid' ? 'Payé' : 'Non payé / à vérifier'}</p>
                    <p className="text-[#6B6658]">Le montant correspond au séjour complet. L’historique des prix par nuit nécessitera un enregistrement dédié.</p>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

    </div>

  );

};
