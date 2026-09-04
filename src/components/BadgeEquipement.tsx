import React from 'react';
import { 
  Wifi, 
  Waves, 
  AirVent, 
  Coffee, 
  Eye, 
  Car, 
  Utensils, 
  Wine, 
  Sparkles, 
  Zap, 
  Plane, 
  Sun,
  Tv,
  Check
} from 'lucide-react';

interface BadgeEquipementProps {
  id: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const BadgeEquipement: React.FC<BadgeEquipementProps> = ({ 
  id, 
  label, 
  size = 'md',
  showLabel = true 
}) => {
  const getIcon = (amenityId: string) => {
    const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
    switch (amenityId.toLowerCase()) {
      case 'wifi':
        return <Wifi size={iconSize} className="text-[#3F6212]" />;
      case 'pool':
      case 'piscine':
        return <Waves size={iconSize} className="text-[#0284C7]" />;
      case 'ac':
      case 'climatisation':
        return <AirVent size={iconSize} className="text-[#0D9488]" />;
      case 'breakfast':
      case 'petit-dejeuner':
        return <Coffee size={iconSize} className="text-[#8B5E34]" />;
      case 'sea_view':
      case 'vue_mer':
        return <Eye size={iconSize} className="text-[#0284C7]" />;
      case 'parking':
        return <Car size={iconSize} className="text-[#3F6212]" />;
      case 'restaurant':
        return <Utensils size={iconSize} className="text-[#D97706]" />;
      case 'bar':
        return <Wine size={iconSize} className="text-[#8B5E34]" />;
      case 'spa':
        return <Sparkles size={iconSize} className="text-[#B45309]" />;
      case 'generator':
      case 'solaire':
        return <Zap size={iconSize} className="text-[#D97706]" />;
      case 'airport_shuttle':
      case 'navette':
        return <Plane size={iconSize} className="text-[#6B6658]" />;
      case 'beachfront':
      case 'plage':
        return <Sun size={iconSize} className="text-[#D97706]" />;
      case 'tv':
        return <Tv size={iconSize} className="text-[#6B6658]" />;
      default:
        return <Check size={iconSize} className="text-[#3F6212]" />;
    }
  };

  const getLabel = (amenityId: string) => {
    if (label) return label;
    switch (amenityId.toLowerCase()) {
      case 'wifi': return 'Wi-Fi haut débit';
      case 'pool': return 'Piscine';
      case 'ac': return 'Climatisation';
      case 'breakfast': return 'Petit-déjeuner inclus';
      case 'sea_view': return 'Vue mer';
      case 'parking': return 'Parking gratuit';
      case 'restaurant': return 'Restaurant';
      case 'bar': return 'Bar / Salon';
      case 'spa': return 'Spa & Bien-être';
      case 'generator': return 'Générateur / Solaire 24/7';
      case 'airport_shuttle': return 'Navette AIBD';
      case 'beachfront': return 'Front de mer';
      default: return amenityId;
    }
  };

  const badgeSizeClass = size === 'sm' 
    ? 'text-xs py-1 px-2 gap-1.5' 
    : size === 'lg' 
    ? 'text-sm py-2 px-3 gap-2 font-medium' 
    : 'text-xs py-1.5 px-2.5 gap-1.5 font-medium';

  return (
    <span 
      id={`amenity-badge-${id}`}
      className={`inline-flex items-center rounded-lg bg-[#F0EDE4] text-[#2D2A26] border border-[#E6E2D3] hover:bg-[#E6E2D3]/80 transition-colors ${badgeSizeClass}`}
    >
      {getIcon(id)}
      {showLabel && <span>{getLabel(id)}</span>}
    </span>
  );
};
