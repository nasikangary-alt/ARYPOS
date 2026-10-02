// Curated food images matching Ayam Geprek ARY menu items and ingredients
export const PRODUCT_IMAGES: Record<string, string> = {
  // Paket menus
  'Paket Hemat':
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80', // Fried chicken with rice
  'Paket Mantul':
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80', // Chicken meal with drink
  'Paket Kenyang':
    'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=400&q=80', // Chicken platter with sides
  'Paket Komplit':
    'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=400&q=80', // Complete fried chicken set
  // Chicken items
  'Ayam Geprek + Sambal':
    'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=400&q=80', // Crispy chicken with chili
  'Ayam Geprek + Indomie':
    'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80', // Noodles with chicken
  'Ayam Geprek + Indomie + Sambal':
    'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80',
  'Ayam Geprek + Indomie + Sambal + Teh Manis':
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80',
  // Sides & Drinks
  Tahu:
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', // Tofu
  Tempe:
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80', // Tempeh
  'Teh Manis':
    'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80', // Iced tea
  Indomie:
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80', // Noodles
  Nasi:
    'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=400&q=80', // Rice
  Sambal:
    'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=400&q=80', // Chili sambal
};

export const INGREDIENT_IMAGES: Record<string, string> = {
  'Ayam Siap Jual':
    'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=200&q=80',
  'Ayam Mentah':
    'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=200&q=80',
  Nasi:
    'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=200&q=80',
  Sambal:
    'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=200&q=80',
  'Teh Manis':
    'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=200&q=80',
  Tahu:
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80',
  Tempe:
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80',
  Indomie:
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=200&q=80',
};

export function getProductImageUrl(name: string): string {
  // Exact match
  if (PRODUCT_IMAGES[name]) return PRODUCT_IMAGES[name];
  // Substring matching
  for (const [key, url] of Object.entries(PRODUCT_IMAGES)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return url;
    }
  }
  // Fallback
  return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80';
}

export function getIngredientImageUrl(name: string): string {
  if (INGREDIENT_IMAGES[name]) return INGREDIENT_IMAGES[name];
  for (const [key, url] of Object.entries(INGREDIENT_IMAGES)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return url;
    }
  }
  return 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=200&q=80';
}

// Map well-known initials for Ayam Geprek ARY products
const PRESET_INITIALS: Record<string, string> = {
  'Paket Hemat': 'PH',
  'Paket Mantul': 'PM',
  'Paket Kenyang': 'PK',
  'Paket Komplit': 'PKp',
  'Ayam Geprek + Sambal': 'AGS',
  'Ayam Geprek + Indomie': 'AGI',
  'Ayam Geprek + Indomie + Sambal': 'AGIS',
  'Ayam Geprek + Indomie + Sambal + Teh Manis': 'AGST',
  'Ayam Geprek Original': 'AGO',
  'Ayam Geprek': 'AG',
  Tahu: 'TH',
  Tempe: 'TP',
  'Teh Manis': 'TM',
  Indomie: 'ID',
  Nasi: 'NS',
  Sambal: 'SB',
  'Es Teh Manis': 'ETM',
  'Es Teh': 'ET',
};

/**
 * Returns a concise 2-4 character initial abbreviation for a menu item
 * e.g., "Paket Hemat" -> "PH", "Paket Mantul" -> "PM", "Ayam Geprek + Sambal" -> "AGS"
 */
export function getProductInitials(name: string): string {
  if (PRESET_INITIALS[name]) return PRESET_INITIALS[name];

  // Try partial match with preset keys
  for (const [key, initial] of Object.entries(PRESET_INITIALS)) {
    if (name.toLowerCase() === key.toLowerCase()) return initial;
  }

  // Generate automatically from words
  const words = name
    .replace(/[+&/\\-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'M';
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words
    .map(w => w[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
}

/**
 * Returns distinct, vibrant badge colors based on product category/name
 */
export function getProductInitialBadgeStyle(name: string): {
  bg: string;
  text: string;
  border: string;
  glow: string;
} {
  const lower = name.toLowerCase();

  if (lower.includes('paket')) {
    return {
      bg: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 text-white',
      text: 'text-white',
      border: 'border-orange-300 dark:border-orange-600',
      glow: 'shadow-orange-500/20',
    };
  }
  if (lower.includes('ayam') || lower.includes('geprek')) {
    return {
      bg: 'bg-gradient-to-br from-red-600 via-rose-600 to-red-700 text-white',
      text: 'text-white',
      border: 'border-red-300 dark:border-red-700',
      glow: 'shadow-red-500/20',
    };
  }
  if (
    lower.includes('teh') ||
    lower.includes('minum') ||
    lower.includes('es ') ||
    lower.includes('jus') ||
    lower.includes('drink')
  ) {
    return {
      bg: 'bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 text-white',
      text: 'text-white',
      border: 'border-teal-300 dark:border-emerald-700',
      glow: 'shadow-emerald-500/20',
    };
  }
  if (lower.includes('tahu') || lower.includes('tempe') || lower.includes('goreng')) {
    return {
      bg: 'bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 text-white',
      text: 'text-white',
      border: 'border-yellow-300 dark:border-amber-600',
      glow: 'shadow-amber-500/20',
    };
  }
  if (lower.includes('indomie') || lower.includes('mie')) {
    return {
      bg: 'bg-gradient-to-br from-amber-500 via-yellow-500 to-red-500 text-white',
      text: 'text-white',
      border: 'border-amber-300 dark:border-amber-600',
      glow: 'shadow-yellow-500/20',
    };
  }

  return {
    bg: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-800 text-white',
    text: 'text-white',
    border: 'border-indigo-300 dark:border-indigo-700',
    glow: 'shadow-indigo-500/20',
  };
}

