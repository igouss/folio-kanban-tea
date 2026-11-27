import type { EventPayload } from "@gpuix/native"
import type { StyleDesc } from "@gpuix/native/host"

export const INHERITED_TEXT_KEYS = [
  "color",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "textAlign",
  "lineHeight",
  "whiteSpace",
  "textOverflow",
  "lineClamp",
  "textDecoration"
] as const

export const CUSTOM_PROP_KEYS = new Set([
  "placeholder",
  "readOnly",
  "autoFocus",
  "tabIndex",
  "role",
  "aria-label",
  "aria-description",
  "aria-id",
  "aria-expanded",
  "aria-selected",
  "aria-checked",
  "aria-valuenow",
  "aria-valuemin",
  "aria-valuemax",
  "aria-valuetext",
  "aria-level",
  "testId",
  "minRows",
  "maxRows",
  "theme"
])

const KEY_NAME_MAP: Readonly<Record<string, string>> = {
  enter: "Enter",
  escape: "Escape",
  tab: "Tab",
  space: " ",
  backspace: "Backspace",
  delete: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown"
}

export const nativeTypeOf = (
  tag: string
): "div" | "text" | "input" | "textarea" =>
  tag === "text" || tag === "input" || tag === "textarea" ? tag : "div"

export const normalizeKey = (raw: string | undefined): string =>
  raw ? (KEY_NAME_MAP[raw.toLowerCase()] ?? raw) : ""

export const toKeyDownPayload = (raw: EventPayload) => {
  const mods = raw.modifiers ?? {
    shift: false,
    ctrl: false,
    alt: false,
    cmd: false
  }
  return {
    key: normalizeKey(raw.key),
    shift: mods.shift,
    ctrl: mods.ctrl,
    alt: mods.alt,
    meta: mods.cmd
  }
}

export const extractInheritedText = (
  parentText: Record<string, unknown>,
  style: StyleDesc | undefined
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...parentText }
  if (style !== undefined) {
    for (const key of INHERITED_TEXT_KEYS) {
      const value = (style as Record<string, unknown>)[key]
      if (value !== undefined) out[key] = value
    }
  }
  return out
}

export const isScrollableStyle = (style: StyleDesc | undefined): boolean =>
  style !== undefined &&
  (["overflow", "overflowY", "overflowX"] as const).some(
    (k) => style[k] === "scroll" || style[k] === "auto"
  )

export const normalizeGpuiStyle = (
  tag: string,
  raw: Record<string, unknown> | undefined,
  horizontal = false
): StyleDesc | undefined => {
  if (raw === undefined && tag !== "scroll") return undefined
  const out: Record<string, unknown> = {}

  if (tag === "box" || tag === "scroll" || tag === "button") {
    out["display"] = "flex"
    if (tag !== "button") out["flexDirection"] = "column"
  }
  if (tag === "scroll") {
    out[horizontal ? "overflowX" : "overflowY"] = "scroll"
  }

  if (raw !== undefined) {
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined) continue
      if (key === "paddingHorizontal") {
        out["paddingLeft"] = value
        out["paddingRight"] = value
      } else if (key === "paddingVertical") {
        out["paddingTop"] = value
        out["paddingBottom"] = value
      } else if (key === "marginHorizontal") {
        out["marginLeft"] = value
        out["marginRight"] = value
      } else if (key === "marginVertical") {
        out["marginTop"] = value
        out["marginBottom"] = value
      } else if (key === "flex" && typeof value === "number") {
        out["flexGrow"] = value
        out["flexShrink"] = 1
        out["flexBasis"] = 0
      } else if (key === "fontWeight" && typeof value === "string") {
        const parsed = Number(value)
        out["fontWeight"] = Number.isFinite(parsed) ? parsed : value
      } else if (key === "borderBottomColor" || key === "borderTopColor") {
        out["borderColor"] ??= value
      } else {
        out[key] = value
      }
    }
  }

  return out as StyleDesc
}
