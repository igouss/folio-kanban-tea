export const IGNORED_UNIVERSAL_PROPS: ReadonlySet<string> = new Set([
  "hoverStyle",
  "activeStyle",
  "tabIndex",
  "autoFocus",
  "minRows",
  "maxRows",
  "aria-checked",
  "aria-selected",
  "aria-valuenow",
  "aria-valuemin",
  "aria-valuemax",
  "aria-valuetext"
])

const IGNORED_FABRIC_STYLE_KEYS: ReadonlySet<string> = new Set([
  "display",
  "cursor",
  "overflowX",
  "overflowY",
  "whiteSpace",
  "textOverflow",
  "lineClamp"
])

const TEXT_ONLY_STYLE_KEYS: ReadonlySet<string> = new Set([
  "color",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "lineHeight",
  "textAlign",
  "letterSpacing"
])

export const normalizeFabricStyle = (
  fabricName: string,
  raw: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> | undefined => {
  if (raw === undefined) return undefined
  const allowsTextStyle = fabricName === "text" || fabricName === "text-input"
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || IGNORED_FABRIC_STYLE_KEYS.has(key)) continue
    if (!allowsTextStyle && TEXT_ONLY_STYLE_KEYS.has(key)) continue
    if (key === "fontWeight" && typeof value === "number") {
      out[key] = String(value)
    } else if (key === "overflow" && (value === "auto" || value === "scroll")) {
      continue
    } else {
      out[key] = value
    }
  }
  return out
}

export const mapFabricTag = (tag: string): string => {
  switch (tag) {
    case "box":
    case "button":
    case "pressable":
      return "view"
    case "scroll":
      return "scroll-view"
    case "input":
    case "textarea":
      return "text-input"
    default:
      return tag
  }
}
