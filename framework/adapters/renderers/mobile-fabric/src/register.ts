import type { Component, View } from "@effect/ui"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  Engine,
  type StyleSheet as CssStyleSheet,
  getFabricUIManager,
  registerPlatformComponents
} from "@ng-native/fabric"
import {
  AppRegistry,
  Image,
  Platform,
  StyleSheet,
  processColor
} from "react-native"
import {
  mountAppWithLayer,
  type FabricAppRequirements,
  type MountedFabricApp
} from "./FabricHost.ts"
import {
  initialRegistrationState,
  transitionRegistration,
  type RegistrationState
} from "./fsm.ts"
import { currentConditions, watchConditions } from "./css/conditions.ts"
import { attachStyles } from "./css/index.ts"

export type RegisterAppOptions<Required = never> = Readonly<{
  appKey?: string | undefined
  styleSheet?: CssStyleSheet | undefined
}> &
  ([Required] extends [never]
    ? { readonly layer?: Layer.Layer<never> | undefined }
    : { readonly layer: Layer.Layer<Required> })

type Registration = { state: RegistrationState }

type Registry = {
  apps: Map<string, Registration>
  isStopSurfaceInstalled: boolean
}

const REGISTRY = Symbol.for("@universal-ui/host-fabric.registry")

const registry = (): Registry => {
  const globalObj = globalThis as { [REGISTRY]?: Registry }
  globalObj[REGISTRY] ??= { apps: new Map(), isStopSurfaceInstalled: false }
  return globalObj[REGISTRY]
}

const stop = (registration: Registration): void => {
  const { next, disposeToRun } = transitionRegistration(registration.state, {
    _tag: "Stop"
  })
  registration.state = next
  disposeToRun?.()
}

const installStopSurface = (apps: Registry): void => {
  if (apps.isStopSurfaceInstalled) return
  apps.isStopSurfaceInstalled = true
  const host = globalThis as { RN$stopSurface?: (surfaceId: number) => void }
  const previousStopSurface = host.RN$stopSurface
  host.RN$stopSurface = (surfaceId) => {
    apps.apps.forEach((registration) => {
      const { next, disposeToRun } = transitionRegistration(
        registration.state,
        { _tag: "StopSurface", surfaceId }
      )
      registration.state = next
      disposeToRun?.()
    })
    previousStopSurface?.(surfaceId)
  }
}

export const registerApp = <
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
  ...rest: [FabricAppRequirements<R, RP, V>] extends [never]
    ? [options?: RegisterAppOptions<never>]
    : [options: RegisterAppOptions<FabricAppRequirements<R, RP, V>>]
): void => {
  const { appKey = "main", styleSheet, layer } = (rest[0] ?? {}) as {
    readonly appKey?: string | undefined
    readonly styleSheet?: CssStyleSheet | undefined
    readonly layer?: Layer.Layer<FabricAppRequirements<R, RP, V>> | undefined
  }
  registerPlatformComponents(Platform.OS)

  const apps = registry()
  installStopSurface(apps)
  const registration = apps.apps.get(appKey) ?? {
    state: initialRegistrationState
  }
  apps.apps.set(appKey, registration)

  const start = (surfaceId: number): void => {
    stop(registration)
    const conditions = currentConditions()
    const engine = new Engine(getFabricUIManager(), surfaceId, {
      processColor: (value) => processColor(value),
      resolveAssetSource: (value) =>
        Image.resolveAssetSource(
          value as Parameters<typeof Image.resolveAssetSource>[0]
        ),
      conditions,
      tokens: { "--hairline": { length: StyleSheet.hairlineWidth } },
      globalStyles: styleSheet ?? null
    })
    const unwatch =
      styleSheet === undefined
        ? () => {}
        : watchConditions(
            attachStyles(engine, { platform: Platform.OS, conditions })
          )
    const providedLayer: Layer.Layer<FabricAppRequirements<R, RP, V>> =
      layer ?? (Layer.empty as Layer.Layer<FabricAppRequirements<R, RP, V>>)
    const mounted: MountedFabricApp<Model, Msg> = mountAppWithLayer(
      component,
      props,
      engine,
      { platform: Platform.OS },
      providedLayer
    )
    const { next, disposeToRun } = transitionRegistration(registration.state, {
      _tag: "Start",
      surfaceId,
      dispose: () => {
        unwatch()
        mounted.dispose()
      }
    })
    registration.state = next
    disposeToRun?.()
  }

  AppRegistry.registerRunnable(
    appKey,
    ({ rootTag }: { rootTag: number | string }) => {
      start(Number(rootTag))
    }
  )

  if (registration.state._tag === "Running") {
    start(registration.state.surfaceId)
  }
}
