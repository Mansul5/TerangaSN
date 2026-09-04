import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  CheckCircle2, 
  Tag, 
  Lock, 
  Unlock, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Layers, 
  Info,
  CalendarCheck,
  TrendingUp,
  X
} from 'lucide-react';
import { RoomType, RoomAvailability } from '@/src/types';
import { 
  fetchRoomAvailability, 
  updateSingleDateAvailability, 
  updateDateRangeAvailability, 
  populateRoomAvailability 
} from '@/src/lib/supabase/api';
import { formatFCFA, formatDate } from '@/src/lib/formatters';

interface RoomAvailabilityCalendarProps {
  rooms: RoomType[];
  selectedRoomId?: string;
  onRoomSelect?: (roomId: string) => void;
}

export const RoomAvailabilityCalendar: React.FC<RoomAvailabilityCalendarProps> = ({
  rooms,
  selectedRoomId: initialRoomId,
  onRoomSelect,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialRoomId || (rooms.length > 0 ? rooms[0].id : '')
  );

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0] || null;

  // Calendar View State: Current month/year
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [availabilityList, setAvailabilityList] = useState<RoomAvailability[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected Date / Range Selection
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  // Edit Form state for selected range
  const [editRoomsCount, setEditRoomsCount] = useState<number>(activeRoom?.total_rooms || 1);
  const [editPriceOverride, setEditPriceOverride] = useState<string>('');
  const [actionType, setActionType] = useState<'adjust' | 'block' | 'price'>('adjust');

  // Sync active room changes
  useEffect(() => {
    if (activeRoom) {
      setEditRoomsCount(activeRoom.total_rooms);
    }
  }, [activeRoom]);

  // Load availability when month or active room changes
  useEffect(() => {
    if (!activeRoom) return;

    async function loadMonthAvailability() {
      setIsLoading(true);
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Start from first day of month - 7 days to cover calendar padding
        const start = new Date(year, month, 1);
        start.setDate(start.getDate() - 7);
        const startDateStr = start.toISOString().split('T')[0];

        // End on last day of month + 14 days
        const end = new Date(year, month + 1, 0);
        end.setDate(end.getDate() + 14);
        const endDateStr = end.toISOString().split('T')[0];

        const { data, error } = await fetchRoomAvailability(activeRoom.id, startDateStr, endDateStr);
        if (error) throw error;
        setAvailabilityList(data || []);
      } catch (err: any) {
        console.error('Failed to load availability:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMonthAvailability();
  }, [activeRoom?.id, currentDate]);

  // Quick navigation
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleTodayMonth = () => {
    const d = new Date();
    d.setDate(1);
    setCurrentDate(d);
  };

  // Seed / Initialize 365 Days
  const handleSeed365Days = async () => {
    if (!activeRoom) return;
    if (!window.confirm(`Voulez-vous générer la disponibilité sur 365 jours pour "${activeRoom.name}" (${activeRoom.total_rooms} chambres/jour) ?`)) {
      return;
    }

    setIsSeeding(true);
    setFeedbackMsg(null);
    try {
      const res = await populateRoomAvailability(activeRoom.id, activeRoom.total_rooms, 365);
      if (res.error) throw res.error;
      
      setFeedbackMsg({
        type: 'success',
        text: `365 jours de disponibilité initialisés avec succès pour ${activeRoom.name}.`,
      });

      // Reload
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1).toISOString().split('T')[0];
      const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const { data } = await fetchRoomAvailability(activeRoom.id, start, end);
      setAvailabilityList(data || []);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Erreur lors de la génération de disponibilité.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  // Date selection click handler
  const handleDateClick = (dateStr: string) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      // Start new selection
      setRangeStart(dateStr);
      setRangeEnd(null);

      // Pre-fill current values for this single date
      const existing = availabilityList.find(a => a.date === dateStr);
      if (existing) {
        setEditRoomsCount(existing.rooms_available);
        setEditPriceOverride(existing.price_override ? String(existing.price_override) : '');
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

  // Apply quick action: Block dates (rooms_available = 0)
  const handleApplyBlock = async () => {
    if (!activeRoom || !rangeStart) return;
    const start = rangeStart;
    const end = rangeEnd || rangeStart;

    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      if (start === end) {
        await updateSingleDateAvailability(activeRoom.id, start, 0, null);
      } else {
        await updateDateRangeAvailability(activeRoom.id, start, end, { roomsAvailable: 0 });
      }

      setFeedbackMsg({
        type: 'success',
        text: `Dates bloquées (${formatDate(start)} ${end !== start ? 'au ' + formatDate(end) : ''}) avec succès.`,
      });

      // Update local state
      setAvailabilityList(prev => {
        const next = [...prev];
        const s = new Date(start);
        const e = new Date(end);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          const idx = next.findIndex(x => x.date === ds);
          if (idx >= 0) {
            next[idx] = { ...next[idx], rooms_available: 0 };
          } else {
            next.push({ id: `tmp-${ds}`, room_type_id: activeRoom.id, date: ds, rooms_available: 0, price_override: null });
          }
        }
        return next;
      });
      handleClearSelection();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors du blocage des dates.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Apply quick action: Restore full capacity
  const handleApplyRestoreCapacity = async () => {
    if (!activeRoom || !rangeStart) return;
    const start = rangeStart;
    const end = rangeEnd || rangeStart;
    const total = activeRoom.total_rooms || 1;

    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      if (start === end) {
        await updateSingleDateAvailability(activeRoom.id, start, total, null);
      } else {
        await updateDateRangeAvailability(activeRoom.id, start, end, { roomsAvailable: total });
      }

      setFeedbackMsg({
        type: 'success',
        text: `Capacité rétablie (${total} dispo) du ${formatDate(start)} ${end !== start ? 'au ' + formatDate(end) : ''}.`,
      });

      // Update local state
      setAvailabilityList(prev => {
        const next = [...prev];
        const s = new Date(start);
        const e = new Date(end);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          const idx = next.findIndex(x => x.date === ds);
          if (idx >= 0) {
            next[idx] = { ...next[idx], rooms_available: total };
          } else {
            next.push({ id: `tmp-${ds}`, room_type_id: activeRoom.id, date: ds, rooms_available: total, price_override: null });
          }
        }
        return next;
      });
      handleClearSelection();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur de mise à jour.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Apply custom changes (rooms available + price override)
  const handleSaveCustomChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !rangeStart) return;
    const start = rangeStart;
    const end = rangeEnd || rangeStart;
    const priceNum = editPriceOverride.trim() !== '' ? Number(editPriceOverride) : null;

    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      if (start === end) {
        await updateSingleDateAvailability(activeRoom.id, start, editRoomsCount, priceNum);
      } else {
        await updateDateRangeAvailability(activeRoom.id, start, end, {
          roomsAvailable: editRoomsCount,
          priceOverride: priceNum,
        });
      }

      setFeedbackMsg({
        type: 'success',
        text: `Disponibilité & tarifs mis à jour pour la période sélectionnée.`,
      });

      // Local state sync
      setAvailabilityList(prev => {
        const next = [...prev];
        const s = new Date(start);
        const e = new Date(end);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          const idx = next.findIndex(x => x.date === ds);
          if (idx >= 0) {
            next[idx] = { ...next[idx], rooms_available: editRoomsCount, price_override: priceNum };
          } else {
            next.push({ id: `tmp-${ds}`, room_type_id: activeRoom.id, date: ds, rooms_available: editRoomsCount, price_override: priceNum });
          }
        }
        return next;
      });

      handleClearSelection();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde.' });
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

  const todayStr = new Date().toISOString().split('T')[0];

  // Pre-padding from prev month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const d = new Date(year, month - 1, day);
    const ds = d.toISOString().split('T')[0];
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
    const ds = dateObj.toISOString().split('T')[0];
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
    const ds = dateObj.toISOString().split('T')[0];
    calendarCells.push({
      dateStr: ds,
      dayNum: d,
      isCurrentMonth: false,
      isPast: ds < todayStr,
    });
  }

  // Lookup map
  const availMap = new Map<string, RoomAvailability>();
  availabilityList.forEach(a => availMap.set(a.date, a));

  // Compute month overview stats
  const monthAvailList = availabilityList.filter(a => a.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));
  const blockedDaysCount = monthAvailList.filter(a => a.rooms_available === 0).length;
  const specialRatesCount = monthAvailList.filter(a => a.price_override !== null && a.price_override > 0).length;

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
          <span className="text-xs text-[#8B5E34] font-bold uppercase tracking-wider block">Back-office Hôtelier</span>
          <h3 className="text-lg font-serif font-bold text-[#2D2A26] flex items-center gap-2">
            <CalendarCheck size={20} className="text-[#3F6212]" />
            <span>Gestion des Disponibilités & Tarifs Saisonniers</span>
          </h3>
          <p className="text-xs text-[#6B6658] mt-0.5">
            Bloquez des dates, ajustez le nombre d'unités ou fixez des tarifs spéciaux (Magal, Tabaski, événements).
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
              className="bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl px-3 py-2 text-xs font-bold text-[#2D2A26] outline-none focus:border-[#3F6212]"
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
          <span className="p-2.5 bg-[#ECF3E5] text-[#3F6212] rounded-xl font-bold">
            {formatFCFA(activeRoom.price_per_night)} / nuit
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E6E2D3] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[#6B6658] font-medium block">Jours bloqués ce mois</span>
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
          <button
            type="button"
            onClick={handleSeed365Days}
            disabled={isSeeding}
            className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F0EDE4] border border-[#E6E2D3] rounded-xl font-bold text-[11px] text-[#2D2A26] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
            title="Initialiser automatiquement 365 jours de disponibilité"
          >
            {isSeeding ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            <span>Init 365j</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
          feedbackMsg.type === 'success' 
            ? 'bg-[#ECF3E5] border-[#D1DBC2] text-[#3F6212]' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
          <div className="flex-1 font-medium">{feedbackMsg.text}</div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* CALENDAR & ACTION PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT: Interactive Month Grid */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-[#E6E2D3] shadow-xs space-y-4">
          
          {/* Month Header Nav */}
          <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D3]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 hover:bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl text-[#2D2A26] cursor-pointer transition"
                title="Mois précédent"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 hover:bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl text-[#2D2A26] cursor-pointer transition"
                title="Mois suivant"
              >
                <ChevronRight size={16} />
              </button>
              <h4 className="font-serif font-bold text-base text-[#2D2A26] capitalize ml-2">
                {monthName}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTodayMonth}
                className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F0EDE4] border border-[#E6E2D3] rounded-xl text-xs font-bold text-[#2D2A26] cursor-pointer"
              >
                Aujourd'hui
              </button>
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
              <Loader2 size={24} className="animate-spin text-[#3F6212]" />
              <span>Chargement du calendrier...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell) => {
                const avail = availMap.get(cell.dateStr);
                const roomsAvail = avail !== undefined ? avail.rooms_available : activeRoom.total_rooms;
                const priceOverride = avail?.price_override;
                const effectivePrice = priceOverride && priceOverride > 0 ? priceOverride : activeRoom.price_per_night;
                const isBlocked = roomsAvail === 0;
                const hasSpecialPrice = Boolean(priceOverride && priceOverride > 0);

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
                } else if (hasSpecialPrice) {
                  cellBg = 'bg-amber-50/90 border-amber-200 text-amber-900';
                }

                if (isStart || isEnd || isSingleSelected) {
                  cellBg = 'bg-[#3F6212] border-[#3F6212] text-white ring-2 ring-[#3F6212]/30 z-10 shadow-xs';
                } else if (isInRange) {
                  cellBg = 'bg-[#ECF3E5] border-[#D1DBC2] text-[#2D2A26]';
                }

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    disabled={cell.isPast && !cell.isCurrentMonth}
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
                            : 'text-[#3F6212]'
                      }`}>
                        {isBlocked ? '0 dispo' : `${roomsAvail} dispo`}
                      </span>
                    </div>

                    {/* Bottom: Price in FCFA */}
                    <div className="text-right">
                      <span className={`text-[10px] font-semibold block leading-none ${
                        isStart || isEnd || isSingleSelected
                          ? 'text-[#ECF3E5]'
                          : hasSpecialPrice
                            ? 'text-[#8B5E34] font-bold'
                            : 'text-[#6B6658]'
                      }`}>
                        {Math.round(effectivePrice / 1000)}k F
                      </span>
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
              <span>Disponible (Tarif normal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
              <span>Tarif spécial (Haute saison)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-rose-100 border border-rose-300" />
              <span>Bloqué / Complet (0 dispo)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#3F6212]" />
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
              <div className="p-3 bg-[#ECF3E5] border border-[#D1DBC2] rounded-2xl text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#3F6212] block">Période sélectionnée</span>
                <p className="font-bold text-[#2D2A26]">
                  {rangeEnd && rangeEnd !== rangeStart ? (
                    <>Du {formatDate(rangeStart)} au {formatDate(rangeEnd)}</>
                  ) : (
                    <>Le {formatDate(rangeStart)}</>
                  )}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleApplyBlock}
                  disabled={isSaving}
                  className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-xs"
                >
                  <Lock size={14} />
                  <span>Bloquer (0 dispo)</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyRestoreCapacity}
                  disabled={isSaving}
                  className="p-2.5 bg-[#ECF3E5] hover:bg-[#DFEACF] text-[#3F6212] border border-[#D1DBC2] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-xs"
                >
                  <Unlock size={14} />
                  <span>Rétablir ({activeRoom.total_rooms})</span>
                </button>
              </div>

              {/* Custom Edit Form */}
              <form onSubmit={handleSaveCustomChanges} className="space-y-3 pt-3 border-t border-[#E6E2D3] text-xs">
                
                {/* Rooms Available */}
                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">
                    Nombre de chambres disponibles
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={activeRoom.total_rooms * 2}
                    value={editRoomsCount}
                    onChange={(e) => setEditRoomsCount(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl font-bold text-[#2D2A26] outline-none focus:border-[#3F6212]"
                  />
                  <span className="text-[10px] text-[#6B6658] mt-0.5 block">
                    Capacité nominale totale : {activeRoom.total_rooms}
                  </span>
                </div>

                {/* Price Override */}
                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1 flex items-center justify-between">
                    <span>Prix spécial par nuit (FCFA)</span>
                    <span className="text-[10px] font-normal text-[#8C887D]">Optionnel</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={editPriceOverride}
                    onChange={(e) => setEditPriceOverride(e.target.value)}
                    placeholder={`Prix de base : ${formatFCFA(activeRoom.price_per_night)}`}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-[#E6E2D3] rounded-xl font-bold text-[#8B5E34] outline-none focus:border-[#3F6212]"
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
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 bg-[#3F6212] hover:bg-[#365314] text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
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

              </form>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
