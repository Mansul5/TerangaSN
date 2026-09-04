/**
 * Format numeric currency amounts in FCFA (XOF) with space thousand separators.
 * Example: 45000 -> "45 000 FCFA"
 */
export function formatFCFA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 FCFA';
  }
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

/**
 * Format date in French
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Format date with day of week (e.g., "Sam. 15 nov. 2025")
 */
export function formatDateWithDay(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Calculate difference in nights between two YYYY-MM-DD dates
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
}

/**
 * Format distance in meters or kilometers
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return '';
  if (meters < 1000) {
    return `à ${meters} m`;
  }
  return `à ${(meters / 1000).toFixed(1)} km`;
}

/**
 * Generate unique Senegal booking reference (e.g., "SN-2026-9842")
 */
export function generateBookingNumber(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `SN-${year}-${randomNum}`;
}

/**
 * Get human readable rating label
 */
export function getRatingLabel(rating: number): string {
  if (rating >= 9.0) return 'Exceptionnel';
  if (rating >= 8.5) return 'Fabuleux';
  if (rating >= 8.0) return 'Très bien';
  if (rating >= 7.0) return 'Bien';
  if (rating > 0) return 'Agréable';
  return 'Nouveau';
}

/**
 * Get category label in French
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'hotel':
      return 'Hôtel';
    case 'lodge':
      return 'Lodge & Écolodge';
    case 'campement':
      return 'Campement touristique';
    case 'residence':
      return 'Résidence & Appartement';
    default:
      return 'Hébergement';
  }
}
