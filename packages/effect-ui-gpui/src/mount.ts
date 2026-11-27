import { Renderer } from "@effect/ui"
import type { Component, View } from "@effect/ui"
import { Ui } from "@folio/effect-ui-universal"
import type { WindowOptions } from "@gpuix/native"
import type { NativeRenderer } from "@gpuix/native/host"
import { createNativeRenderer, startFrameLoop } from "@gpuix/native/runtime"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Gpui from "./Gpui.ts"
import { makeHost } from "./GpuiHost.ts"

export const layer = (
  renderer: NativeRenderer
): Layer.Layer<Renderer.Renderer | Gpui.Host | Ui.Host> =>
  Layer.effectContext(
    Effect.gen(function* () {
      const handle = makeHost(renderer)
      yield* Effect.addFinalizer(() => Effect.sync(handle.dispose))
      return Context.make(Renderer.Renderer, { host: handle.host }).pipe(
        Context.add(Gpui.Host, handle.service),
        Context.add(Ui.Host, { platform: "desktop" })
      )
    })
  )

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
  renderer: NativeRenderer
): Effect.Effect<
  Renderer.Root<Model, Msg> & { readonly flush: () => void },
  never,
  Exclude<R | RP, Gpui.Host | Ui.Host | Renderer.Renderer> | Scope.Scope
> =>
  Effect.gen(function* () {
    const handle = makeHost(renderer)
    yield* Effect.addFinalizer(() => Effect.sync(handle.dispose))
    const ctx = Context.make(Renderer.Renderer, { host: handle.host }).pipe(
      Context.add(Gpui.Host, handle.service),
      Context.add(Ui.Host, { platform: "desktop" })
    )
    const root = yield* (Renderer.mount(
      component as any,
      props as any,
      handle.rootContainer
    ) as Effect.Effect<Renderer.Root<Model, Msg>, never, any>).pipe(
      Effect.provideContext(ctx)
    )
    handle.flush()
    return { ...root, flush: handle.flush }
  }) as any

export const run = <
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
  windowOptions: WindowOptions
): Effect.Effect<void, never, Exclude<R | RP, Gpui.Host | Ui.Host | Renderer.Renderer>> =>
  Effect.scoped(
    Effect.gen(function* () {
      const renderer = createNativeRenderer({
        onError: (err) => {
          console.error("[effect-ui-gpui]", err)
        }
      })
      renderer.init(windowOptions)
      yield* mount(component, props, renderer)

      yield* Effect.callback<void>((resume) => {
        const frameLoop = startFrameLoop(renderer, {
          onTerminated: () => resume(Effect.void),
          onError: (err) => console.error("[effect-ui-gpui frame]", err)
        })
        const onSignal = () => {
          frameLoop.stop()
          resume(Effect.void)
        }
        process.once("SIGINT", onSignal)
        process.once("SIGTERM", onSignal)
        return Effect.sync(() => {
          frameLoop.stop()
          process.off("SIGINT", onSignal)
          process.off("SIGTERM", onSignal)
        })
      })
    })
  ) as any
