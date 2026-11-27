import type { Component, Head, Renderer, View } from "@effect/ui"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { Ui, type UiStyle } from "@universal-ui/core"
import {
  initialPointerState,
  transitionPointer,
  type PointerEvent,
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

const DOM_TAGS: Readonly<Record<string, string>> = {
  button: "button",
  text: "span",
  input: "input",
  textarea: "textarea"
}

export const makeHost = (doc: WebDomDocument): WebHostHandle => {
  const metas = new WeakMap<WebDomNode, NodeMeta>()
  const trackedNodes = new Set<WebDomNode>()

  const setOrRemoveAttr = (
    el: WebDomElement,
    key: string,
    value: string | undefined
  ): void => {
    if (value === undefined) el.removeAttribute(key)
    else el.setAttribute(key, value)
  }

  const syncListener = (
    el: WebDomElement,
    meta: NodeMeta,
    domEvent: string,
    active: boolean,
    listener: WebDomEventListener
  ): void => {
    const existing = meta.listeners.get(domEvent)
    if (active && existing === undefined) {
      el.addEventListener(domEvent, listener)
      meta.listeners.set(domEvent, listener)
    } else if (!active && existing !== undefined) {
      el.removeEventListener(domEvent, existing)
      meta.listeners.delete(domEvent)
    }
  }

  const applyCss = (el: WebDomElement, meta: NodeMeta): void => {
    const extra =
      meta.pointer._tag === "Pressed"
        ? (meta.activeStyle ?? meta.hoverStyle)
        : meta.pointer._tag === "Hovered"
          ? meta.hoverStyle
          : undefined

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
      if (!nextProps.has(prevProp)) el.style.removeProperty(prevProp)
    }
    meta.appliedCssKeys.clear()
    for (const [prop, value] of nextProps) {
      el.style.setProperty(prop, value)
      meta.appliedCssKeys.add(prop)
    }
  }

  const bindPointerEvents = (
    el: WebDomElement,
    meta: NodeMeta,
    pairs: ReadonlyArray<readonly [string, PointerEvent]>
  ): void => {
    for (const [domEvent, pointerEvent] of pairs) {
      syncListener(el, meta, domEvent, true, () => {
        meta.pointer = transitionPointer(meta.pointer, pointerEvent)
        applyCss(el, meta)
      })
    }
  }

  const cleanupNode = (node: WebDomNode): void => {
    const meta = metas.get(node)
    if (meta !== undefined && isWebDomElement(node)) {
      for (const [domEvent, listener] of meta.listeners) {
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
      const el = doc.createElement(DOM_TAGS[tag] ?? "div")
      if (tag === "button") el.setAttribute("type", "button")
      else if (tag === "input") el.setAttribute("type", "text")
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

    createText: (text) => doc.createTextNode(text),
    createContainer: () => doc.createDocumentFragment(),

    setText(node, text) {
      if (node.nodeValue !== text) node.nodeValue = text
    },

    setAttr(node, attrName, value) {
      if (isWebDomElement(node)) setOrRemoveAttr(node, attrName, value)
    },

    setProp(node, propName, value) {
      if (!isWebDomElement(node)) return
      const meta = metas.get(node)

      switch (propName) {
        case "style":
          if (meta !== undefined) {
            meta.baseStyle = value as UiStyle | undefined
            applyCss(node, meta)
          }
          return
        case "hoverStyle":
          if (meta !== undefined) {
            meta.hoverStyle = value as UiStyle | undefined
            if (meta.hoverStyle !== undefined) {
              bindPointerEvents(node, meta, [
                ["mouseenter", "enter"],
                ["mouseleave", "leave"]
              ])
            }
          }
          return
        case "activeStyle":
          if (meta !== undefined) {
            meta.activeStyle = value as UiStyle | undefined
            if (meta.activeStyle !== undefined) {
              bindPointerEvents(node, meta, [
                ["mousedown", "down"],
                ["mouseup", "up"]
              ])
            }
          }
          return
        case "horizontal":
          if (meta !== undefined) {
            meta.horizontal = Boolean(value)
            applyCss(node, meta)
          }
          return
        case "numberOfLines":
          if (meta !== undefined) {
            meta.numberOfLines = typeof value === "number" ? value : undefined
            applyCss(node, meta)
          }
          return
        case "testId":
          setOrRemoveAttr(
            node,
            "data-testid",
            typeof value === "string" && value.length > 0 ? value : undefined
          )
          return
        case "disabled": {
          const flag = Boolean(value)
          if (meta !== undefined) {
            meta.pointer = transitionPointer(meta.pointer, flag ? "disable" : "enable")
            applyCss(node, meta)
          }
          if ("disabled" in node) node.disabled = flag
          setOrRemoveAttr(node, "aria-disabled", flag ? "true" : undefined)
          return
        }
        case "value": {
          const desired = typeof value === "string" ? value : ""
          if ("value" in node && node.value !== desired) node.value = desired
          return
        }
        case "placeholder":
          setOrRemoveAttr(
            node,
            "placeholder",
            typeof value === "string" ? value : undefined
          )
          return
        case "placeholderTextColor":
          if (typeof value === "string") {
            node.style.setProperty("--placeholder-color", value)
          } else {
            node.style.removeProperty("--placeholder-color")
          }
          return
        case "minRows":
          if (meta?.uiTag === "textarea" && typeof value === "number") {
            node.setAttribute("rows", String(value))
          }
          return
        case "autoFocus":
          if (value === true) {
            node.setAttribute("autofocus", "")
            queueMicrotask(() => {
              if (node.isConnected) node.focus()
            })
          }
          return
        default:
          if (
            propName === "role" ||
            propName === "tabIndex" ||
            propName.startsWith("aria-")
          ) {
            const attrKey = propName === "tabIndex" ? "tabindex" : propName
            setOrRemoveAttr(
              node,
              attrKey,
              value === undefined || value === null ? undefined : String(value)
            )
          }
      }
    },

    insertBefore(parent, node, ref) {
      parent.insertBefore(node, ref ?? null)
    },

    remove(node) {
      node.parentNode?.removeChild(node)
      cleanupNode(node)
    },

    parentOf: (node) => node.parentNode ?? undefined,
    nextOf: (node) => node.nextSibling ?? undefined,

    setEvents(node, handlers, dispatch) {
      if (!isWebDomElement(node)) return
      const meta = metas.get(node)
      if (meta === undefined) return
      meta.handlers = handlers
      meta.dispatch = dispatch

      const readInputText = () =>
        "value" in node && node.value !== undefined ? String(node.value) : ""

      syncListener(node, meta, "click", handlers["press"] !== undefined, () => {
        if (meta.pointer._tag === "Disabled" || meta.dispatch === undefined) return
        const h = meta.handlers["press"]
        if (h !== undefined) meta.dispatch("press", h, {})
      })

      syncListener(
        node,
        meta,
        "input",
        handlers["changeText"] !== undefined,
        () => {
          const h = meta.handlers["changeText"]
          if (h !== undefined && meta.dispatch !== undefined) {
            meta.dispatch("changeText", h, { text: readInputText() })
          }
        }
      )

      syncListener(
        node,
        meta,
        "keydown",
        handlers["keyDown"] !== undefined || handlers["submit"] !== undefined,
        (ke) => {
          if (meta.dispatch === undefined) return
          if (ke.key === "Enter" && meta.handlers["submit"] !== undefined) {
            ke.preventDefault()
            meta.dispatch("submit", meta.handlers["submit"], {
              text: readInputText()
            })
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
        }
      )
    },

    elements: [Ui.name],
    controlled: CONTROLLED_PROPS,
    runsMounts: true,

    head(folded: Head.Head) {
      if (folded.title !== undefined) doc.title = folded.title
    },

    viewTransition(update) {
      if (typeof doc.startViewTransition === "function") {
        doc.startViewTransition(update)
      } else {
        update()
      }
    }
  }

  return {
    host,
    dispose: () => {
      for (const node of [...trackedNodes]) cleanupNode(node)
    }
  }
}

export const layer = (
  doc: WebDomDocument
): Layer.Layer<Renderer.Renderer | Ui.Host> =>
  Layer.effectContext(
    Effect.map(
      Ui.makeScopedHost("web", () => makeHost(doc)),
      ({ context }) => context
    )
  )

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
    const { context } = yield* Ui.makeScopedHost("web", () => makeHost(doc))
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
