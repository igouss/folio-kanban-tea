import { Renderer } from "@effect/ui"
import type { Component, Head, View } from "@effect/ui"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { Ui, type UiStyle } from "@universal-ui/core"

const CONTROLLED_PROPS: ReadonlySet<string> = new Set(["value"])

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

interface NodeMeta {
  readonly uiTag: string
  baseStyle: UiStyle | undefined
  hoverStyle: UiStyle | undefined
  activeStyle: UiStyle | undefined
  hovered: boolean
  pressed: boolean
  disabled: boolean
  horizontal: boolean
  numberOfLines: number | undefined
  appliedCssKeys: Set<string>
  handlers: Readonly<Record<string, View.Handler<unknown, any>>>
  dispatch: Renderer.Dispatch | undefined
  listeners: Map<string, EventListener>
}

export interface WebHostHandle {
  readonly host: Renderer.Host<globalThis.Node>
  readonly dispose: () => void
}

const domTagFor = (uiTag: string): string => {
  switch (uiTag) {
    case "button":
      return "button"
    case "text":
      return "span"
    case "input":
      return "input"
    case "textarea":
      return "textarea"
    default:
      return "div"
  }
}

export const makeHost = (doc: Document): WebHostHandle => {
  const metas = new WeakMap<globalThis.Node, NodeMeta>()
  const trackedNodes = new Set<globalThis.Node>()

  const applyCss = (el: HTMLElement, meta: NodeMeta): void => {
    const extra: UiStyle | undefined =
      meta.pressed && meta.activeStyle !== undefined
        ? meta.activeStyle
        : meta.hovered && meta.hoverStyle !== undefined
          ? meta.hoverStyle
          : undefined
    const next = uiStyleToCss(meta.uiTag, meta.baseStyle, extra)
    if (meta.uiTag === "scroll" && meta.horizontal) {
      ;(next as Record<string, string>)["overflowX"] = "auto"
      ;(next as Record<string, string>)["overflowY"] = "hidden"
    }
    if (meta.disabled) {
      ;(next as Record<string, string>)["cursor"] = "not-allowed"
    }
    if (meta.uiTag === "text" && meta.numberOfLines !== undefined) {
      const mutable = next as Record<string, string>
      mutable["display"] = "-webkit-box"
      mutable["webkitLineClamp"] = String(meta.numberOfLines)
      mutable["webkitBoxOrient"] = "vertical"
      mutable["overflow"] = "hidden"
    }

    const styleDecl = el.style as unknown as Record<string, string>
    for (const prevKey of meta.appliedCssKeys) {
      if (!(prevKey in next)) {
        styleDecl[prevKey] = ""
      }
    }
    meta.appliedCssKeys.clear()
    for (const [key, value] of Object.entries(next)) {
      styleDecl[key] = value
      meta.appliedCssKeys.add(key)
    }
  }

  const ensureInteractionListeners = (el: HTMLElement, meta: NodeMeta): void => {
    const needsHover = meta.hoverStyle !== undefined
    const needsActive = meta.activeStyle !== undefined

    if (needsHover && !meta.listeners.has("__hoverEnter")) {
      const onEnter: EventListener = () => {
        meta.hovered = true
        applyCss(el, meta)
      }
      const onLeave: EventListener = () => {
        meta.hovered = false
        meta.pressed = false
        applyCss(el, meta)
      }
      el.addEventListener("mouseenter", onEnter)
      el.addEventListener("mouseleave", onLeave)
      meta.listeners.set("__hoverEnter", onEnter)
      meta.listeners.set("__hoverLeave", onLeave)
    }

    if (needsActive && !meta.listeners.has("__activeDown")) {
      const onDown: EventListener = () => {
        meta.pressed = true
        applyCss(el, meta)
      }
      const onUp: EventListener = () => {
        meta.pressed = false
        applyCss(el, meta)
      }
      el.addEventListener("mousedown", onDown)
      el.addEventListener("mouseup", onUp)
      meta.listeners.set("__activeDown", onDown)
      meta.listeners.set("__activeUp", onUp)
    }
  }

  const cleanupNode = (node: globalThis.Node): void => {
    const meta = metas.get(node)
    if (meta !== undefined && "removeEventListener" in node) {
      const el = node as HTMLElement
      for (const [key, listener] of meta.listeners) {
        const domEvent =
          key === "__hoverEnter"
            ? "mouseenter"
            : key === "__hoverLeave"
              ? "mouseleave"
              : key === "__activeDown"
                ? "mousedown"
                : key === "__activeUp"
                  ? "mouseup"
                  : key
        el.removeEventListener(domEvent, listener)
      }
      meta.listeners.clear()
      metas.delete(node)
      trackedNodes.delete(node)
    }
    for (const child of Array.from(node.childNodes)) {
      cleanupNode(child)
    }
  }

  const host: Renderer.Host<globalThis.Node> = {
    createElement(tag) {
      const el = doc.createElement(domTagFor(tag))
      if (tag === "button") {
        el.setAttribute("type", "button")
      } else if (tag === "input") {
        el.setAttribute("type", "text")
      }
      const meta: NodeMeta = {
        uiTag: tag,
        baseStyle: undefined,
        hoverStyle: undefined,
        activeStyle: undefined,
        hovered: false,
        pressed: false,
        disabled: false,
        horizontal: false,
        numberOfLines: undefined,
        appliedCssKeys: new Set(),
        handlers: {},
        dispatch: undefined,
        listeners: new Map()
      }
      metas.set(el, meta)
      trackedNodes.add(el)
      applyCss(el, meta)
      return el
    },

    createText(text) {
      return doc.createTextNode(text)
    },

    createContainer() {
      return doc.createDocumentFragment()
    },

    setText(node, text) {
      if (node.nodeValue !== text) {
        node.nodeValue = text
      }
    },

    setAttr(node, attrName, value) {
      if (!("setAttribute" in node)) return
      const el = node as HTMLElement
      if (value === undefined) el.removeAttribute(attrName)
      else el.setAttribute(attrName, value)
    },

    setProp(node, propName, value) {
      if (!("setAttribute" in node)) return
      const el = node as HTMLElement
      const meta = metas.get(node)

      if (propName === "style" && meta !== undefined) {
        meta.baseStyle = value as UiStyle | undefined
        applyCss(el, meta)
        return
      }
      if (propName === "hoverStyle" && meta !== undefined) {
        meta.hoverStyle = value as UiStyle | undefined
        ensureInteractionListeners(el, meta)
        return
      }
      if (propName === "activeStyle" && meta !== undefined) {
        meta.activeStyle = value as UiStyle | undefined
        ensureInteractionListeners(el, meta)
        return
      }
      if (propName === "horizontal" && meta !== undefined) {
        meta.horizontal = Boolean(value)
        applyCss(el, meta)
        return
      }
      if (propName === "numberOfLines" && meta !== undefined) {
        meta.numberOfLines = typeof value === "number" ? value : undefined
        applyCss(el, meta)
        return
      }
      if (propName === "testId") {
        if (typeof value === "string" && value.length > 0) {
          el.setAttribute("data-testid", value)
        } else {
          el.removeAttribute("data-testid")
        }
        return
      }
      if (propName === "disabled") {
        const flag = Boolean(value)
        if (meta !== undefined) {
          meta.disabled = flag
          applyCss(el, meta)
        }
        if ("disabled" in el) {
          ;(el as HTMLButtonElement).disabled = flag
        }
        if (flag) el.setAttribute("aria-disabled", "true")
        else el.removeAttribute("aria-disabled")
        return
      }
      if (propName === "value") {
        const desired = typeof value === "string" ? value : ""
        if ("value" in el && (el as HTMLInputElement).value !== desired) {
          ;(el as HTMLInputElement).value = desired
        }
        return
      }
      if (propName === "placeholder") {
        if (typeof value === "string") el.setAttribute("placeholder", value)
        else el.removeAttribute("placeholder")
        return
      }
      if (propName === "minRows" && meta?.uiTag === "textarea") {
        if (typeof value === "number") el.setAttribute("rows", String(value))
        return
      }
      if (propName === "autoFocus" && value === true) {
        el.setAttribute("autofocus", "")
        queueMicrotask(() => {
          if (el.isConnected) el.focus()
        })
        return
      }
      if (
        propName === "role" ||
        propName === "tabIndex" ||
        propName.startsWith("aria-")
      ) {
        const attrKey = propName === "tabIndex" ? "tabindex" : propName
        if (value === undefined || value === null) {
          el.removeAttribute(attrKey)
        } else {
          el.setAttribute(attrKey, String(value))
        }
      }
    },

    insertBefore(parent, node, ref) {
      parent.insertBefore(node, ref ?? null)
    },

    remove(node) {
      const parent = node.parentNode
      if (parent !== null) parent.removeChild(node)
      cleanupNode(node)
    },

    parentOf(node) {
      return node.parentNode ?? undefined
    },

    nextOf(node) {
      return node.nextSibling ?? undefined
    },

    setEvents(node, handlers, dispatch) {
      if (!("addEventListener" in node)) return
      const el = node as HTMLElement
      const meta = metas.get(node)
      if (meta === undefined) return
      meta.handlers = handlers
      meta.dispatch = dispatch

      const ensureListener = (domEvent: string, active: boolean, listener: EventListener) => {
        const existing = meta.listeners.get(domEvent)
        if (active && existing === undefined) {
          el.addEventListener(domEvent, listener)
          meta.listeners.set(domEvent, listener)
        } else if (!active && existing !== undefined) {
          el.removeEventListener(domEvent, existing)
          meta.listeners.delete(domEvent)
        }
      }

      ensureListener("click", handlers["press"] !== undefined, () => {
        if (meta.disabled || meta.dispatch === undefined) return
        const h = meta.handlers["press"]
        if (h !== undefined) meta.dispatch("press", h, {})
      })

      ensureListener("input", handlers["changeText"] !== undefined, () => {
        if (meta.dispatch === undefined) return
        const h = meta.handlers["changeText"]
        if (h !== undefined) {
          const text = "value" in el ? String((el as HTMLInputElement).value) : ""
          meta.dispatch("changeText", h, { text })
        }
      })

      const needsKeyDown =
        handlers["keyDown"] !== undefined || handlers["submit"] !== undefined
      ensureListener("keydown", needsKeyDown, (event) => {
        if (meta.dispatch === undefined) return
        const ke = event as KeyboardEvent
        if (ke.key === "Enter" && meta.handlers["submit"] !== undefined) {
          ke.preventDefault()
          const text = "value" in el ? String((el as HTMLInputElement).value) : ""
          meta.dispatch("submit", meta.handlers["submit"], { text })
          return
        }
        const h = meta.handlers["keyDown"]
        if (h !== undefined) {
          meta.dispatch("keyDown", h, {
            key: ke.key,
            shift: ke.shiftKey,
            ctrl: ke.ctrlKey,
            alt: ke.altKey,
            meta: ke.metaKey
          })
        }
      })
    },

    elements: [Ui.name],
    controlled: CONTROLLED_PROPS,
    runsMounts: true,

    head(folded: Head.Head) {
      if (folded.title !== undefined) {
        doc.title = folded.title
      }
    },

    viewTransition(update) {
      const d = doc as Document & {
        startViewTransition?: (cb: () => void) => unknown
      }
      if (typeof d.startViewTransition === "function") {
        d.startViewTransition(update)
      } else {
        update()
      }
    }
  }

  const dispose = (): void => {
    for (const node of [...trackedNodes]) {
      cleanupNode(node)
    }
  }

  return { host, dispose }
}

export const mountEffect = <
  Name extends string,
  Props,
  Model,
  Msg,
  Events,
  R,
  V extends View.Elements,
  RP = never
>(
  component: Component.Members<Name, Props, Model, Msg, Events, R, V, any>,
  props: Props | Effect.Effect<Props, never, RP>,
  container: globalThis.Element
): Effect.Effect<
  Renderer.Root<Model, Msg>,
  never,
  Exclude<R | RP, Ui.Host | Renderer.Renderer> | Scope.Scope
> =>
  Effect.gen(function* () {
    const doc = container.ownerDocument ?? document
    const handle = makeHost(doc)
    yield* Effect.addFinalizer(() => Effect.sync(handle.dispose))
    const ctx = Context.make(Renderer.Renderer, { host: handle.host }).pipe(
      Context.add(Ui.Host, { platform: "web" })
    )
    return yield* (Renderer.mount(
      component as any,
      props as any,
      container
    ) as Effect.Effect<Renderer.Root<Model, Msg>, never, any>).pipe(
      Effect.provideContext(ctx)
    )
  }) as any

export const mount = <
  Name extends string,
  Props,
  Model,
  Msg,
  Events,
  R,
  V extends View.Elements,
  RP = never
>(
  component: Component.Members<Name, Props, Model, Msg, Events, R, V, any>,
  props: Props | Effect.Effect<Props, never, RP>,
  container: globalThis.Element
): Layer.Layer<never, never, Exclude<R | RP, Ui.Host | Renderer.Renderer>> =>
  Layer.effectDiscard(mountEffect(component, props, container)) as any
