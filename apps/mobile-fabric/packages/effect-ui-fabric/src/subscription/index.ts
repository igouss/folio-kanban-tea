import { Subscription } from "@effect/ui"
import { Effect, Queue, Stream } from "effect"
// Extensionless on purpose so Metro picks appStateSource.native.ts on device
// while Node/Vitest gets appStateSource.ts without loading react-native.
import { defaultAppState } from "./appStateSource"
import type { AppStateSource, AppStateStatus } from "./source.ts"

export type { AppStateSource, AppStateStatus } from "./source.ts"

const isKnown = (state: string): state is AppStateStatus =>
  state === "active" ||
  state === "background" ||
  state === "inactive" ||
  state === "unknown" ||
  state === "extension"

export const appStateChanges = (
  source: AppStateSource
): Stream.Stream<AppStateStatus> =>
  Stream.callback<AppStateStatus>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const current = source.currentState
        Queue.offerUnsafe(queue, isKnown(current) ? current : "unknown")
        return source.addEventListener("change", (state) => {
          Queue.offerUnsafe(queue, state)
        })
      }),
      (subscription) => Effect.sync(() => subscription.remove())
    )
  ).pipe(Stream.changes)

export const appState: Stream.Stream<AppStateStatus> =
  appStateChanges(defaultAppState)

export const appStateSubscription = <Msg>(
  map: (state: AppStateStatus) => Msg,
  source: AppStateSource = defaultAppState
): Subscription.Subscription<Msg> =>
  Subscription.make("fabric-app-state", appStateChanges(source).pipe(Stream.map(map)))
