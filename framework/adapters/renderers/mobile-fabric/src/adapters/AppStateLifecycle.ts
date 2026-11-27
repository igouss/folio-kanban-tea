import { Lifecycle, type LifecycleState } from "@universal-ui/core"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import {
  appState,
  appStateChanges,
  type AppStateSource,
  type AppStateStatus
} from "../subscription/index.ts"

const toLifecycleState = (status: AppStateStatus): LifecycleState => {
  switch (status) {
    case "background":
      return "background"
    case "inactive":
      return "inactive"
    default:
      return "active"
  }
}

export const makeFabricLifecycleLayer = (
  source?: AppStateSource
): Layer.Layer<Lifecycle> =>
  Layer.succeed(Lifecycle, {
    changes: (source !== undefined ? appStateChanges(source) : appState).pipe(
      Stream.map(toLifecycleState),
      Stream.changes
    )
  })

export const fabricLifecycleLayer: Layer.Layer<Lifecycle> =
  makeFabricLifecycleLayer()
