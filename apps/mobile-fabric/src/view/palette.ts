import type { Priority, ThemeMode } from '../domain'

export interface Palette {
  readonly canvas: string
  readonly surface: string
  readonly surfaceAlt: string
  readonly ink: string
  readonly inkSoft: string
  readonly inkMuted: string
  readonly border: string
  readonly accent: string
  readonly accentSoft: string
  readonly accentInk: string
  readonly pine: string
  readonly pineSoft: string
  readonly amber: string
  readonly amberSoft: string
  readonly cobalt: string
  readonly cobaltSoft: string
  readonly chip: string
  readonly avatarBg: string
  readonly avatarInk: string
}

const PAPER: Palette = {
  canvas: '#F4EFE6',
  surface: '#FCFAF5',
  surfaceAlt: '#EAE2D3',
  ink: '#1A1714',
  inkSoft: '#4E473F',
  inkMuted: '#7B7164',
  border: '#D8CEBE',
  accent: '#D43C1E',
  accentSoft: '#FAE5DF',
  accentInk: '#FFFAF7',
  pine: '#1E6B4B',
  pineSoft: '#DFF0E8',
  amber: '#A8640B',
  amberSoft: '#F8ECD7',
  cobalt: '#2251A6',
  cobaltSoft: '#E3ECFA',
  chip: '#E6DDD0',
  avatarBg: '#1A1714',
  avatarInk: '#FCFAF5',
}

const GRAPHITE: Palette = {
  canvas: '#141311',
  surface: '#24211D',
  surfaceAlt: '#1C1916',
  ink: '#F3EDE3',
  inkSoft: '#C9BFB0',
  inkMuted: '#8F8577',
  border: '#35302A',
  accent: '#EA583A',
  accentSoft: '#42231C',
  accentInk: '#141311',
  pine: '#4FC590',
  pineSoft: '#1B382B',
  amber: '#EBB054',
  amberSoft: '#3A2D18',
  cobalt: '#7AA7FF',
  cobaltSoft: '#1C2A44',
  chip: '#322D27',
  avatarBg: '#F3EDE3',
  avatarInk: '#141311',
}

export const paletteFor = (theme: ThemeMode): Palette =>
  theme === 'paper' ? PAPER : GRAPHITE

export const priorityColors = (
  priority: Priority,
  p: Palette,
): { readonly bg: string; readonly fg: string; readonly label: string } => {
  switch (priority) {
    case 'high':
      return { bg: p.accentSoft, fg: p.accent, label: 'HIGH' }
    case 'medium':
      return { bg: p.amberSoft, fg: p.amber, label: 'MED' }
    case 'low':
      return { bg: p.cobaltSoft, fg: p.cobalt, label: 'LOW' }
  }
}
