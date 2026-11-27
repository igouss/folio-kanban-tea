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
import {
  CUSTOM_PROP_KEYS,
  INHERITED_TEXT_KEYS,
  extractInheritedText,
  isScrollableStyle,
  nativeTypeOf,
  normalizeGpuiStyle,
  toKeyDownPayload
} from "./events.ts"
import {
  completeInputNudge,
  detachInputValue,
  initialInputValueState,
  readSubmittedInputValue,
  receiveNativeInputValue,
  syncDesiredInputValue,
  type InputValueState
} from "./fsm.ts"

const CONTROLLED_PROPS: ReadonlySet<string> = new Set(["value"])

export interface GpuiNode {
  id: number
  readonly kind: "root" | "element" | "text"
  readonly tag: string
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
  numberOfLines: number | undefined
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
    text = "",
    allocateId = true
  ): GpuiNode => {
    const id = allocateId ? nextId++ : 0
    const node: GpuiNode = {
      id,
      kind,
      tag,
      nativeType: kind === "text" ? "text" : nativeTypeOf(tag),
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
      numberOfLines: undefined,
      detached: false
    }
    if (allocateId) nodes.set(id, node)
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

  const setCustomPropIfChanged = (
    node: GpuiNode,
    name: string,
    value: unknown
  ): void => {
    if (!CUSTOM_PROP_KEYS.has(name)) return
    const next = value === undefined ? null : (value as string | number | boolean | object | null)
    if (node.customProps.get(name) !== next) {
      node.customProps.set(name, next)
      mutations.setCustomProp(node.id, name, next)
    }
  }

  const syncNativeListener = (node: GpuiNode, eventType: string, active: boolean): void => {
    if (active === node.nativeListeners.has(eventType)) return
    if (!active) {
      node.nativeListeners.delete(eventType)
      mutations.setEventListener(node.id, eventType, false)
      eventHandlers.get(node.id)?.delete(eventType)
      return
    }
    node.nativeListeners.add(eventType)
    mutations.setEventListener(node.id, eventType, true)
    registerEventHandler(eventHandlers, node.id, eventType, (rawEvent) => {
      if (node.detached || node.dispatch === undefined) return
      switch (eventType) {
        case "click": {
          if (node.disabled) return
          const h = node.handlers["press"]
          if (h !== undefined) node.dispatch("press", h, {})
          return
        }
        case "change": {
          const received = receiveNativeInputValue(node.inputValue, rawEvent.value)
          node.inputValue = received.next
          const h = node.handlers["changeText"]
          if (h !== undefined) node.dispatch("changeText", h, { text: received.cleanValue })
          return
        }
        case "submit": {
          const h = node.handlers["submit"]
          if (h !== undefined) {
            const text = readSubmittedInputValue(node.inputValue, rawEvent.value)
            node.dispatch("submit", h, { text })
          }
          return
        }
        case "keyDown": {
          const h = node.handlers["keyDown"]
          if (h !== undefined) node.dispatch("keyDown", h, toKeyDownPayload(rawEvent))
          return
        }
      }
    })
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
    if (node.kind === "root" || node.detached || node.id === 0) return
    const parentText = node.parent?.inheritedText ?? {}
    node.inheritedText = extractInheritedText(parentText, node.ownStyle)

    let out: Record<string, unknown>
    if (node.kind === "text") {
      out = { ...node.inheritedText }
      if (isClickableAncestor(node)) out["pointerEvents"] = "none"
    } else {
      out = { ...(node.ownStyle ?? {}) }
      if (node.tag === "button" && out["cursor"] === undefined) {
        out["cursor"] = "pointer"
      }
      if (node.nativeType !== "div") {
        for (const key of INHERITED_TEXT_KEYS) {
          if (out[key] === undefined && node.inheritedText[key] !== undefined) {
            out[key] = node.inheritedText[key]
          }
        }
      }
      if (node.nativeType === "text" && node.numberOfLines !== undefined && out["lineClamp"] === undefined) {
        out["lineClamp"] = node.numberOfLines
      }
      if (node.hoverStyle !== undefined) {
        out["hover"] = { ...(out["hover"] as object | undefined), ...node.hoverStyle }
      }
      if (node.activeStyle !== undefined) {
        out["active"] = { ...(out["active"] as object | undefined), ...node.activeStyle }
      }
      if (
        !node.isInteractive &&
        (node.nativeType === "div" || node.nativeType === "text") &&
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

    for (const child of node.children) computeAndSendStyle(child)
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
    node.inputValue = detachInputValue(node.inputValue)
    unregisterEventHandlers(eventHandlers, node.id)
    node.nativeListeners.clear()
    dirtyStyleNodes.delete(node)
    for (const child of node.children) detachSubtree(child)
  }

  const host: Renderer.Host<GpuiNode> = {
    createElement(tag) {
      const node = makeNode("element", tag)
      mutations.createElement(node.id, node.nativeType)
      if (tag === "button") {
        setCustomPropIfChanged(node, "role", "button")
        setCustomPropIfChanged(node, "tabIndex", 0)
      }
      if (node.nativeType === "input" || node.nativeType === "textarea") {
        syncNativeListener(node, "change", true)
        if (node.nativeType === "input") syncNativeListener(node, "submit", true)
      }
      dirtyStyleNodes.add(node)
      return node
    },

    createText: (text) => makeNode("text", "#text", text, false),

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
      setCustomPropIfChanged(node, name, value)
    },

    setProp(node, name, value) {
      switch (name) {
        case "style":
          node.rawStyle = value as Record<string, unknown> | undefined
          node.ownStyle = normalizeGpuiStyle(node.tag, node.rawStyle, node.horizontal)
          dirtyStyleNodes.add(node)
          return
        case "horizontal":
          node.horizontal = Boolean(value)
          node.ownStyle = normalizeGpuiStyle(node.tag, node.rawStyle, node.horizontal)
          dirtyStyleNodes.add(node)
          return
        case "numberOfLines":
          node.numberOfLines = typeof value === "number" ? value : undefined
          dirtyStyleNodes.add(node)
          return
        case "disabled":
          node.disabled = Boolean(value)
          return
        case "hoverStyle":
          node.hoverStyle = normalizeGpuiStyle(
            "hover",
            value as Record<string, unknown> | undefined
          ) as Omit<StyleDesc, "hover" | "active"> | undefined
          dirtyStyleNodes.add(node)
          return
        case "activeStyle":
          node.activeStyle = normalizeGpuiStyle(
            "active",
            value as Record<string, unknown> | undefined
          ) as Omit<StyleDesc, "hover" | "active"> | undefined
          dirtyStyleNodes.add(node)
          return
        case "value":
          if (typeof value === "string") pushControlledValue(node, value)
          return
        default:
          setCustomPropIfChanged(node, name, value)
      }
    },

    insertBefore(parent, node, ref) {
      if (node.parent !== undefined) {
        const prevIndex = node.parent.children.indexOf(node)
        if (prevIndex >= 0) node.parent.children.splice(prevIndex, 1)
      }
      node.parent = parent
      const idx = ref !== undefined ? parent.children.indexOf(ref) : -1
      if (idx >= 0) parent.children.splice(idx, 0, node)
      else parent.children.push(node)

      // GPUI `text` element holds its string via `setText`, not nested `text` children.
      if (parent.tag === "text" && parent.kind === "element" && node.kind === "text") {
        syncTextElementContent(parent)
        return
      }

      if (node.kind === "text" && node.id === 0) {
        node.id = nextId++
        nodes.set(node.id, node)
        mutations.createElement(node.id, "text")
        mutations.setText(node.id, node.text)
      }

      if (parent.nativeType === "div" && node.id !== 0) {
        if (ref !== undefined && ref.id !== 0) {
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
        }
      }
      detachSubtree(node)
      if (node.id !== 0) mutations.destroyElement(node.id)
    },

    parentOf: (node) => node.parent,

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
      if (handlers["press"] !== undefined) wanted.add("click")
      if (handlers["changeText"] !== undefined || node.nativeType === "input" || node.nativeType === "textarea") {
        wanted.add("change")
      }
      if (handlers["submit"] !== undefined || node.nativeType === "input") {
        wanted.add("submit")
      }
      if (handlers["keyDown"] !== undefined) wanted.add("keyDown")

      node.isInteractive =
        node.tag === "button" ||
        node.nativeType === "input" ||
        node.nativeType === "textarea" ||
        wanted.has("click") ||
        wanted.has("keyDown")

      for (const existing of [...node.nativeListeners]) {
        if (!wanted.has(existing)) syncNativeListener(node, existing, false)
      }
      for (const next of wanted) syncNativeListener(node, next, true)
      if (hadInteractive !== node.isInteractive) dirtyStyleNodes.add(node)
    },

    elements: [Ui.name],
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
      if (folded.title !== undefined) renderer.setWindowTitle?.(folded.title)
    }
  }

  return {
    host,
    rootContainer,
    flush: () => host.commit?.(),
    dispose: () => {
      for (const child of [...rootContainer.children]) host.remove(child)
      mutations.destroyElement(rootContainer.id)
      mutations.flushMutations()
      binding.detach()
    }
  }
}

export { layer, mount, run } from "./mount.ts"
