import { Renderer } from "@effect/ui"
import type { Component, Head, View } from "@effect/ui"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { Ui, type UiStyle } from "@universal-ui/core"
import {
  initialPointerState,
  transitionPointer,
  type PointerState
} from "./fsm.ts"
import { toCssPropertyName, uiStyleToCss } from "./style.ts"

export { uiStyleToCss }

const CONTROLLED_PROPS: ReadonlySet<string> = new Set(["value"])

export interface WebDomStyle {
  setProperty(name: string, value: string): void
  removeProperty(name: string): string
}

export interface WebDomEvent {
  preventDefault(): void
  readonly key?: string | undefined
  readonly shiftKey?: boolean | undefined
  readonly ctrlKey?: boolean | undefined
  readonly altKey?: boolean | undefined
  readonly metaKey?: boolean | undefined
}

export type WebDomEventListener = (event: WebDomEvent) => void

export interface WebDomNode {
  readonly parentNode: WebDomNode | null
  readonly nextSibling: WebDomNode | null
  readonly childNodes: ArrayLike<WebDomNode>
  nodeValue: string | null
  insertBefore(child: WebDomNode, ref: WebDomNode | null): unknown
  removeChild(child: WebDomNode): unknown
}

export interface WebDomElement extends WebDomNode {
  readonly isConnected: boolean
  readonly style: WebDomStyle
  disabled?: boolean
  value?: string
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  addEventListener(type: string, listener: WebDomEventListener): void
  removeEventListener(type: string, listener: WebDomEventListener): void
  focus(): void
}

export interface WebDomDocument {
  title: string
  createElement(tag: string): WebDomElement
  createTextNode(text: string): WebDomNode
  createDocumentFragment(): WebDomNode
  startViewTransition?(callback: () => void): unknown
}

export interface WebDomContainer extends WebDomNode {
  readonly ownerDocument: WebDomDocument | null
}

const isWebDomElement = (node: WebDomNode): node is WebDomElement =>
  "setAttribute" in node && "style" in node

interface NodeMeta {
  readonly uiTag: string
  baseStyle: UiStyle | undefined
  hoverStyle: UiStyle | undefined
  activeStyle: UiStyle | undefined
  pointer: PointerState
  horizontal: boolean
  numberOfLines: number | undefined
  appliedCssKeys: Set<string>
  handlers: Readonly<Record<string, View.Handler<unknown, any>>>
  dispatch: Renderer.Dispatch | undefined
  listeners: Map<string, WebDomEventListener>
}

export interface WebHostHandle {
  readonly host: Renderer.Host<WebDomNode>
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

export const makeHost = (doc: WebDomDocument): WebHostHandle => {
  const metas = new WeakMap<WebDomNode, NodeMeta>()
  const trackedNodes = new Set<WebDomNode>()

  const applyCss = (el: WebDomElement, meta: NodeMeta): void => {
    let extra: UiStyle | undefined
    switch (meta.pointer._tag) {
      case "Pressed":
        extra = meta.activeStyle ?? meta.hoverStyle
        break
      case "Hovered":
        extra = meta.hoverStyle
        break
      case "Idle":
      case "Disabled":
        extra = undefined
        break
      default: {
        const _exhaustive: never = meta.pointer
        extra = _exhaustive
      }
    }
    const next: Record<string, string> = {
      ...uiStyleToCss(meta.uiTag, meta.baseStyle, extra)
    }
    if (meta.uiTag === "scroll" && meta.horizontal) {
      next["overflowX"] = "auto"
      next["overflowY"] = "hidden"
    }
    if (meta.pointer._tag === "Disabled") {
      next["cursor"] = "not-allowed"
    }
    if (meta.uiTag === "text" && meta.numberOfLines !== undefined) {
      next["display"] = "-webkit-box"
      next["webkitLineClamp"] = String(meta.numberOfLines)
      next["webkitBoxOrient"] = "vertical"
      next["overflow"] = "hidden"
    }

    const nextProps = new Map<string, string>()
    for (const [key, value] of Object.entries(next)) {
      nextProps.set(toCssPropertyName(key), value)
    }
    for (const prevProp of meta.appliedCssKeys) {
      if (!nextProps.has(prevProp)) {
        el.style.removeProperty(prevProp)
      }
    }
    meta.appliedCssKeys.clear()
    for (const [prop, value] of nextProps) {
      el.style.setProperty(prop, value)
      meta.appliedCssKeys.add(prop)
    }
  }

  const ensureInteractionListeners = (
    el: WebDomElement,
    meta: NodeMeta
  ): void => {
    const needsHover = meta.hoverStyle !== undefined
    const needsActive = meta.activeStyle !== undefined

    if (needsHover && !meta.listeners.has("__hoverEnter")) {
      const onEnter: WebDomEventListener = () => {
        meta.pointer = transitionPointer(meta.pointer, "enter")
        applyCss(el, meta)
      }
      const onLeave: WebDomEventListener = () => {
        meta.pointer = transitionPointer(meta.pointer, "leave")
        applyCss(el, meta)
      }
      el.addEventListener("mouseenter", onEnter)
      el.addEventListener("mouseleave", onLeave)
      meta.listeners.set("__hoverEnter", onEnter)
      meta.listeners.set("__hoverLeave", onLeave)
    }

    if (needsActive && !meta.listeners.has("__activeDown")) {
      const onDown: WebDomEventListener = () => {
        meta.pointer = transitionPointer(meta.pointer, "down")
        applyCss(el, meta)
      }
      const onUp: WebDomEventListener = () => {
        meta.pointer = transitionPointer(meta.pointer, "up")
        applyCss(el, meta)
      }
      el.addEventListener("mousedown", onDown)
      el.addEventListener("mouseup", onUp)
      meta.listeners.set("__activeDown", onDown)
      meta.listeners.set("__activeUp", onUp)
    }
  }

  const cleanupNode = (node: WebDomNode): void => {
    const meta = metas.get(node)
    if (meta !== undefined && isWebDomElement(node)) {
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
        node.removeEventListener(domEvent, listener)
      }
      meta.listeners.clear()
      metas.delete(node)
      trackedNodes.delete(node)
    }
    for (const child of Array.from(node.childNodes)) {
      cleanupNode(child)
    }
  }

  const host: Renderer.Host<WebDomNode> = {
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
        pointer: initialPointerState,
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
      if (!isWebDomElement(node)) return
      if (value === undefined) node.removeAttribute(attrName)
      else node.setAttribute(attrName, value)
    },

    setProp(node, propName, value) {
      if (!isWebDomElement(node)) return
      const el = node
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
          meta.pointer = transitionPointer(meta.pointer, flag ? "disable" : "enable")
          applyCss(el, meta)
        }
        if ("disabled" in el) {
          el.disabled = flag
        }
        if (flag) el.setAttribute("aria-disabled", "true")
        else el.removeAttribute("aria-disabled")
        return
      }
      if (propName === "value") {
        const desired = typeof value === "string" ? value : ""
        if ("value" in el && el.value !== desired) {
          el.value = desired
        }
        return
      }
      if (propName === "placeholder") {
        if (typeof value === "string") el.setAttribute("placeholder", value)
        else el.removeAttribute("placeholder")
        return
      }
      if (propName === "placeholderTextColor") {
        if (typeof value === "string") {
          el.style.setProperty("--placeholder-color", value)
        } else {
          el.style.removeProperty("--placeholder-color")
        }
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
      if (!isWebDomElement(node)) return
      const el = node
      const meta = metas.get(node)
      if (meta === undefined) return
      meta.handlers = handlers
      meta.dispatch = dispatch

      const ensureListener = (
        domEvent: string,
        active: boolean,
        listener: WebDomEventListener
      ) => {
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
        if (meta.pointer._tag === "Disabled" || meta.dispatch === undefined) return
        const h = meta.handlers["press"]
        if (h !== undefined) meta.dispatch("press", h, {})
      })

      ensureListener("input", handlers["changeText"] !== undefined, () => {
        if (meta.dispatch === undefined) return
        const h = meta.handlers["changeText"]
        if (h !== undefined) {
          const text = "value" in el && el.value !== undefined ? String(el.value) : ""
          meta.dispatch("changeText", h, { text })
        }
      })

      const needsKeyDown =
        handlers["keyDown"] !== undefined || handlers["submit"] !== undefined
      ensureListener("keydown", needsKeyDown, (ke) => {
        if (meta.dispatch === undefined) return
        if (ke.key === "Enter" && meta.handlers["submit"] !== undefined) {
          ke.preventDefault()
          const text = "value" in el && el.value !== undefined ? String(el.value) : ""
          meta.dispatch("submit", meta.handlers["submit"], { text })
          return
        }
        const h = meta.handlers["keyDown"]
        if (h !== undefined) {
          meta.dispatch("keyDown", h, {
            key: ke.key ?? "",
            shift: ke.shiftKey === true,
            ctrl: ke.ctrlKey === true,
            alt: ke.altKey === true,
            meta: ke.metaKey === true
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
      if (typeof doc.startViewTransition === "function") {
        doc.startViewTransition(update)
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

const makeScopedHost = (doc: WebDomDocument) =>
  Effect.gen(function* () {
    const handle = makeHost(doc)
    yield* Effect.addFinalizer(() => Effect.sync(handle.dispose))
    const context = Context.make(Renderer.Renderer, { host: handle.host }).pipe(
      Context.add(Ui.Host, { platform: "web" })
    )
    return { handle, context }
  })

export const layer = (
  doc: WebDomDocument
): Layer.Layer<Renderer.Renderer | Ui.Host> =>
  Layer.effectContext(Effect.map(makeScopedHost(doc), ({ context }) => context))

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
  container: WebDomContainer
): Effect.Effect<
  Renderer.Root<Model, Msg>,
  never,
  Exclude<
    R | RP | Renderer.HostOf<V>,
    Ui.Host | Renderer.Renderer
  > | Scope.Scope
> =>
  Effect.gen(function* () {
    const doc = container.ownerDocument ?? document
    const { context } = yield* makeScopedHost(doc)
    return yield* Ui.mountWithHost(component, props, container, context)
  })

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
  container: WebDomContainer
): Layer.Layer<
  never,
  never,
  Exclude<
    Exclude<R | RP | Renderer.HostOf<V>, Ui.Host | Renderer.Renderer>,
    Scope.Scope
  >
> => Layer.effectDiscard(mountEffect(component, props, container))
