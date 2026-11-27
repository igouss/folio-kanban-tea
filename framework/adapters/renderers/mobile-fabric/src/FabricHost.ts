import type { Component, Renderer, View } from "@effect/ui"
import { Ui } from "@universal-ui/core"
import { claimHost, type Engine, type EngineNode } from "@ng-native/fabric"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import {
  createActiveTextField,
  initialPressGesture,
  pressGrant,
  pressMove,
  pressRelease,
  pressTerminate,
  readTextFieldFallback,
  touchPoint,
  transitionTextField,
  type PressGestureState,
  type Size,
  type TextFieldEvent,
  type TextFieldLifecycle
} from "./fsm.ts"
import {
  IGNORED_UNIVERSAL_PROPS,
  mapFabricTag,
  normalizeFabricStyle
} from "./universal.ts"

const CONTROLLED_PROPS: ReadonlySet<string> = new Set(["value"])
const KEEP_SELECTION = -1

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
  lifecycle: TextFieldLifecycle
  handler: View.Handler<unknown, any> | undefined
  dispatch: Renderer.Dispatch | undefined
  dispose: () => void
}

interface SubmitState {
  handler: View.Handler<unknown, any>
  dispatch: Renderer.Dispatch
  dispose: () => void
}

export interface FabricHostOptions {
  readonly platform?: string | undefined
  readonly requestAnimationFrame?: ((callback: () => void) => void) | undefined
}

export type FabricAppRequirements<R, RP, V extends View.Elements> = Exclude<
  R | RP | Renderer.HostOf<V>,
  Ui.Host | Renderer.Renderer
>

export type FabricMountAppOptions<Required> = FabricHostOptions &
  ([Required] extends [never]
    ? { readonly layer?: Layer.Layer<never> | undefined }
    : { readonly layer: Layer.Layer<Required> })

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
  const submitStates = new WeakMap<EngineNode, SubmitState>()

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
    let anchor = looseAnchors.get(node)
    if (anchor === undefined) {
      anchor = engine.createAnchor()
      looseAnchors.set(node, anchor)
    }
    return anchor
  }

  const dispatchTextField = (
    node: EngineNode,
    field: TextFieldState,
    event: TextFieldEvent
  ): void => {
    const { next, effects } = transitionTextField(field.lifecycle, event)
    field.lifecycle = next
    for (const effect of effects) {
      switch (effect._tag) {
        case "SetTextProp":
          engine.setProp(node, "text", effect.text)
          break
        case "SetMostRecentEventCount":
          engine.setProp(node, "mostRecentEventCount", effect.eventCount)
          break
        case "SchedulePostCommitReconcile":
          postCommitTasks.push(() =>
            dispatchTextField(node, field, { _tag: "Reconcile" })
          )
          break
        case "EmitChangeText":
          if (field.handler !== undefined && field.dispatch !== undefined) {
            field.dispatch("changeText", field.handler, { text: effect.text })
          }
          break
        case "ScheduleFrameReconcile":
          scheduleFrame(() =>
            dispatchTextField(node, field, { _tag: "Reconcile" })
          )
          break
        case "DispatchSetTextAndSelection":
          engine.dispatchCommand(node, "setTextAndSelection", [
            effect.eventCount,
            effect.text,
            KEEP_SELECTION,
            KEEP_SELECTION
          ])
          engine.remeasure(node)
          break
      }
    }
  }

  const ensureTextField = (node: EngineNode): TextFieldState => {
    const existing = textFields.get(node)
    if (existing !== undefined) return existing
    const field: TextFieldState = {
      lifecycle: createActiveTextField(),
      handler: undefined,
      dispatch: undefined,
      dispose: () => {}
    }
    const stop = engine.setEventListener(node, "topChange", (event) => {
      const native = (event as { nativeEvent?: { text?: string; eventCount?: number } })
        .nativeEvent
      dispatchTextField(node, field, {
        _tag: "ReceiveNative",
        text: native?.text ?? "",
        eventCount: native?.eventCount
      })
    })
    field.dispose = () => {
      dispatchTextField(node, field, { _tag: "Dispose" })
      stop()
    }
    textFields.set(node, field)
    return field
  }

  const ensurePressResponder = (node: EngineNode): PressState => {
    const existing = pressStates.get(node)
    if (existing !== undefined) return existing
    let gesture: PressGestureState = initialPressGesture
    let size: Size | undefined

    const state: PressState = {
      isDisabled: disabledFlags.get(node) ?? false,
      handler: undefined,
      dispatch: undefined,
      dispose: () => {}
    }
    const stopResponding = engine.setResponder(node, {
      onStartShouldSetResponder: () => !state.isDisabled && state.handler !== undefined,
      onResponderGrant: (event) => {
        gesture = pressGrant(touchPoint(event))
      },
      onResponderMove: (event) => {
        gesture = pressMove(gesture, touchPoint(event), size)
      },
      onResponderRelease: () => {
        const result = pressRelease(gesture)
        gesture = result.next
        if (
          result.shouldEmitPress &&
          !state.isDisabled &&
          state.handler !== undefined &&
          state.dispatch !== undefined
        ) {
          state.dispatch("press", state.handler, {})
        }
      },
      onResponderTerminate: () => {
        gesture = pressTerminate()
      },
      onResponderTerminationRequest: () => true
    })
    const stopLayout = engine.setEventListener(node, "topLayout", (event) => {
      const layout = (event as { nativeEvent?: { layout?: Size } }).nativeEvent?.layout
      if (layout !== undefined) size = { width: layout.width, height: layout.height }
    })
    state.dispose = () => {
      gesture = pressTerminate()
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
    const submit = submitStates.get(node)
    if (submit !== undefined) {
      submitStates.delete(node)
      submit.dispose()
    }
    for (const child of [...node.children]) cleanupNode(child)
    engine.destroyNode(node)
  }

  const host: Renderer.Host<EngineNode> = {
    createElement(tag) {
      const node = engine.createElement(mapFabricTag(tag))
      claimHost(node)
      if (tag === "textarea") engine.setProp(node, "multiline", true)
      return node
    },

    createText: (text) => engine.createText(text),

    setText(node, text) {
      if (node.kind === "text") engine.setText(node, text)
    },

    setAttr(node, name, value) {
      engine.setProp(node, name, value ?? null)
    },

    setProp(node, name, value) {
      if (IGNORED_UNIVERSAL_PROPS.has(name)) return
      switch (name) {
        case "testId":
          engine.setProp(node, "testID", value ?? null)
          return
        case "aria-label":
          engine.setProp(node, "accessibilityLabel", value ?? null)
          return
        case "style": {
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
        case "disabled": {
          const flag = Boolean(value)
          disabledFlags.set(node, flag)
          const press = pressStates.get(node)
          if (press !== undefined) press.isDisabled = flag
          engine.setProp(node, "accessibilityState", { disabled: flag })
          return
        }
        case "value":
          if (node.name === "text-input") {
            dispatchTextField(node, ensureTextField(node), {
              _tag: "SetDesired",
              desired: typeof value === "string" ? value : undefined
            })
            return
          }
          break
      }
      engine.setProp(node, name, value ?? null)
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
      if (parent !== null) engine.removeChild(parent, p)
      if (p !== node) looseAnchors.delete(node)
      cleanupNode(node)
    },

    parentOf: (node) => engine.parentNode(placed(node)) ?? undefined,
    nextOf: (node) => engine.nextSibling(placed(node)) ?? undefined,

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

      // 3. TextInput "submit" -> topSubmitEditing
      const submitHandler = handlers["submit"]
      const existingSubmit = submitStates.get(node)
      if (submitHandler !== undefined) {
        if (existingSubmit !== undefined) {
          existingSubmit.handler = submitHandler
          existingSubmit.dispatch = dispatch
        } else {
          const record: SubmitState = {
            handler: submitHandler,
            dispatch,
            dispose: () => {}
          }
          record.dispose = engine.setEventListener(node, "topSubmitEditing", (event) => {
            const native = (event as { nativeEvent?: { text?: unknown } }).nativeEvent
            const lc = textFields.get(node)?.lifecycle
            const text =
              typeof native?.text === "string"
                ? native.text
                : lc !== undefined
                  ? readTextFieldFallback(lc)
                  : ""
            record.dispatch("submit", record.handler, { text })
          })
          submitStates.set(node, record)
        }
      } else if (existingSubmit !== undefined) {
        existingSubmit.dispose()
        submitStates.delete(node)
      }
    },

    elements: [Ui.name],
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

  return {
    host,
    container,
    dispose: () => {
      for (const child of [...container.children]) host.remove(child)
      deferredPressDisposals.splice(0).forEach((fn) => fn())
      engine.removeChild(engine.root, container)
      engine.destroyNode(container)
      engine.commit()
    }
  }
}

export interface MountedFabricApp<Model, Msg> {
  readonly engine: Engine
  readonly ready: Promise<Renderer.Root<Model, Msg>>
  readonly root: () => Renderer.Root<Model, Msg> | undefined
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
  FabricAppRequirements<R, RP, V> | Scope.Scope
> =>
  Effect.gen(function* () {
    const { handle, context } = yield* Ui.makeScopedHost("mobile", () =>
      makeHost(engine, options)
    )
    return yield* Ui.mountWithHost(component, props, handle.container, context)
  })

export const mountAppWithLayer = <
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
  options: FabricHostOptions,
  layer: Layer.Layer<FabricAppRequirements<R, RP, V>>
): MountedFabricApp<Model, Msg> => {
  const scope = Effect.runSync(Scope.make())
  let currentRoot: Renderer.Root<Model, Msg> | undefined
  let resolveReady!: (root: Renderer.Root<Model, Msg>) => void
  let rejectReady!: (error: unknown) => void
  const ready = new Promise<Renderer.Root<Model, Msg>>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  ready.catch(() => {})

  const fiber = Effect.runFork(
    mount(component, props, engine, options).pipe(
      Effect.provide(layer),
      Scope.provide(scope),
      Effect.tap((root) =>
        Effect.sync(() => {
          currentRoot = root
          resolveReady(root)
        })
      ),
      Effect.tapCause((cause) => Effect.sync(() => rejectReady(cause)))
    )
  )

  return {
    engine,
    ready,
    root: () => currentRoot,
    dispose: () => {
      Effect.runFork(
        Fiber.interrupt(fiber).pipe(
          Effect.ensuring(Scope.close(scope, Exit.void))
        )
      )
    }
  }
}

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
  ...rest: [FabricAppRequirements<R, RP, V>] extends [never]
    ? [options?: FabricMountAppOptions<never>]
    : [options: FabricMountAppOptions<FabricAppRequirements<R, RP, V>>]
): MountedFabricApp<Model, Msg> => {
  const options = (rest[0] ?? {}) as FabricHostOptions & {
    readonly layer?: Layer.Layer<FabricAppRequirements<R, RP, V>> | undefined
  }
  const providedLayer: Layer.Layer<FabricAppRequirements<R, RP, V>> =
    options.layer ?? (Layer.empty as Layer.Layer<FabricAppRequirements<R, RP, V>>)
  return mountAppWithLayer(component, props, engine, options, providedLayer)
}
