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
): "div" | "text" | "input" | "textarea" => {
  switch (tag) {
    case "text":
      return "text"
    case "input":
      return "input"
    case "textarea":
      return "textarea"
    default:
      return "div"
  }
}

export const normalizeKey = (raw: string | undefined): string => {
  if (!raw) return ""
  return KEY_NAME_MAP[raw.toLowerCase()] ?? raw
}

export const toPayload = (
  eventType: string,
  raw: EventPayload,
  valueOverride?: string
): unknown => {
  const mods = raw.modifiers ?? {
    shift: false,
    ctrl: false,
    alt: false,
    cmd: false
  }
  switch (eventType) {
    case "click":
    case "mouseDown":
    case "mouseUp":
      return {
        x: raw.x ?? 0,
        y: raw.y ?? 0,
        button: raw.button ?? 0,
        clickCount: raw.clickCount ?? 1,
        shift: mods.shift,
        ctrl: mods.ctrl,
        alt: mods.alt,
        meta: mods.cmd
      }
    case "mouseEnter":
    case "mouseLeave":
      return { x: raw.x ?? 0, y: raw.y ?? 0 }
    case "keyDown":
    case "keyUp":
      return {
        key: normalizeKey(raw.key),
        keyChar: raw.keyChar ?? raw.key ?? "",
        repeat: raw.isHeld ?? false,
        shift: mods.shift,
        ctrl: mods.ctrl,
        alt: mods.alt,
        meta: mods.cmd
      }
    case "change":
    case "submit":
      return { value: valueOverride ?? raw.value ?? "" }
    case "scroll":
      return { deltaX: raw.deltaX ?? 0, deltaY: raw.deltaY ?? 0 }
    default:
      return {}
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
  (style.overflow === "scroll" ||
    style.overflow === "auto" ||
    style.overflowY === "scroll" ||
    style.overflowY === "auto" ||
    style.overflowX === "scroll" ||
    style.overflowX === "auto")

export const normalizeGpuiStyle = (
  tag: string,
  raw: Record<string, unknown> | undefined,
  horizontal = false
): StyleDesc | undefined => {
  if (raw === undefined && tag !== "scroll") return undefined
  const out: Record<string, unknown> = {}

  if (tag === "box" || tag === "scroll" || tag === "button") {
    out["display"] = "flex"
    if (tag === "box" || tag === "scroll") {
      out["flexDirection"] = "column"
    }
  }
  if (tag === "scroll") {
    if (horizontal) {
      out["overflowX"] = "scroll"
    } else {
      out["overflowY"] = "scroll"
    }
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
        if (out["borderColor"] === undefined) {
          out["borderColor"] = value
        }
      } else {
        out[key] = value
      }
    }
  }

  return out as StyleDesc
}
