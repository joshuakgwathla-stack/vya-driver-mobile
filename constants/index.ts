// ─── Colour palette ───────────────────────────────────────────────────────────
// Aligned to the driver web app (vya-driver/app/globals.css).
// Web uses CSS variables; these are the resolved values for React Native.
// When the driver web palette changes, update both files.

export const COLORS = {
  // Dark surfaces (auth screens, nav, dark cards)
  navy:         '#0f1f4a',   // --navy
  navyMid:      '#1e3a8a',   // --navy-mid
  navyLight:    '#2d4fa8',   // --navy-light

  // Light surfaces (main content, cards, forms)
  surface:      '#f8f9fc',   // --surface (main background)
  offWhite:     '#f8f9fc',   // alias — same value
  white:        '#ffffff',

  // Amber gold
  gold:         '#f59e0b',   // --gold
  goldLight:    '#fbbf24',   // --gold-light
  goldDark:     '#d97706',

  // Borders
  border:       '#e2e8f0',   // --border
  borderMid:    'rgba(15,31,74,0.15)',
  borderDark:   'rgba(255,255,255,0.1)',

  // Typography
  text:          '#0f172a',  // --text-primary (on light bg)
  textSecondary: '#64748b',  // --text-secondary
  textMuted:     '#94a3b8',
  textInverse:   '#ffffff',  // text on dark/navy bg

  // Semantic
  success:      '#10b981',
  successLight: 'rgba(16,185,129,0.1)',
  danger:       '#ef4444',
  dangerLight:  'rgba(239,68,68,0.1)',
  warning:      '#f59e0b',
  warningLight: 'rgba(245,158,11,0.1)',
}

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://vya-backend-production.up.railway.app'

export const ORIGIN_CITIES = ['Johannesburg', 'Pretoria', 'Midrand', 'Bela-Bela', 'Modimolle']

export const DESTINATION_CITIES = [
  'Polokwane', 'Seshego', 'Moria', 'Thohoyandou', 'Tzaneen',
  'Giyani', 'Burgersfort', 'Marble Hall', 'Mokopane',
  'Louis Trichardt (Makhado)', 'Phalaborwa', 'Lebowakgomo',
  'Hoedspruit', 'Lephalale', 'Musina',
]

export const TIME_SLOTS = ['10:00', '12:00', '15:00', '17:00', '19:00', '21:00']
