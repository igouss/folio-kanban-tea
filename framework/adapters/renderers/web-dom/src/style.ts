import type { UiStyle } from "@universal-ui/core"

const UNITLESS_KEYS = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "opacity",
  "zIndex",
  "fontWeight"
])

const BORDER_SIDES = ["", "Top", "Bottom", "Left", "Right"] as const

const toCssValue = (key: string, value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value === "number") {
    return UNITLESS_KEYS.has(key) ? String(value) : `${value}px`
  }
  return String(value)
}

export const toCssPropertyName = (key: string): string => {
  if (key.startsWith("--")) return key
  const kebab = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
  return key.startsWith("webkit") ? `-${kebab}` : kebab
}

const DEFAULT_TAG_STYLES: Readonly<Record<string, Record<string, unknown>>> = {
  box: { display: "flex", flexDirection: "column", boxSizing: "border-box" },
  scroll: {
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
    minHeight: 0,
    boxSizing: "border-box"
  },
  button: {
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    boxSizing: "border-box"
  },
  input: { boxSizing: "border-box", font: "inherit", outline: "none" },
  textarea: { boxSizing: "border-box", font: "inherit", outline: "none" },
  text: { boxSizing: "border-box" }
}

export const uiStyleToCss = (
  tag: string,
  base: UiStyle | undefined,
  extra?: UiStyle | undefined
): Readonly<Record<string, string>> => {
  const merged: Record<string, unknown> = {
    ...(DEFAULT_TAG_STYLES[tag] ?? {})
  }

  const apply = (style: UiStyle | undefined) => {
    if (style === undefined) return
    for (const [key, raw] of Object.entries(style)) {
      if (raw === undefined) continue
      if (key === "paddingHorizontal") {
        merged["paddingLeft"] = raw
        merged["paddingRight"] = raw
      } else if (key === "paddingVertical") {
        merged["paddingTop"] = raw
        merged["paddingBottom"] = raw
      } else if (key === "marginHorizontal") {
        merged["marginLeft"] = raw
        merged["marginRight"] = raw
      } else if (key === "marginVertical") {
        merged["marginTop"] = raw
        merged["marginBottom"] = raw
      } else if (key === "flex") {
        merged["flex"] = `${raw} 1 0%`
      } else {
        merged[key] = raw
      }
    }
  }

  apply(base)
  apply(extra)

  if (tag === "button") {
    const hasBorder = BORDER_SIDES.some(
      (side) => merged[`border${side}Width`] !== undefined
    )
    if (!hasBorder) {
      merged["borderStyle"] = "none"
      merged["borderWidth"] = 0
    }
    const hasPadding = BORDER_SIDES.some(
      (side) => merged[`padding${side}`] !== undefined
    )
    if (!hasPadding) {
      merged["padding"] = 0
    }
  }

  for (const side of BORDER_SIDES) {
    const widthKey = `border${side}Width`
    const styleKey = `border${side}Style`
    if (
      typeof merged[widthKey] === "number" &&
      merged[widthKey] > 0 &&
      merged[styleKey] === undefined
    ) {
      merged[styleKey] = "solid"
    }
  }

  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(merged)) {
    const cssVal = toCssValue(key, value)
    if (cssVal !== undefined) out[key] = cssVal
  }
  return out
}
