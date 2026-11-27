import type { Priority, ThemeMode } from "./types.ts"

export interface FolioPalette {
  readonly canvas: string
  readonly topbar: string
  readonly surface: string
  readonly surfaceAlt: string
  readonly card: string
  readonly cardHover: string
  readonly lane: string
  readonly input: string
  readonly ink: string
  readonly inkSoft: string
  readonly inkMuted: string
  readonly border: string
  readonly rule: string
  readonly ruleStrong: string
  readonly accent: string
  readonly accentHover: string
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
  readonly modalBackdrop: string
  readonly cardShadow: string
  readonly modalShadow: string
}

export const PAPER_PALETTE: FolioPalette = {
  canvas: "#F4EFE6",
  topbar: "#FBF8F2",
  surface: "#FCFAF5",
  surfaceAlt: "#EAE2D3",
  card: "#FCFAF5",
  cardHover: "#FFFFFF",
  lane: "#EAE2D3",
  input: "#FFFFFF",
  ink: "#1A1714",
  inkSoft: "#4E473F",
  inkMuted: "#7B7164",
  border: "#D8CEBE",
  rule: "#D8CEBE",
  ruleStrong: "#BFB29D",
  accent: "#D43C1E",
  accentHover: "#B83116",
  accentSoft: "#FAE5DF",
  accentInk: "#FFFAF7",
  pine: "#1E6B4B",
  pineSoft: "#DFF0E8",
  amber: "#A8640B",
  amberSoft: "#F8ECD7",
  cobalt: "#2251A6",
  cobaltSoft: "#E3ECFA",
  chip: "#E6DDD0",
  avatarBg: "#1A1714",
  avatarInk: "#FCFAF5",
  modalBackdrop: "#1A171488",
  cardShadow: "#1A171414",
  modalShadow: "#1A171438"
}

export const GRAPHITE_PALETTE: FolioPalette = {
  canvas: "#141311",
  topbar: "#1B1916",
  surface: "#24211D",
  surfaceAlt: "#1C1916",
  card: "#26231F",
  cardHover: "#2E2A25",
  lane: "#1E1B18",
  input: "#191714",
  ink: "#F3EDE3",
  inkSoft: "#C9BFB0",
  inkMuted: "#8F8577",
  border: "#35302A",
  rule: "#35302A",
  ruleStrong: "#4D463E",
  accent: "#EA583A",
  accentHover: "#FF6F52",
  accentSoft: "#42231C",
  accentInk: "#141311",
  pine: "#4FC590",
  pineSoft: "#1B382B",
  amber: "#EBB054",
  amberSoft: "#3A2D18",
  cobalt: "#7AA7FF",
  cobaltSoft: "#1C2A44",
  chip: "#322D27",
  avatarBg: "#F3EDE3",
  avatarInk: "#141311",
  modalBackdrop: "#00000099",
  cardShadow: "#00000044",
  modalShadow: "#00000088"
}

export const paletteFor = (theme: ThemeMode): FolioPalette =>
  theme === "paper" ? PAPER_PALETTE : GRAPHITE_PALETTE

export const priorityColors = (
  priority: Priority,
  palette: FolioPalette
): { readonly bg: string; readonly fg: string; readonly label: string } => {
  switch (priority) {
    case "high":
      return { bg: palette.accentSoft, fg: palette.accent, label: "HIGH" }
    case "medium":
      return { bg: palette.amberSoft, fg: palette.amber, label: "MED" }
    case "low":
      return { bg: palette.cobaltSoft, fg: palette.cobalt, label: "LOW" }
  }
}
