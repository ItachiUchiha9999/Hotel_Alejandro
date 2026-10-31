/**
 * Design System Tokens - Hotel Alejandro I (SIGH)
 *
 * Sistema de diseño unificado para toda la aplicación.
 * Basado en escalas de 4px, tipografía system-ui, paleta neutra con acento dorado.
 */

// ============================================================================
// COLORES
// ============================================================================

export const colors = {
  // Neutros (escala de grises cálidos)
  neutral: {
    0: '#ffffff',
    50: '#faf9f6',
    100: '#f2f0ec',
    200: '#e8e0d4',
    300: '#d4c8b8',
    400: '#b8a890',
    500: '#968872',
    600: '#756f67',
    700: '#514d46',
    800: '#3d3a35',
    900: '#2d2b27',
    950: '#1a1917',
  },

  // Carbon (texto principal) - más suave que negro puro
  carbon: {
    DEFAULT: '#1a1a1a',
    light: '#2d2d2d',
    muted: '#514d46',
    subtle: '#756f67',
  },

  // Acentos principales
  gold: {
    50: '#fdf6e3',
    100: '#f9e9c0',
    200: '#f2d68f',
    300: '#ebc055',
    400: '#e3a828',  // principal
    500: '#d4941a',
    600: '#b37714',
    700: '#8c5a10',
    800: '#6b4610',
    900: '#563910',
    DEFAULT: '#e3a828',
    hover: '#d4941a',
    active: '#b37714',
    light: '#fdf6e3',
  },

  // Estados semánticos
  success: {
    50: '#ecfdf3',
    100: '#d1f5d6',
    200: '#a3e9ac',
    300: '#62d373',
    400: '#2db345',
    500: '#1a9c33',   // principal
    600: '#167d2a',
    700: '#136123',
    DEFAULT: '#1a9c33',
    light: '#ecfdf3',
    text: '#136123',
  },

  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',   // principal
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    DEFAULT: '#ef4444',
    light: '#fef2f2',
    text: '#991b1b',
  },

  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',   // principal
    600: '#d97706',
    DEFAULT: '#f59e0b',
    light: '#fffbeb',
    text: '#92400e',
  },

  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',   // principal
    600: '#2563eb',
    DEFAULT: '#3b82f6',
    light: '#eff6ff',
    text: '#1e40af',
  },

  // Superficies
  surface: {
    primary: '#ffffff',
    secondary: '#faf9f6',
    tertiary: '#f2f0ec',
    elevated: '#ffffff',
    overlay: 'rgba(26, 26, 26, 0.5)',
  },

  // Bordes
  border: {
    DEFAULT: '#e8e0d4',
    strong: '#d4c8b8',
    focus: '#e3a828',
    error: '#ef4444',
  },

  // Texto
  text: {
    primary: '#1a1a1a',
    secondary: '#514d46',
    tertiary: '#756f67',
    inverse: '#ffffff',
    muted: '#968872',
  },
} as const;

// ============================================================================
// ESPACIADO (escala base 4px)
// ============================================================================

export const spacing = {
  0: '0',
  1: '4px',    // 0.25rem
  2: '8px',    // 0.5rem
  3: '12px',   // 0.75rem
  4: '16px',   // 1rem
  5: '20px',   // 1.25rem
  6: '24px',   // 1.5rem
  8: '32px',   // 2rem
  10: '40px',  // 2.5rem
  12: '48px',  // 3rem
  16: '64px',  // 4rem
  20: '80px',  // 5rem
  24: '96px',  // 6rem
} as const;

// ============================================================================
// TIPOGRAFÍA
// ============================================================================

export const typography = {
  fontFamily: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },

  fontSize: {
    xs: ['12px', { lineHeight: '16px', letterSpacing: '0.02em' }],
    sm: ['14px', { lineHeight: '20px', letterSpacing: '0.01em' }],
    base: ['16px', { lineHeight: '24px', letterSpacing: '0' }],
    lg: ['18px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
    xl: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
    '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
    '3xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
    '4xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.03em' }],
    '5xl': ['48px', { lineHeight: '52px', letterSpacing: '-0.03em' }],
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeight: {
    tight: '1.1',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },

  letterSpacing: {
    tighter: '-0.03em',
    tight: '-0.02em',
    normal: '0',
    wide: '0.01em',
    wider: '0.02em',
    widest: '0.04em',
  },
} as const;

// ============================================================================
// BORDES Y RADIOS
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '4px',
  DEFAULT: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  full: '9999px',
} as const;

export const borderWidth = {
  DEFAULT: '1px',
  2: '2px',
  3: '3px',
} as const;

// ============================================================================
// SOMBRAS
// ============================================================================

export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.03)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
  DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
  md: '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
  lg: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
  xl: '0 25px 50px -12px rgb(0 0 0 / 0.1)',
  '2xl': '0 35px 60px -15px rgb(0 0 0 / 0.12)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  focus: '0 0 0 3px rgb(227 168 40 / 0.4)',
} as const;

// ============================================================================
// Z-INDEX
// ============================================================================

export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
} as const;

// ============================================================================
// TRANSICIONES
// ============================================================================

export const transitions = {
  fast: '150ms ease',
  DEFAULT: '200ms ease',
  slow: '300ms ease',
} as const;

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// ICONOS (tamaños estándar)
// ============================================================================

export const iconSizes = {
  xs: '12px',
  sm: '16px',
  DEFAULT: '20px',
  lg: '24px',
  xl: '32px',
} as const;

// ============================================================================
// TIPOS TYPESCRIPT
// ============================================================================

export type ColorScale = typeof colors.neutral;
export type SpacingScale = typeof spacing;
export type FontSizeScale = typeof typography.fontSize;
export type BorderRadiusScale = typeof borderRadius;
export type ShadowScale = typeof shadows;
export type ZIndexScale = typeof zIndex;