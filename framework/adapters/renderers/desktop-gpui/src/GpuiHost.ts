import type { Head, Renderer, View } from "@effect/ui"
import { Ui } from "@universal-ui/core"
import type { EventPayload } from "@gpuix/native"
import {
  createMutationQueue,
  createRendererState,
  registerEventHandler,
  unregisterEventHandlers,
  type NativeRenderer,
  type StyleDesc
} from "@gpuix/native/host"
import type * as Context from "effect/Context"
import * as Gpui from "./Gpui.ts"
import {
  CUSTOM_PROP_KEYS,
  INHERITED_TEXT_KEYS,
  extractInheritedText,
  isScrollableStyle,
  nativeTypeOf,
  normalizeGpuiStyle,
  toPayload
} from "./events.ts"

import {
  completeInputNudge,
  initialInputValueState,
  readSubmittedInputValue,
  receiveNativeInputValue,
  syncDesiredInputValue,
  type InputValueState
} from "./fsm.ts"

const CONTROLLED_PROPS: ReadonlySet<string> = new Set(["value"])

export interface GpuiNode extends Gpui.GpuiNodeHandle {
  readonly kind: "root" | "element" | "text"
  readonly nativeType: "div" | "text" | "input" | "textarea"
  parent: GpuiNode | undefined
  readonly children: Array<GpuiNode>
  text: string
  ownStyle: StyleDesc | undefined
  rawStyle: Record<string, unknown> | undefined
  hoverStyle: Omit<StyleDesc, "hover" | "active"> | undefined
  activeStyle: Omit<StyleDesc, "hover" | "active"> | undefined
  inheritedText: Record<string, unknown>
  lastSentStyleJson: string
  customProps: Map<string, unknown>
  handlers: Readonly<Record<string, View.Handler<unknown, any>>>
  dispatch: Renderer.Dispatch | undefined
  nativeListeners: Set<string>
  inputValue: InputValueState
  isInteractive: boolean
  disabled: boolean
  horizontal: boolean
  detached: boolean
}

const isClickableAncestor = (node: GpuiNode): boolean => {
  for (let cur = node.parent; cur !== undefined; cur = cur.parent) {
    if (cur.isInteractive) return true
  }
  return false
}

export interface GpuiHostHandle {
  readonly host: Renderer.Host<GpuiNode>
  readonly rootContainer: GpuiNode
  readonly service: Context.Service.Shape<typeof Gpui.Host>
  readonly flush: () => void
  readonly dispose: () => void
}

export const makeHost = (renderer: NativeRenderer): GpuiHostHandle => {
  const rendererState = createRendererState(renderer)
  const eventHandlers = new Map<number, Map<string, (event: EventPayload) => void>>()
  const binding = rendererState.attach({ eventHandlers })

  const nodes = new Map<number, GpuiNode>()
  let nextId = 1_000_000

  const mutations = createMutationQueue(renderer, (destroyedIds) => {
    for (const id of destroyedIds) {
      unregisterEventHandlers(eventHandlers, id)
      nodes.delete(id)
    }
  })

  const makeNode = (
    kind: GpuiNode["kind"],
    tag: string,
    text = ""
  ): GpuiNode => {
    const id = nextId++
    const nativeType = kind === "text" ? "text" : nativeTypeOf(tag)
    const node: GpuiNode = {
      id,
      kind,
      tag,
      nativeType,
      parent: undefined,
      children: [],
      text,
      ownStyle: tag === "scroll" ? normalizeGpuiStyle(tag, undefined, false) : undefined,
      rawStyle: undefined,
      hoverStyle: undefined,
      activeStyle: undefined,
      inheritedText: {},
      lastSentStyleJson: "",
      customProps: new Map(),
      handlers: {},
      dispatch: undefined,
      nativeListeners: new Set(),
      inputValue: initialInputValueState,
      isInteractive: tag === "button",
      disabled: false,
      horizontal: false,
      detached: false
    }
    nodes.set(id, node)
    return node
  }

  const rootContainer = makeNode("root", "box")
  mutations.createElement(rootContainer.id, "div")
  mutations.setStyle(rootContainer.id, {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%"
  })
  mutations.setRoot(rootContainer.id)

  const dirtyStyleNodes = new Set<GpuiNode>()
  const pendingValueResets: Array<() => void> = []

  const syncNativeListener = (node: GpuiNode, eventType: string, active: boolean): void => {
    const has = node.nativeListeners.has(eventType)
    if (active === has) return
    if (active) {
      node.nativeListeners.add(eventType)
      mutations.setEventListener(node.id, eventType, true)
      registerEventHandler(eventHandlers, node.id, eventType, (rawEvent) => {
        if (node.detached || node.dispatch === undefined) return
        if (eventType === "click") {
          if (node.disabled) return
          const pressHandler = node.handlers["press"]
          if (pressHandler !== undefined) {
            node.dispatch("press", pressHandler, {})
          }
          const clickHandler = node.handlers["click"]
          if (clickHandler !== undefined) {
            node.dispatch("click", clickHandler, toPayload("click", rawEvent))
          }
          return
        }
        if (eventType === "change") {
          const received = receiveNativeInputValue(node.inputValue, rawEvent.value)
          node.inputValue = received.next
          const changeTextHandler = node.handlers["changeText"]
          if (changeTextHandler !== undefined) {
            node.dispatch("changeText", changeTextHandler, { text: received.cleanValue })
          }
          const handler = node.handlers["change"]
          if (handler !== undefined) {
            node.dispatch("change", handler, toPayload("change", rawEvent, received.cleanValue))
          }
          return
        }
        if (eventType === "submit") {
          const clean = readSubmittedInputValue(node.inputValue, rawEvent.value)
          const handler = node.handlers["submit"]
          if (handler !== undefined) {
            node.dispatch("submit", handler, {
              ...(toPayload("submit", rawEvent, clean) as Record<string, unknown>),
              text: clean
            })
          }
          return
        }
        const handler = node.handlers[eventType]
        if (handler !== undefined) {
          node.dispatch(eventType, handler, toPayload(eventType, rawEvent))
        }
      })
    } else {
      node.nativeListeners.delete(eventType)
      mutations.setEventListener(node.id, eventType, false)
      eventHandlers.get(node.id)?.delete(eventType)
    }
  }

  const pushControlledValue = (node: GpuiNode, desired: string): void => {
    if (node.nativeType !== "input" && node.nativeType !== "textarea") return
    const { next, action } = syncDesiredInputValue(node.inputValue, desired)
    node.inputValue = next
    switch (action._tag) {
      case "Noop":
        return
      case "Set":
        mutations.setCustomProp(node.id, "value", action.value)
        return
      case "NudgeThenReset":
        mutations.setCustomProp(node.id, "value", action.nudged)
        pendingValueResets.push(() => {
          const completed = completeInputNudge(node.inputValue, action.nudged)
          node.inputValue = completed.next
          if (completed.resetValue === undefined) return
          mutations.setCustomProp(node.id, "value", completed.resetValue)
          mutations.flushMutations()
        })
        return
    }
  }

  const computeAndSendStyle = (node: GpuiNode): void => {
    if (node.kind === "root" || node.detached) return
    if (node.id === 0) return
    const parentText = node.parent?.inheritedText ?? {}
    node.inheritedText = extractInheritedText(parentText, node.ownStyle)

    let out: Record<string, unknown>
    if (node.kind === "text") {
      out = { ...node.inheritedText }
      if (isClickableAncestor(node)) {
        out["pointerEvents"] = "none"
      }
    } else {
      out = { ...(node.ownStyle ?? {}) }
      if (node.tag === "button") {
        if (out["cursor"] === undefined) out["cursor"] = "pointer"
      }
      if (node.nativeType === "text" || node.nativeType === "input" || node.nativeType === "textarea") {
        for (const key of INHERITED_TEXT_KEYS) {
          if (out[key] === undefined && node.inheritedText[key] !== undefined) {
            out[key] = node.inheritedText[key]
          }
        }
      }
      if (node.hoverStyle !== undefined) {
        out["hover"] = { ...(out["hover"] as object | undefined), ...node.hoverStyle }
      }
      if (node.activeStyle !== undefined) {
        out["active"] = { ...(out["active"] as object | undefined), ...node.activeStyle }
      }
      if (
        !node.isInteractive &&
        node.nativeType === "div" &&
        out["pointerEvents"] === undefined &&
        out["hover"] === undefined &&
        out["active"] === undefined &&
        !isScrollableStyle(node.ownStyle) &&
        isClickableAncestor(node)
      ) {
        out["pointerEvents"] = "none"
      }
    }

    const json = JSON.stringify(out)
    if (json !== node.lastSentStyleJson) {
      node.lastSentStyleJson = json
      mutations.setStyle(node.id, out)
    }

    for (const child of node.children) {
      computeAndSendStyle(child)
    }
  }

  const syncTextElementContent = (node: GpuiNode): void => {
    if (node.tag !== "text" || node.kind !== "element") return
    const combined = node.children
      .filter((c) => c.kind === "text")
      .map((c) => c.text)
      .join("")
    if (combined !== node.text) {
      node.text = combined
      mutations.setText(node.id, combined)
    }
  }

  const detachSubtree = (node: GpuiNode): void => {
    node.detached = true
    node.inputValue = { _tag: "Detached" }
    unregisterEventHandlers(eventHandlers, node.id)
    node.nativeListeners.clear()
    dirtyStyleNodes.delete(node)
    for (const child of node.children) {
      detachSubtree(child)
    }
  }

  const host: Renderer.Host<GpuiNode> = {
    createElement(tag) {
      const node = makeNode("element", tag)
      mutations.createElement(node.id, node.nativeType)
      if (tag === "button") {
        mutations.setCustomProp(node.id, "role", "button")
        mutations.setCustomProp(node.id, "tabIndex", 0)
        node.customProps.set("role", "button")
        node.customProps.set("tabIndex", 0)
      }
      if (node.nativeType === "input" || node.nativeType === "textarea") {
        syncNativeListener(node, "change", true)
        if (node.nativeType === "input") {
          syncNativeListener(node, "submit", true)
        }
      }
      dirtyStyleNodes.add(node)
      return node
    },

    createText(text) {
      return {
        id: 0,
        kind: "text",
        tag: "#text",
        nativeType: "text",
        parent: undefined,
        children: [],
        text,
        ownStyle: undefined,
        rawStyle: undefined,
        hoverStyle: undefined,
        activeStyle: undefined,
        inheritedText: {},
        lastSentStyleJson: "",
        customProps: new Map(),
        handlers: {},
        dispatch: undefined,
        nativeListeners: new Set(),
        inputValue: initialInputValueState,
        isInteractive: false,
        disabled: false,
        horizontal: false,
        detached: false
      }
    },

    setText(node, text) {
      if (node.text === text) return
      node.text = text
      if (node.parent?.tag === "text" && node.parent.kind === "element") {
        syncTextElementContent(node.parent)
      } else if (node.id !== 0) {
        mutations.setText(node.id, text)
      }
    },

    setAttr(node, name, value) {
      if (CUSTOM_PROP_KEYS.has(name)) {
        const next = value ?? null
        if (node.customProps.get(name) !== next) {
          node.customProps.set(name, next)
          mutations.setCustomProp(node.id, name, next)
        }
      }
    },

    setProp(node, name, value) {
      if (name === "style") {
        node.rawStyle = value as Record<string, unknown> | undefined
        node.ownStyle = normalizeGpuiStyle(node.tag, node.rawStyle, node.horizontal)
        dirtyStyleNodes.add(node)
        return
      }
      if (name === "horizontal") {
        node.horizontal = Boolean(value)
        node.ownStyle = normalizeGpuiStyle(node.tag, node.rawStyle, node.horizontal)
        dirtyStyleNodes.add(node)
        return
      }
      if (name === "disabled") {
        node.disabled = Boolean(value)
        return
      }
      if (name === "hoverStyle") {
        node.hoverStyle = normalizeGpuiStyle(
          "hover",
          value as Record<string, unknown> | undefined
        ) as Omit<StyleDesc, "hover" | "active"> | undefined
        dirtyStyleNodes.add(node)
        return
      }
      if (name === "activeStyle") {
        node.activeStyle = normalizeGpuiStyle(
          "active",
          value as Record<string, unknown> | undefined
        ) as Omit<StyleDesc, "hover" | "active"> | undefined
        dirtyStyleNodes.add(node)
        return
      }
      if (name === "value") {
        if (typeof value === "string") {
          pushControlledValue(node, value)
        }
        return
      }
      if (CUSTOM_PROP_KEYS.has(name)) {
        const next = value === undefined ? null : (value as string | number | boolean | object | null)
        if (node.customProps.get(name) !== next) {
          node.customProps.set(name, next)
          mutations.setCustomProp(node.id, name, next)
        }
      }
    },

    insertBefore(parent, node, ref) {
      if (node.parent !== undefined) {
        const prevIndex = node.parent.children.indexOf(node)
        if (prevIndex >= 0) node.parent.children.splice(prevIndex, 1)
      }
      node.parent = parent
      if (ref === undefined) {
        parent.children.push(node)
      } else {
        const idx = parent.children.indexOf(ref)
        if (idx >= 0) parent.children.splice(idx, 0, node)
        else parent.children.push(node)
      }

      // GPUI `text` element holds its string via `setText`, not nested `text` children.
      if (parent.tag === "text" && parent.kind === "element" && node.kind === "text") {
        syncTextElementContent(parent)
        return
      }

      if (node.kind === "text" && node.id === 0) {
        const id = nextId++
        ;(node as { id: number }).id = id
        nodes.set(id, node)
        mutations.createElement(id, "text")
        mutations.setText(id, node.text)
      }

      if (parent.nativeType === "div" && node.id !== 0) {
        if (ref === undefined) {
          mutations.appendChild(parent.id, node.id)
        } else if (ref.id !== 0) {
          mutations.insertBefore(parent.id, node.id, ref.id)
        } else {
          mutations.appendChild(parent.id, node.id)
        }
      }
      dirtyStyleNodes.add(node)
    },

    remove(node) {
      const parent = node.parent
      if (parent !== undefined) {
        const idx = parent.children.indexOf(node)
        if (idx >= 0) parent.children.splice(idx, 1)
        node.parent = undefined
        if (parent.tag === "text" && parent.kind === "element" && node.kind === "text") {
          syncTextElementContent(parent)
          detachSubtree(node)
          if (node.id !== 0) mutations.destroyElement(node.id)
          return
        }
      }
      detachSubtree(node)
      if (node.id !== 0) {
        mutations.destroyElement(node.id)
      }
    },

    parentOf(node) {
      return node.parent
    },

    nextOf(node) {
      const parent = node.parent
      if (parent === undefined) return undefined
      const idx = parent.children.indexOf(node)
      return idx >= 0 ? parent.children[idx + 1] : undefined
    },

    setEvents(node, handlers, dispatch) {
      node.handlers = handlers
      node.dispatch = dispatch
      const hadInteractive = node.isInteractive
      const wanted = new Set<string>()
      for (const key of Object.keys(handlers)) {
        if (key === "press") wanted.add("click")
        else if (key === "changeText") wanted.add("change")
        else wanted.add(key)
      }
      if (node.nativeType === "input") {
        wanted.add("change")
        wanted.add("submit")
      } else if (node.nativeType === "textarea") {
        wanted.add("change")
      }
      node.isInteractive =
        node.tag === "button" ||
        node.nativeType === "input" ||
        node.nativeType === "textarea" ||
        wanted.has("click") ||
        wanted.has("mouseDown") ||
        wanted.has("mouseUp") ||
        wanted.has("keyDown")

      for (const existing of [...node.nativeListeners]) {
        if (!wanted.has(existing)) {
          syncNativeListener(node, existing, false)
        }
      }
      for (const next of wanted) {
        syncNativeListener(node, next, true)
      }
      if (hadInteractive !== node.isInteractive) {
        dirtyStyleNodes.add(node)
      }
    },

    elements: [Gpui.name, Ui.name],
    controlled: CONTROLLED_PROPS,
    runsMounts: true,

    commit() {
      if (dirtyStyleNodes.size > 0) {
        for (const node of dirtyStyleNodes) {
          let covered = false
          for (let cur = node.parent; cur !== undefined && !covered; cur = cur.parent) {
            if (dirtyStyleNodes.has(cur)) covered = true
          }
          if (!covered) computeAndSendStyle(node)
        }
        dirtyStyleNodes.clear()
      }
      mutations.flushMutations()
      if (pendingValueResets.length > 0) {
        const resets = pendingValueResets.splice(0)
        setTimeout(() => {
          for (const reset of resets) reset()
        }, 16)
      }
    },

    head(folded: Head.Head) {
      if (folded.title !== undefined) {
        renderer.setWindowTitle?.(folded.title)
      }
    }
  }

  const service: Context.Service.Shape<typeof Gpui.Host> = {
    focus: (handle) => renderer.focusElement?.(handle.id),
    blur: () => renderer.blur?.(),
    setWindowTitle: (title) => renderer.setWindowTitle?.(title)
  }

  const dispose = (): void => {
    for (const child of [...rootContainer.children]) {
      host.remove(child)
    }
    mutations.destroyElement(rootContainer.id)
    mutations.flushMutations()
    binding.detach()
  }

  return {
    host,
    rootContainer,
    service,
    flush: () => host.commit?.(),
    dispose
  }
}

export { layer, mount, run } from "./mount.ts"
