import type { UiStyle } from "@universal-ui/core"

const UNITLESS_KEYS = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "opacity",
  "zIndex",
  "fontWeight"
])

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

export const uiStyleToCss = (
  tag: string,
  base: UiStyle | undefined,
  extra?: UiStyle | undefined
): Readonly<Record<string, string>> => {
  const merged: Record<string, unknown> = {}

  if (tag === "box") {
    merged["display"] = "flex"
    merged["flexDirection"] = "column"
    merged["boxSizing"] = "border-box"
  } else if (tag === "scroll") {
    merged["display"] = "flex"
    merged["flexDirection"] = "column"
    merged["overflow"] = "auto"
    merged["minHeight"] = 0
    merged["boxSizing"] = "border-box"
  } else if (tag === "button") {
    merged["display"] = "inline-flex"
    merged["flexDirection"] = "row"
    merged["alignItems"] = "center"
    merged["justifyContent"] = "center"
    merged["backgroundColor"] = "transparent"
    merged["font"] = "inherit"
    merged["color"] = "inherit"
    merged["cursor"] = "pointer"
    merged["boxSizing"] = "border-box"
  } else if (tag === "input" || tag === "textarea") {
    merged["boxSizing"] = "border-box"
    merged["font"] = "inherit"
    merged["outline"] = "none"
  } else if (tag === "text") {
    merged["boxSizing"] = "border-box"
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
    const hasBorder =
      merged["borderWidth"] !== undefined ||
      merged["borderTopWidth"] !== undefined ||
      merged["borderRightWidth"] !== undefined ||
      merged["borderBottomWidth"] !== undefined ||
      merged["borderLeftWidth"] !== undefined
    if (!hasBorder) {
      merged["borderStyle"] = "none"
      merged["borderWidth"] = 0
    }
    const hasPadding =
      merged["padding"] !== undefined ||
      merged["paddingTop"] !== undefined ||
      merged["paddingRight"] !== undefined ||
      merged["paddingBottom"] !== undefined ||
      merged["paddingLeft"] !== undefined
    if (!hasPadding) {
      merged["padding"] = 0
    }
  }

  if (
    typeof merged["borderWidth"] === "number" &&
    merged["borderWidth"] > 0 &&
    merged["borderStyle"] === undefined
  ) {
    merged["borderStyle"] = "solid"
  }
  if (
    typeof merged["borderTopWidth"] === "number" &&
    merged["borderTopWidth"] > 0 &&
    merged["borderTopStyle"] === undefined
  ) {
    merged["borderTopStyle"] = "solid"
  }
  if (
    typeof merged["borderBottomWidth"] === "number" &&
    merged["borderBottomWidth"] > 0 &&
    merged["borderBottomStyle"] === undefined
  ) {
    merged["borderBottomStyle"] = "solid"
  }
  if (
    typeof merged["borderLeftWidth"] === "number" &&
    merged["borderLeftWidth"] > 0 &&
    merged["borderLeftStyle"] === undefined
  ) {
    merged["borderLeftStyle"] = "solid"
  }
  if (
    typeof merged["borderRightWidth"] === "number" &&
    merged["borderRightWidth"] > 0 &&
    merged["borderRightStyle"] === undefined
  ) {
    merged["borderRightStyle"] = "solid"
  }

  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(merged)) {
    const cssVal = toCssValue(key, value)
    if (cssVal !== undefined) out[key] = cssVal
  }
  return out
}
