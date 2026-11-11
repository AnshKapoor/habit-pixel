import { useColorScheme } from 'react-native';

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  empty: string;
  accent: string;
  danger: string;
  /** Streak freezes: icon/border colour and a light tile fill. */
  freeze: string;
  freezeBg: string;
}

const light: Theme = {
  dark: false,
  bg: '#f6f8fa',
  card: '#ffffff',
  text: '#1f2328',
  subtext: '#656d76',
  border: '#d0d7de',
  empty: '#ebedf0',
  accent: '#2da44e',
  danger: '#cf222e',
  freeze: '#0969da',
  freezeBg: '#ddf4ff',
};

const dark: Theme = {
  dark: true,
  bg: '#0d1117',
  card: '#161b22',
  text: '#e6edf3',
  subtext: '#8d96a0',
  border: '#30363d',
  empty: '#21262d',
  accent: '#3fb950',
  danger: '#f85149',
  freeze: '#58a6ff',
  freezeBg: '#122d4a',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const HABIT_COLORS = [
  '#2da44e',
  '#1f6feb',
  '#8250df',
  '#bf3989',
  '#cf222e',
  '#fb8500',
  '#d4a72c',
  '#0a9396',
];

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Map a 0..1 intensity to a tile colour; low values stay visible but faded. */
export function tileColor(color: string, strength: number, emptyColor: string): string {
  if (strength <= 0) return emptyColor;
  return withAlpha(color, 0.2 + 0.8 * strength);
}
