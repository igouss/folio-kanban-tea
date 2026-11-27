import type { Priority, ThemeMode } from "./domain.ts"

export interface Palette {
  readonly canvas: string
  readonly topbar: string
  readonly lane: string
  readonly card: string
  readonly cardHover: string
  readonly input: string
  readonly ink: string
  readonly inkSoft: string
  readonly inkMuted: string
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

export const PAPER_PALETTE: Palette = {
  canvas: "#f4efe6",
  topbar: "#fbf8f2",
  lane: "#eae2d3",
  card: "#fcfaf5",
  cardHover: "#ffffff",
  input: "#ffffff",
  ink: "#1a1714",
  inkSoft: "#4e473f",
  inkMuted: "#7b7164",
  rule: "#d8cebe",
  ruleStrong: "#bfb29d",
  accent: "#d43c1e",
  accentHover: "#b83116",
  accentSoft: "#fae5df",
  accentInk: "#fffaf7",
  pine: "#1e6b4b",
  pineSoft: "#dff0e8",
  amber: "#a8640b",
  amberSoft: "#f8ecd7",
  cobalt: "#2251a6",
  cobaltSoft: "#e3ecfa",
  chip: "#e6ddd0",
  avatarBg: "#1a1714",
  avatarInk: "#fcfaf5",
  modalBackdrop: "#1a171488",
  cardShadow: "#1a171414",
  modalShadow: "#1a171438"
}

export const GRAPHITE_PALETTE: Palette = {
  canvas: "#141311",
  topbar: "#1b1916",
  lane: "#1e1b18",
  card: "#26231f",
  cardHover: "#2e2a25",
  input: "#191714",
  ink: "#f3ede3",
  inkSoft: "#c9bfb0",
  inkMuted: "#8f8577",
  rule: "#35302a",
  ruleStrong: "#4d463e",
  accent: "#ea583a",
  accentHover: "#ff6f52",
  accentSoft: "#42231c",
  accentInk: "#141311",
  pine: "#4fc590",
  pineSoft: "#1b382b",
  amber: "#ebb054",
  amberSoft: "#3a2d18",
  cobalt: "#7aa7ff",
  cobaltSoft: "#1c2a44",
  chip: "#322d27",
  avatarBg: "#f3ede3",
  avatarInk: "#141311",
  modalBackdrop: "#00000099",
  cardShadow: "#00000044",
  modalShadow: "#00000088"
}

export const paletteFor = (theme: ThemeMode): Palette =>
  theme === "paper" ? PAPER_PALETTE : GRAPHITE_PALETTE

export const priorityColors = (
  priority: Priority,
  p: Palette
): { readonly fg: string; readonly bg: string; readonly label: string } => {
  switch (priority) {
    case "high":
      return { fg: p.accent, bg: p.accentSoft, label: "HIGH" }
    case "medium":
      return { fg: p.amber, bg: p.amberSoft, label: "MED" }
    case "low":
      return { fg: p.cobalt, bg: p.cobaltSoft, label: "LOW" }
  }
}
