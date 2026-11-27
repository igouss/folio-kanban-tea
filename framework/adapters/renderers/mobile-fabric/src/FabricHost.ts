import { Renderer } from "@effect/ui"
import type { Component, View } from "@effect/ui"
import { Ui } from "@universal-ui/core"
import { claimHost, type Engine, type EngineNode, type ResponderEvent } from "@ng-native/fabric"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import type * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as Fabric from "./Fabric.ts"
import {
  IGNORED_UNIVERSAL_PROPS,
  mapFabricTag,
  normalizeFabricStyle
} from "./universal.ts"

const CONTROLLED_PROPS: ReadonlySet<string> = new Set(["value"])
const KEEP_SELECTION = -1
const PRESS_RETENTION = { top: 20, left: 20, right: 20, bottom: 30 } as const
const PRESS_CANCEL_DISTANCE = 15

type Point = Readonly<{ x: number; y: number }>
type Size = Readonly<{ width: number; height: number }>

const touchPoint = (event: ResponderEvent): Point => {
  const native = (event.nativeEvent ?? {}) as {
    pageX?: number
    pageY?: number
    touches?: ReadonlyArray<{ pageX?: number; pageY?: number }>
  }
  const touch = native.touches?.[0]
  return { x: native.pageX ?? touch?.pageX ?? 0, y: native.pageY ?? touch?.pageY ?? 0 }
}

const isStillOnControl = (size: Size | undefined, dx: number, dy: number): boolean => {
  if (size === undefined) return Math.hypot(dx, dy) <= PRESS_CANCEL_DISTANCE
  const horizontal = dx < 0 ? PRESS_RETENTION.left : PRESS_RETENTION.right
  const vertical = dy < 0 ? PRESS_RETENTION.top : PRESS_RETENTION.bottom
  return Math.abs(dx) <= size.width + horizontal && Math.abs(dy) <= size.height + vertical
}

const topLevelTypeOf = (name: string): string =>
  /^top[A-Z]/.test(name) ? name : `top${name.charAt(0).toUpperCase()}${name.slice(1)}`

const isShallowEqual = (
  a: Readonly<Record<string, unknown>> | undefined,
  b: Readonly<Record<string, unknown>> | undefined
): boolean => {
  if (a === undefined || b === undefined) return a === b
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

interface PressState {
  isDisabled: boolean
  handler: View.Handler<unknown, any> | undefined
  dispatch: Renderer.Dispatch | undefined
  dispose: () => void
}

interface TextFieldState {
  desiredValue: string | undefined
  lastNativeText: string | undefined
  eventCount: number
  writtenEventCount: number | undefined
  handler: View.Handler<unknown, any> | undefined
  dispatch: Renderer.Dispatch | undefined
  isActive: boolean
  dispose: () => void
}

interface EventRecord {
  handlers: Readonly<Record<string, View.Handler<unknown, any>>>
  dispatch: Renderer.Dispatch
  listeners: Map<string, () => void>
}

export interface FabricHostOptions<RLayer = any> {
  readonly platform?: string | undefined
  readonly requestAnimationFrame?: ((callback: () => void) => void) | undefined
  readonly layer?: Layer.Layer<RLayer> | undefined
}

export interface FabricHostHandle {
  readonly host: Renderer.Host<EngineNode>
  readonly container: EngineNode
  readonly dispose: () => void
}

export const makeHost = (
  engine: Engine,
  options: FabricHostOptions = {}
): FabricHostHandle => {
  const scheduleFrame =
    options.requestAnimationFrame ??
    ((cb: () => void) => {
      if (typeof globalThis.requestAnimationFrame === "function") {
        globalThis.requestAnimationFrame(cb)
      } else {
        setTimeout(cb, 16)
      }
    })

  const container = engine.createElement("view")
  claimHost(container)
  engine.setDefaultStyle(container, { height: "100%" })
  engine.appendChild(engine.root, container)
  engine.commit()

  const looseAnchors = new WeakMap<EngineNode, EngineNode>()
  const lastStyles = new WeakMap<EngineNode, Readonly<Record<string, unknown>>>()
  const pressStates = new WeakMap<EngineNode, PressState>()
  const disabledFlags = new WeakMap<EngineNode, boolean>()
  const textFields = new WeakMap<EngineNode, TextFieldState>()
  const eventRecords = new WeakMap<EngineNode, EventRecord>()

  const deferredPressDisposals: Array<() => void> = []
  const postCommitTasks: Array<() => void> = []

  const placed = (node: EngineNode): EngineNode => looseAnchors.get(node) ?? node

  const unloose = (node: EngineNode): void => {
    const anchor = looseAnchors.get(node)
    if (anchor === undefined) return
    looseAnchors.delete(node)
    const parent = engine.parentNode(anchor)
    if (parent !== null) engine.removeChild(parent, anchor)
  }

  const loosen = (node: EngineNode): EngineNode => {
    const existing = looseAnchors.get(node)
    if (existing !== undefined) return existing
    const anchor = engine.createAnchor()
    looseAnchors.set(node, anchor)
    return anchor
  }

  const reconcileTextField = (node: EngineNode, field: TextFieldState): void => {
    const desired = field.desiredValue
    if (!field.isActive || desired === undefined || field.lastNativeText === desired) return
    field.lastNativeText = desired
    engine.dispatchCommand(node, "setTextAndSelection", [
      field.eventCount,
      desired,
      KEEP_SELECTION,
      KEEP_SELECTION
    ])
    engine.remeasure(node)
  }

  const ensureTextField = (node: EngineNode): TextFieldState => {
    const existing = textFields.get(node)
    if (existing !== undefined) return existing
    const field: TextFieldState = {
      desiredValue: undefined,
      lastNativeText: undefined,
      eventCount: 0,
      writtenEventCount: undefined,
      handler: undefined,
      dispatch: undefined,
      isActive: true,
      dispose: () => {}
    }
    const stop = engine.setEventListener(node, "topChange", (event) => {
      const native = (event as { nativeEvent?: { text?: string; eventCount?: number } })
        .nativeEvent
      const text = native?.text ?? ""
      field.lastNativeText = text
      field.eventCount = native?.eventCount ?? field.eventCount + 1
      if (field.handler !== undefined && field.dispatch !== undefined) {
        field.dispatch("changeText", field.handler, { text })
      }
      scheduleFrame(() => {
        if (field.isActive) reconcileTextField(node, field)
      })
    })
    field.dispose = () => {
      field.isActive = false
      stop()
    }
    textFields.set(node, field)
    return field
  }

  const ensurePressResponder = (node: EngineNode): PressState => {
    const existing = pressStates.get(node)
    if (existing !== undefined) return existing
    let origin: Point | undefined
    let size: Size | undefined
    let isCancelled = false

    const state: PressState = {
      isDisabled: disabledFlags.get(node) ?? false,
      handler: undefined,
      dispatch: undefined,
      dispose: () => {}
    }
    const stopResponding = engine.setResponder(node, {
      onStartShouldSetResponder: () => !state.isDisabled && state.handler !== undefined,
      onResponderGrant: (event) => {
        origin = touchPoint(event)
        isCancelled = false
      },
      onResponderMove: (event) => {
        if (isCancelled || origin === undefined) return
        const pt = touchPoint(event)
        isCancelled = !isStillOnControl(size, pt.x - origin.x, pt.y - origin.y)
      },
      onResponderRelease: () => {
        const wasCancelled = isCancelled
        origin = undefined
        isCancelled = false
        if (!wasCancelled && !state.isDisabled && state.handler !== undefined && state.dispatch !== undefined) {
          state.dispatch("press", state.handler, {})
        }
      },
      onResponderTerminate: () => {
        origin = undefined
        isCancelled = true
      },
      onResponderTerminationRequest: () => true
    })
    const stopLayout = engine.setEventListener(node, "topLayout", (event) => {
      const layout = (event as { nativeEvent?: { layout?: Size } }).nativeEvent?.layout
      if (layout !== undefined) {
        size = { width: layout.width, height: layout.height }
      }
    })
    state.dispose = () => {
      stopResponding()
      stopLayout()
    }
    pressStates.set(node, state)
    return state
  }

  const cleanupNode = (node: EngineNode): void => {
    const press = pressStates.get(node)
    if (press !== undefined) {
      pressStates.delete(node)
      deferredPressDisposals.push(press.dispose)
    }
    const field = textFields.get(node)
    if (field !== undefined) {
      textFields.delete(node)
      field.dispose()
    }
    const events = eventRecords.get(node)
    if (events !== undefined) {
      eventRecords.delete(node)
      events.listeners.forEach((dispose) => dispose())
      events.listeners.clear()
    }
    for (const child of [...node.children]) {
      cleanupNode(child)
    }
    engine.destroyNode(node)
  }

  const host: Renderer.Host<EngineNode> = {
    createElement(tag) {
      const fabricTag = mapFabricTag(tag)
      const node = engine.createElement(fabricTag)
      claimHost(node)
      if (tag === "textarea") {
        engine.setProp(node, "multiline", true)
      }
      return node
    },

    createText(text) {
      return engine.createText(text)
    },

    setText(node, text) {
      if (node.kind === "text") {
        engine.setText(node, text)
      }
    },

    setAttr(node, name, value) {
      if (name === "class") {
        engine.setClasses(node, value ?? "")
        return
      }
      engine.setProp(node, name, value ?? null)
    },

    setProp(node, name, value) {
      if (IGNORED_UNIVERSAL_PROPS.has(name)) return
      if (name === "testId") {
        engine.setProp(node, "testID", value === undefined ? null : value)
        return
      }
      if (name === "aria-label") {
        engine.setProp(node, "accessibilityLabel", value === undefined ? null : value)
        return
      }
      if (name === "role") {
        engine.setProp(node, "accessibilityRole", value === undefined ? null : value)
        return
      }
      if (name === "style") {
        const nextStyle = normalizeFabricStyle(
          node.name,
          value as Readonly<Record<string, unknown>> | undefined
        )
        if (!isShallowEqual(lastStyles.get(node), nextStyle)) {
          if (nextStyle === undefined) lastStyles.delete(node)
          else lastStyles.set(node, nextStyle)
          engine.setProp(node, "style", nextStyle ?? null)
        }
        return
      }
      if (name === "disabled") {
        const flag = Boolean(value)
        disabledFlags.set(node, flag)
        const press = pressStates.get(node)
        if (press !== undefined) press.isDisabled = flag
        engine.setProp(node, "accessibilityState", { disabled: flag })
        return
      }
      if (name === "value" && node.name === "text-input") {
        const field = ensureTextField(node)
        const desired = typeof value === "string" ? value : undefined
        const changed = field.desiredValue !== desired
        field.desiredValue = desired
        if (field.lastNativeText === undefined) field.lastNativeText = desired
        if (changed) {
          engine.setProp(node, "text", desired ?? null)
        }
        if (field.writtenEventCount !== field.eventCount) {
          field.writtenEventCount = field.eventCount
          engine.setProp(node, "mostRecentEventCount", field.eventCount)
        }
        postCommitTasks.push(() => reconcileTextField(node, field))
        return
      }
      engine.setProp(node, name, value === undefined ? null : value)
    },

    insertBefore(parent, node, ref) {
      const target = ref === undefined ? null : placed(ref)
      if (node.kind === "text" && !(parent.kind === "element" && parent.name === "text")) {
        engine.insertBefore(parent, loosen(node), target)
        return
      }
      unloose(node)
      // Android Fabric flattens plain Views without `collapsable: false`, which
      // promotes multiple children into android.widget.ScrollView and crashes.
      if (parent.kind === "element" && parent.name === "scroll-view" && node.kind === "element") {
        engine.setProp(node, "collapsable", false)
      }
      engine.insertBefore(parent, node, target)
    },

    remove(node) {
      const p = placed(node)
      const parent = engine.parentNode(p)
      if (parent !== null) {
        engine.removeChild(parent, p)
      }
      if (p !== node) looseAnchors.delete(node)
      cleanupNode(node)
    },

    parentOf(node) {
      return engine.parentNode(placed(node)) ?? undefined
    },

    nextOf(node) {
      return engine.nextSibling(placed(node)) ?? undefined
    },

    setEvents(node, handlers, dispatch) {
      // 1. Pressability responder for "press"
      const pressHandler = handlers["press"]
      if (pressHandler !== undefined) {
        const press = ensurePressResponder(node)
        press.handler = pressHandler
        press.dispatch = dispatch
      } else {
        const press = pressStates.get(node)
        if (press !== undefined) {
          pressStates.delete(node)
          deferredPressDisposals.push(press.dispose)
        }
      }

      // 2. Controlled TextInput "changeText"
      const changeTextHandler = handlers["changeText"]
      if (changeTextHandler !== undefined && node.name === "text-input") {
        const field = ensureTextField(node)
        field.handler = changeTextHandler
        field.dispatch = dispatch
      } else {
        const field = textFields.get(node)
        if (field !== undefined) {
          field.handler = undefined
          field.dispatch = undefined
        }
      }

      // 3. Any other native Fabric events (layout, scroll, submit, etc.)
      const otherNames = Object.keys(handlers).filter(
        (k) => k !== "press" && k !== "changeText" && k !== "keyDown"
      )
      if (otherNames.length === 0) {
        const existing = eventRecords.get(node)
        if (existing !== undefined) {
          existing.listeners.forEach((dispose) => dispose())
          existing.listeners.clear()
          eventRecords.delete(node)
        }
        return
      }

      let record = eventRecords.get(node)
      if (record === undefined) {
        record = { handlers, dispatch, listeners: new Map() }
        eventRecords.set(node, record)
      } else {
        record.handlers = handlers
        record.dispatch = dispatch
      }

      for (const [name, dispose] of record.listeners) {
        if (!otherNames.includes(name)) {
          dispose()
          record.listeners.delete(name)
        }
      }
      for (const name of otherNames) {
        if (!record.listeners.has(name)) {
          const current = record
          const fabricEvent =
            name === "submit" ? "topSubmitEditing" : topLevelTypeOf(name)
          record.listeners.set(
            name,
            engine.setEventListener(node, fabricEvent, (event) => {
              const handler = current.handlers[name]
              if (handler === undefined) return
              const native = (event as { nativeEvent?: Record<string, unknown> }).nativeEvent ?? {}
              const payload =
                name === "layout"
                  ? (native["layout"] ?? { x: 0, y: 0, width: 0, height: 0 })
                  : name === "scroll"
                    ? ((native["contentOffset"] as Record<string, unknown> | undefined) ?? { x: 0, y: 0 })
                    : name === "submit"
                      ? {
                          text:
                            typeof native["text"] === "string"
                              ? native["text"]
                              : (textFields.get(node)?.lastNativeText ??
                                textFields.get(node)?.desiredValue ??
                                "")
                        }
                      : native
              current.dispatch(name, handler, payload)
            })
          )
        }
      }
    },

    elements: [Fabric.name, Ui.name],
    controlled: CONTROLLED_PROPS,
    runsMounts: true,

    commit() {
      if (deferredPressDisposals.length > 0) {
        deferredPressDisposals.splice(0).forEach((fn) => fn())
      }
      engine.commit()
      if (postCommitTasks.length > 0) {
        postCommitTasks.splice(0).forEach((fn) => fn())
      }
    }
  }

  const dispose = (): void => {
    for (const child of [...container.children]) {
      host.remove(child)
    }
    deferredPressDisposals.splice(0).forEach((fn) => fn())
    engine.removeChild(engine.root, container)
    engine.destroyNode(container)
    engine.commit()
  }

  return { host, container, dispose }
}

export interface MountedFabricApp<Model, Msg> {
  readonly engine: Engine
  readonly root: Renderer.Root<Model, Msg>
  readonly dispose: () => void
}

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
  engine: Engine,
  options: FabricHostOptions = {}
): Effect.Effect<
  Renderer.Root<Model, Msg>,
  never,
  Exclude<R | RP, Fabric.Host | Ui.Host | Renderer.Renderer> | Scope.Scope
> =>
  Effect.gen(function* () {
    const handle = makeHost(engine, options)
    yield* Effect.addFinalizer(() => Effect.sync(handle.dispose))
    const ctx = Context.make(Renderer.Renderer, { host: handle.host }).pipe(
      Context.add(Fabric.Host, { platform: options.platform ?? "unknown" }),
      Context.add(Ui.Host, { platform: "mobile" })
    )
    const mounted = (Renderer.mount(
      component as any,
      props as any,
      handle.container
    ) as Effect.Effect<Renderer.Root<Model, Msg>, never, any>).pipe(
      Effect.provideContext(ctx)
    )
    return yield* (
      options.layer !== undefined
        ? mounted.pipe(Effect.provide(options.layer))
        : mounted
    )
  }) as any

export const mountApp = <
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
  engine: Engine,
  options: FabricHostOptions<
    Exclude<R | RP, Fabric.Host | Ui.Host | Renderer.Renderer>
  > = {}
): MountedFabricApp<Model, Msg> => {
  const scope = Effect.runSync(Scope.make())
  const root = Effect.runSync(
    mount(component, props, engine, options).pipe(
      Scope.provide(scope)
    ) as Effect.Effect<Renderer.Root<Model, Msg>>
  )
  return {
    engine,
    root,
    dispose: () => {
      Effect.runFork(Scope.close(scope, Exit.void))
    }
  }
}
