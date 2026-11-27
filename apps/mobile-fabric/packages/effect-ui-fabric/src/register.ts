import type { Component, View } from "@effect/ui"
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
import type * as Fabric from "./Fabric.ts"
import { mountApp, type MountedFabricApp } from "./FabricHost.ts"
import { currentConditions, watchConditions } from "./css/conditions.ts"
import { attachStyles } from "./css/index.ts"

export type RegisterAppOptions = Readonly<{
  appKey?: string | undefined
  styleSheet?: CssStyleSheet | undefined
}>

type RunningApp = Readonly<{
  surfaceId: number
  dispose: () => void
}>

type Registration = { running: RunningApp | undefined }

type Registry = {
  apps: Map<string, Registration>
  isStopSurfaceInstalled: boolean
}

const REGISTRY = Symbol.for("@folio/effect-ui-fabric.registry")

const registry = (): Registry => {
  const globalObj = globalThis as { [REGISTRY]?: Registry }
  globalObj[REGISTRY] ??= { apps: new Map(), isStopSurfaceInstalled: false }
  return globalObj[REGISTRY]
}

const stop = (registration: Registration): void => {
  const stopping = registration.running
  registration.running = undefined
  stopping?.dispose()
}

const installStopSurface = (apps: Registry): void => {
  if (apps.isStopSurfaceInstalled) return
  apps.isStopSurfaceInstalled = true
  const host = globalThis as { RN$stopSurface?: (surfaceId: number) => void }
  const previousStopSurface = host.RN$stopSurface
  host.RN$stopSurface = (surfaceId) => {
    apps.apps.forEach((registration) => {
      if (registration.running?.surfaceId === surfaceId) {
        stop(registration)
      }
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
  V extends View.Elements
>(
  component: Component.Members<Name, Props, Model, Msg, Events, Fabric.Host, V, any>,
  props: Props,
  { appKey = "main", styleSheet }: RegisterAppOptions = {}
): void => {
  registerPlatformComponents(Platform.OS)

  const apps = registry()
  installStopSurface(apps)
  const registration = apps.apps.get(appKey) ?? { running: undefined }
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
    const mounted: MountedFabricApp<Model, Msg> = mountApp(
      component,
      props,
      engine,
      { platform: Platform.OS }
    )
    registration.running = {
      surfaceId,
      dispose: () => {
        unwatch()
        mounted.dispose()
      }
    }
  }

  AppRegistry.registerRunnable(
    appKey,
    ({ rootTag }: { rootTag: number | string }) => {
      start(Number(rootTag))
    }
  )

  const alreadyRunning = registration.running
  if (alreadyRunning !== undefined) {
    start(alreadyRunning.surfaceId)
  }
}
