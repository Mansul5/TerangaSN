import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, LifeBuoy, Loader2, MessageSquare, Paperclip, Send, Star } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase/client';

type SupportStatus = 'open' | 'in_progress' | 'waiting_user' | 'follow_up' | 'resolved' | 'closed';
type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: SupportStatus;
  priority: string;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
};
type SupportMessage = {
  id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};
type SupportAttachment = {
  id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  file_size: number;
};
type SupportRating = { ticket_id: string; rating: number; comment: string | null };
type BookingOption = { id: string; booking_number: string; hotel: { name: string } | { name: string }[] | null };

const statusNames: Record<SupportStatus, string> = {
  open: 'Nouveau',
  in_progress: 'En cours',
  waiting_user: 'En attente de votre réponse',
  follow_up: 'À relancer',
  resolved: 'Résolu',
  closed: 'Clôturé',
};
const inputClass = 'w-full rounded-xl border border-[#E9E2D5] bg-white px-3 py-2.5 text-sm text-[#30352F] outline-none focus:border-[#284C3B]';
const formatTimestamp = (value: string) => new Date(value).toLocaleString('fr-FR');
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';

export const SupportCenterPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [ratings, setRatings] = useState<SupportRating[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('question');
  const [bookingId, setBookingId] = useState('');
  const [reply, setReply] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const { data: ticketRows, error: ticketError } = await supabase
        .from('support_tickets')
        .select('id,subject,description,category,status,priority,booking_id,created_at,updated_at')
        .order('updated_at', { ascending: false });
      if (ticketError) throw ticketError;
      const rows = (ticketRows || []) as SupportTicket[];
      setTickets(rows);
      if (rows.length) {
        const { data: ratingRows, error: ratingError } = await supabase
          .from('support_ticket_ratings').select('ticket_id,rating,comment')
          .in('ticket_id', rows.map(ticket => ticket.id));
        if (ratingError) throw ratingError;
        setRatings((ratingRows || []) as SupportRating[]);
      } else {
        setRatings([]);
      }

      const { data: guestBookings, error: guestError } = await supabase
        .from('bookings')
        .select('id,booking_number,hotel:hotels(name)')
        .eq('user_id', user.id);
      if (guestError) throw guestError;
      const { data: ownedHotels, error: hotelsError } = await supabase
        .from('hotels').select('id').eq('owner_id', user.id);
      if (hotelsError) throw hotelsError;
      let hostBookings: BookingOption[] = [];
      if (ownedHotels?.length) {
        const { data, error: hostBookingsError } = await supabase
          .from('bookings')
          .select('id,booking_number,hotel:hotels(name)')
          .in('hotel_id', ownedHotels.map(hotel => hotel.id));
        if (hostBookingsError) throw hostBookingsError;
        hostBookings = (data || []) as BookingOption[];
      }
      const bookingRows = [...(guestBookings || []), ...hostBookings] as BookingOption[];
      setBookings([...new Map(bookingRows.map(booking => [booking.id, booking])).values()]);
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const loadThread = useCallback(async (ticketId: string) => {
    setError('');
    const [messageResult, attachmentResult] = await Promise.all([
      supabase.from('support_ticket_messages')
        .select('id,author_id,body,is_internal,created_at')
        .eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.from('support_ticket_attachments')
        .select('id,storage_path,file_name,content_type,file_size')
        .eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    ]);
    if (messageResult.error) throw messageResult.error;
    if (attachmentResult.error) throw attachmentResult.error;
    setMessages((messageResult.data || []) as SupportMessage[]);
    setAttachments((attachmentResult.data || []) as SupportAttachment[]);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setAttachments([]);
      return;
    }
    let active = true;
    void loadThread(selectedId).catch(threadError => {
      if (active) setError(errorText(threadError));
    });
    return () => { active = false; };
  }, [selectedId, loadThread]);

  const selectedTicket = tickets.find(ticket => ticket.id === selectedId) || null;
  const hasRating = selectedTicket && ratings.some(item => item.ticket_id === selectedTicket.id);

  const perform = async (action: () => Promise<void>, successMessage: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await loadTickets();
      if (selectedId) await loadThread(selectedId);
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  };

  const submitTicket = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || subject.trim().length < 5 || description.trim().length < 10) return;
    if (category === 'dispute' && !bookingId) {
      setError('Sélectionnez la réservation concernée par le litige.');
      return;
    }
    void perform(async () => {
      const { data, error: insertError } = await supabase.from('support_tickets').insert({
        subject: subject.trim(),
        description: description.trim(),
        category,
        booking_id: bookingId || null,
      }).select('id').single();
      if (insertError) throw insertError;
      if (!data) throw new Error('Le dossier a été créé sans identifiant retourné.');
      setSubject('');
      setDescription('');
      setBookingId('');
      setSelectedId(data.id);
    }, 'Votre demande a bien été envoyée.');
  };

  const sendReply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedTicket || !reply.trim()) return;
    void perform(async () => {
      const { error: insertError } = await supabase.from('support_ticket_messages').insert({
        ticket_id: selectedTicket.id,
        author_id: user.id,
        body: reply.trim(),
        is_internal: false,
      });
      if (insertError) throw insertError;
      setReply('');
    }, 'Votre message a été ajouté à la conversation.');
  };

  const uploadAttachment = () => {
    if (!user || !selectedTicket || !file) return;
    void perform(async () => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
        throw new Error('Choisissez un PDF ou une image (JPEG, PNG, WebP) de 10 Mo maximum.');
      }
      const safeName = file.name.trim().replace(/[^A-Za-z0-9._-]/g, '_').slice(-180) || 'document';
      const path = `${selectedTicket.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await supabase.from('support_ticket_attachments').insert({
        ticket_id: selectedTicket.id,
        uploaded_by: user.id,
        storage_path: path,
        file_name: file.name.slice(0, 255),
        content_type: file.type,
        file_size: file.size,
      });
      if (metadataError) {
        const { error: cleanupError } = await supabase.storage.from('support-attachments').remove([path]);
        if (cleanupError) throw new Error(`${metadataError.message}. Le fichier a été envoyé mais son enregistrement a échoué; nettoyage impossible : ${cleanupError.message}`);
        throw metadataError;
      }
      setFile(null);
    }, 'La pièce jointe a été ajoutée au dossier.');
  };

  const downloadAttachment = async (attachment: SupportAttachment) => {
    setDownloading(attachment.id);
    setError('');
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from('support-attachments').createSignedUrl(attachment.storage_path, 60);
      if (signedUrlError) throw signedUrlError;
      if (!data?.signedUrl) throw new Error('Lien de téléchargement indisponible.');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setError(errorText(downloadError));
    } finally {
      setDownloading(null);
    }
  };

  const submitRating = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedTicket) return;
    void perform(async () => {
      const { error: insertError } = await supabase.from('support_ticket_ratings').insert({
        ticket_id: selectedTicket.id,
        rated_by: user.id,
        rating,
        comment: ratingComment.trim() || null,
      });
      if (insertError) throw insertError;
      setRatingComment('');
    }, 'Merci pour votre évaluation.');
  };

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 sm:px-6">
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#284C3B]">
        <ArrowLeft size={17} /> Retour
      </button>
      <header className="mb-6 rounded-[26px] bg-[#193E30] p-6 text-white sm:p-8">
        <div className="flex items-center gap-3"><LifeBuoy size={25} /><div>
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Centre d’assistance</h1>
          <p className="mt-1 text-sm text-[#E9E2D5]">Vos demandes, échanges et pièces jointes au même endroit.</p>
        </div></div>
      </header>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <section className="space-y-4">
          <form onSubmit={submitTicket} className="space-y-3 rounded-2xl border border-[#E9E2D5] bg-white p-5">
            <h2 className="font-serif text-xl font-bold text-[#193E30]">Nouvelle demande</h2>
            <input className={inputClass} aria-label="Objet de la demande" placeholder="Objet (5 caractères minimum)" value={subject} onChange={event => setSubject(event.target.value)} minLength={5} maxLength={180} required />
            <select className={inputClass} aria-label="Catégorie de la demande" value={category} onChange={event => setCategory(event.target.value)}>
              <option value="question">Question générale</option><option value="booking">Réservation</option>
              <option value="account">Compte</option><option value="technical">Problème technique</option>
              <option value="dispute">Litige</option><option value="other">Autre</option>
            </select>
            {category === 'dispute' && <select className={inputClass} aria-label="Réservation liée au litige" value={bookingId} onChange={event => setBookingId(event.target.value)} required>
              <option value="">Choisir la réservation concernée</option>
              {bookings.map(booking => <option key={booking.id} value={booking.id}>{booking.booking_number} · {(Array.isArray(booking.hotel) ? booking.hotel[0]?.name : booking.hotel?.name) || 'Hébergement'}</option>)}
            </select>}
            <textarea className={inputClass} aria-label="Description de la demande" placeholder="Décrivez votre besoin (10 caractères minimum)" rows={4} value={description} onChange={event => setDescription(event.target.value)} minLength={10} maxLength={5000} required />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#193E30] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Envoyer la demande</button>
          </form>
          <section className="rounded-2xl border border-[#E9E2D5] bg-white p-4">
            <h2 className="mb-3 font-bold text-[#193E30]">Mes demandes</h2>
            {loading ? <p className="flex items-center gap-2 p-3 text-sm text-[#647267]"><Loader2 size={16} className="animate-spin" /> Chargement…</p>
              : tickets.length === 0 ? <p className="p-3 text-sm text-[#647267]">Vous n’avez pas encore de demande.</p>
                : <div className="space-y-2">{tickets.map(ticket => <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === ticket.id ? 'border-[#193E30] bg-[#EFF3ED]' : 'border-[#E9E2D5]'}`}>
                  <span className="block font-semibold text-[#30352F]">{ticket.subject}</span>
                  <span className="mt-1 block text-xs text-[#647267]">{statusNames[ticket.status] || ticket.status} · {formatTimestamp(ticket.updated_at)}</span>
                </button>)}</div>}
          </section>
        </section>

        <section className="min-h-96 rounded-2xl border border-[#E9E2D5] bg-white p-5">
          {!selectedTicket ? <div className="flex h-full min-h-72 flex-col items-center justify-center text-center text-[#647267]">
            <MessageSquare size={28} className="mb-3 text-[#284C3B]" /><p>Sélectionnez une demande pour consulter la conversation.</p>
          </div> : <div className="space-y-5">
            <header className="border-b border-[#E9E2D5] pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8C744C]">{statusNames[selectedTicket.status] || selectedTicket.status} · {selectedTicket.category}</p>
              <h2 className="mt-1 font-serif text-xl font-bold text-[#193E30]">{selectedTicket.subject}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#59645B]">{selectedTicket.description}</p>
            </header>
            <div className="space-y-3">
              <h3 className="font-semibold text-[#193E30]">Conversation</h3>
              {messages.length === 0 ? <p className="text-sm text-[#647267]">Aucune réponse pour le moment.</p> : messages.map(message => <article key={message.id} className="rounded-xl bg-[#F7F5EF] p-3">
                <p className="whitespace-pre-wrap text-sm text-[#30352F]">{message.body}</p>
                <time className="mt-2 block text-xs text-[#647267]">{message.author_id === user?.id ? 'Vous' : 'Assistance'} · {formatTimestamp(message.created_at)}</time>
              </article>)}
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-[#193E30]">Pièces jointes</h3>
              {attachments.map(attachment => <button key={attachment.id} type="button" onClick={() => void downloadAttachment(attachment)} disabled={downloading === attachment.id} className="flex w-full items-center gap-2 rounded-lg border border-[#E9E2D5] px-3 py-2 text-left text-sm text-[#284C3B] disabled:opacity-50">
                {downloading === attachment.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span className="min-w-0 flex-1 truncate">{attachment.file_name}</span>
                <span className="text-xs text-[#647267]">{Math.ceil(attachment.file_size / 1024)} Ko</span>
              </button>)}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" aria-label="Ajouter une pièce jointe" onChange={event => setFile(event.target.files?.[0] || null)} className="min-w-0 flex-1 text-sm" />
                <button type="button" onClick={uploadAttachment} disabled={busy || !file} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#C8D9CD] px-3 py-2 text-sm font-semibold text-[#284C3B] disabled:opacity-50"><Paperclip size={15} /> Ajouter</button>
              </div>
            </div>
            {selectedTicket.status !== 'closed' && <form onSubmit={sendReply} className="space-y-2 border-t border-[#E9E2D5] pt-4">
              <label className="block text-sm font-semibold text-[#193E30]" htmlFor="support-reply">Votre réponse</label>
              <textarea id="support-reply" className={inputClass} value={reply} onChange={event => setReply(event.target.value)} maxLength={5000} rows={3} required />
              <button type="submit" disabled={busy || !reply.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#193E30] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={15} /> Envoyer</button>
            </form>}
            {['resolved', 'closed'].includes(selectedTicket.status) && !hasRating && <form onSubmit={submitRating} className="space-y-3 border-t border-[#E9E2D5] pt-4">
              <h3 className="font-semibold text-[#193E30]">Évaluer l’assistance</h3>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Note de l’assistance">
                {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} sur 5`} onClick={() => setRating(value)} className="rounded p-1 text-[#B79B69]">
                  <Star size={22} fill={value <= rating ? 'currentColor' : 'none'} />
                </button>)}
              </div>
              <textarea className={inputClass} aria-label="Commentaire sur l’assistance" placeholder="Commentaire facultatif" value={ratingComment} onChange={event => setRatingComment(event.target.value)} maxLength={1000} rows={2} />
              <button type="submit" disabled={busy} className="rounded-xl bg-[#193E30] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Envoyer mon évaluation</button>
            </form>}
            {hasRating && <p className="rounded-xl bg-[#EFF3ED] p-3 text-sm font-semibold text-[#284C3B]">Merci, votre évaluation a été enregistrée.</p>}
          </div>}
        </section>
      </div>
    </main>
  );
};

export default SupportCenterPage;
