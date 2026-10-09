import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, MapPin, Minus, Plus, Search, Users, X } from 'lucide-react';
import { SENEGAL_REGIONS } from '@/src/types';

interface SearchBarProps {
  initialDestination?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialRooms?: number;
  onSearch: (params: { destination: string; checkIn: string; checkOut: string; adults: number; children: number; rooms: number }) => void;
  variant?: 'hero' | 'compact';
}

type Panel = 'destination' | 'calendar' | 'guests' | null;
type DateStep = 'checkIn' | 'checkOut';
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const dateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDate = (s: string) => {
  const [year, month, day] = s.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (s: string, days: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return dateString(d);
};
const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime()) && dateString(parseDate(s)) === s;
const shortDate = (s: string) => isValidDate(s) ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDate(s)) : 'Choisir';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? Math.floor(value) : min));
const defaultDates = () => {
  const today = dateString(new Date());
  return { checkIn: addDays(today, 1), checkOut: addDays(today, 4) };
};

export const SearchBar: React.FC<SearchBarProps> = ({
  initialDestination = '', initialCheckIn = '', initialCheckOut = '',
  initialAdults = 2, initialChildren = 0, initialRooms = 1,
  onSearch, variant = 'hero',
}) => {
  const id = useId();
  const defaults = useRef(defaultDates());
  const [destination, setDestination] = useState(initialDestination);
  const [checkIn, setCheckIn] = useState(() => isValidDate(initialCheckIn) ? initialCheckIn : defaults.current.checkIn);
  const [checkOut, setCheckOut] = useState(() => isValidDate(initialCheckOut) && initialCheckOut > (isValidDate(initialCheckIn) ? initialCheckIn : defaults.current.checkIn) ? initialCheckOut : defaults.current.checkOut);
  const [adults, setAdults] = useState(() => clamp(initialAdults, 1, 10));
  const [children, setChildren] = useState(() => clamp(initialChildren, 0, 8));
  const [rooms, setRooms] = useState(() => clamp(initialRooms, 1, 6));
  const [panel, setPanel] = useState<Panel>(null);
  const [step, setStep] = useState<DateStep>('checkIn');
  const [month, setMonth] = useState(() => {
    const d = parseDate(isValidDate(initialCheckIn) ? initialCheckIn : defaults.current.checkIn);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const rootRef = useRef<HTMLFormElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const today = dateString(new Date());
  const isHero = variant === 'hero';

  useEffect(() => setDestination(initialDestination), [initialDestination]);
  useEffect(() => {
    if (isValidDate(initialCheckIn)) {
      setCheckIn(initialCheckIn);
      setCheckOut(prev => prev <= initialCheckIn ? addDays(initialCheckIn, 1) : prev);
    }
  }, [initialCheckIn]);
  useEffect(() => {
    if (isValidDate(initialCheckOut)) setCheckOut(prev => initialCheckOut > checkIn ? initialCheckOut : prev);
  }, [initialCheckOut, checkIn]);
  useEffect(() => setAdults(clamp(initialAdults, 1, 10)), [initialAdults]);
  useEffect(() => setChildren(clamp(initialChildren, 0, 8)), [initialChildren]);
  useEffect(() => setRooms(clamp(initialRooms, 1, 6)), [initialRooms]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const open = (next: Panel) => setPanel(current => current === next ? null : next);
  const openCalendar = (nextStep: DateStep) => {
    setStep(nextStep);
    const date = nextStep === 'checkIn' ? checkIn : checkOut;
    const base = isValidDate(date) && date >= today ? date : today;
    const d = parseDate(base);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setPanel('calendar');
  };
  const chooseDate = (value: string) => {
    if (value < today) return;
    if (step === 'checkIn') {
      setCheckIn(value);
      const next = checkOut > value ? checkOut : addDays(value, 1);
      setCheckOut(next);
      setStep('checkOut');
      const d = parseDate(next);
      if (d.getMonth() !== parseDate(value).getMonth() || d.getFullYear() !== parseDate(value).getFullYear()) {
        setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    } else if (value > checkIn) {
      setCheckOut(value);
      setPanel(null);
    }
  };
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const previousEnabled = month.getTime() > monthStart.getTime();
  const firstOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => dateString(new Date(month.getFullYear(), month.getMonth(), index + 1))),
  ];
  const destinations = SENEGAL_REGIONS.filter(region => normalize(region.name).includes(normalize(destination.trim())));
  const guestSummary = `${adults + children} voyageur${adults + children > 1 ? 's' : ''} · ${rooms} chambre${rooms > 1 ? 's' : ''}`;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const start = isValidDate(checkIn) && checkIn >= today ? checkIn : addDays(today, 1);
    const end = isValidDate(checkOut) && checkOut > start ? checkOut : addDays(start, 1);
    setCheckIn(start);
    setCheckOut(end);
    setPanel(null);
    onSearch({ destination: destination.trim(), checkIn: start, checkOut: end, adults, children, rooms });
  };

  const field = 'flex min-h-[66px] w-full min-w-0 items-center gap-3 rounded-xl border border-[#E9E2D5] bg-white px-3 py-2.5 text-left transition hover:border-[#B79B69] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#284C3B]';
  const caption = 'block text-[10px] font-bold uppercase tracking-wider text-[#687067]';
  const value = 'block truncate text-sm font-semibold text-[#30352F]';
  const popover = 'absolute left-0 top-full z-[150] mt-2 rounded-2xl border border-[#E9E2D5] bg-white p-4 text-[#30352F] shadow-[0_20px_50px_rgba(27,56,45,0.2)]';

  const counter = (label: string, detail: string, count: number, min: number, max: number, set: React.Dispatch<React.SetStateAction<number>>) => (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-[#687067]">{detail}</p></div>
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" aria-label={`Diminuer ${label.toLowerCase()}`} disabled={count <= min} onClick={() => set(v => clamp(v - 1, min, max))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8D1C4] disabled:cursor-not-allowed disabled:opacity-30"><Minus size={15} /></button>
        <span className="w-5 text-center text-sm font-bold tabular-nums">{count}</span>
        <button type="button" aria-label={`Augmenter ${label.toLowerCase()}`} disabled={count >= max} onClick={() => set(v => clamp(v + 1, min, max))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8D1C4] disabled:cursor-not-allowed disabled:opacity-30"><Plus size={15} /></button>
      </div>
    </div>
  );

  return (
    <form ref={rootRef} id="search-bar-form" onSubmit={submit} role="search"
      className={`relative z-[80] w-full min-w-0 ${isHero ? 'rounded-2xl bg-[#F7F5EF] p-1.5 sm:p-2' : 'rounded-xl border border-[#E9E2D5] bg-white p-1.5'}`}>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
        <div className="relative min-w-0 sm:col-span-2 lg:col-span-4">
          <div className={field}>
            <MapPin size={19} className="shrink-0 text-[#B79B69]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-destination`} className={caption}>Destination au Sénégal</label>
              <input id={`${id}-destination`} ref={destinationRef} type="text" autoComplete="off" value={destination}
                onFocus={() => setPanel('destination')}
                onChange={event => { setDestination(event.target.value); setPanel('destination'); }}
                placeholder="Ville ou région" className={`${value} w-full bg-transparent outline-none placeholder:font-normal placeholder:text-[#969C94]`} />
            </div>
            {destination ? <button type="button" aria-label="Effacer la destination" onClick={() => { setDestination(''); destinationRef.current?.focus(); }} className="rounded-lg p-1 text-[#687067]"><X size={16} /></button> : <ChevronDown size={16} className="text-[#687067]" aria-hidden="true" />}
          </div>
          {panel === 'destination' && (
            <div className={`${popover} w-full max-h-72 overflow-y-auto`}>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#687067]"><Compass size={15} /> Destinations</p>
              <button type="button" onClick={() => { setDestination(''); setPanel(null); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#284C3B] hover:bg-[#F7F5EF]">Tout le Sénégal</button>
              {destinations.map(region => (
                <button type="button" key={region.id} onClick={() => { setDestination(region.name); setPanel(null); }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[#F7F5EF]">
                  <span className="min-w-0"><span className="block font-medium">{region.name}</span><span className="block truncate text-xs text-[#687067]">{region.description}</span></span>
                  {normalize(destination) === normalize(region.name) && <Check size={16} className="shrink-0 text-[#284C3B]" />}
                </button>
              ))}
              {destinations.length === 0 && <p className="px-3 py-3 text-xs text-[#687067]">Aucune région correspondante. Vous pouvez rechercher une ville en saisissant son nom.</p>}
            </div>
          )}
        </div>

        <div className="relative grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 lg:col-span-4">
          <button type="button" id="check-in-date-trigger" onClick={() => openCalendar('checkIn')} aria-expanded={panel === 'calendar' && step === 'checkIn'} className={field}>
            <CalendarDays size={18} className="hidden shrink-0 text-[#B79B69] sm:block" aria-hidden="true" />
            <span className="min-w-0"><span className={caption}>Arrivée</span><span className={value}>{shortDate(checkIn)}</span></span>
          </button>
          <button type="button" id="check-out-date-trigger" onClick={() => openCalendar('checkOut')} aria-expanded={panel === 'calendar' && step === 'checkOut'} className={field}>
            <CalendarDays size={18} className="hidden shrink-0 text-[#B79B69] sm:block" aria-hidden="true" />
            <span className="min-w-0"><span className={caption}>Départ</span><span className={value}>{shortDate(checkOut)}</span></span>
          </button>
          {panel === 'calendar' && (
            <div className={`${popover} left-1/2 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 sm:left-0 sm:translate-x-0`}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <button type="button" aria-label="Mois précédent" disabled={!previousEnabled} onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E9E2D5] disabled:opacity-30"><ChevronLeft size={18} /></button>
                <div className="text-center"><p className="text-[11px] text-[#687067]">{step === 'checkIn' ? "Choisissez l'arrivée" : 'Choisissez le départ'}</p><p className="font-serif font-semibold capitalize">{MONTHS[month.getMonth()]} {month.getFullYear()}</p></div>
                <button type="button" aria-label="Mois suivant" onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E9E2D5]"><ChevronRight size={18} /></button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1">{DAYS.map(day => <span key={day} className="py-1 text-center text-[11px] font-semibold text-[#687067]">{day}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} />;
                  const disabled = day < today || (step === 'checkOut' && day <= checkIn);
                  const selected = day === checkIn || day === checkOut;
                  const inRange = day > checkIn && day < checkOut;
                  return <button type="button" key={day} disabled={disabled} onClick={() => chooseDate(day)}
                    aria-label={new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(parseDate(day))}
                    aria-pressed={selected}
                    className={`h-9 rounded-lg text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-25 ${selected ? 'bg-[#284C3B] text-white' : inRange ? 'bg-[#E5EEE8] text-[#284C3B]' : 'hover:bg-[#F7F5EF]'}`}>
                    {Number(day.slice(-2))}
                  </button>;
                })}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#E9E2D5] pt-3">
                <span className="text-xs text-[#687067]">{shortDate(checkIn)} → {shortDate(checkOut)}</span>
                <button type="button" onClick={() => setPanel(null)} className="text-xs font-semibold text-[#284C3B]">Fermer</button>
              </div>
            </div>
          )}
        </div>

        <div className="relative min-w-0 sm:col-span-1 lg:col-span-3">
          <button type="button" id="guests-counter-trigger" onClick={() => open('guests')} aria-expanded={panel === 'guests'} className={field}>
            <Users size={19} className="shrink-0 text-[#B79B69]" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className={caption}>Voyageurs et chambres</span><span className={value}>{guestSummary}</span></span>
            <ChevronDown size={16} className="shrink-0 text-[#687067]" aria-hidden="true" />
          </button>
          {panel === 'guests' && (
            <div className={`${popover} right-0 w-[min(320px,calc(100vw-2rem))] sm:left-auto`}>
              {counter('Adultes', '18 ans et plus', adults, 1, 10, setAdults)}
              <div className="border-t border-[#E9E2D5]">{counter('Enfants', '0 à 17 ans', children, 0, 8, setChildren)}</div>
              <div className="border-t border-[#E9E2D5]">{counter('Chambres', 'Nombre souhaité', rooms, 1, 6, setRooms)}</div>
              <button type="button" id="apply-guests-btn" onClick={() => setPanel(null)} className="mt-2 w-full rounded-xl bg-[#284C3B] py-3 text-sm font-semibold text-white">Valider</button>
            </div>
          )}
        </div>

        <button type="submit" id="main-search-submit-button"
          className="flex min-h-[60px] items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1B382D] sm:col-span-1 lg:col-span-1"
          aria-label="Rechercher des hébergements">
          <Search size={20} aria-hidden="true" /><span className="lg:sr-only">Rechercher</span>
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
