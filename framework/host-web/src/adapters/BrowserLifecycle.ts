import { Lifecycle, type LifecycleState } from "@universal-ui/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"

export const browserLifecycleLayer: Layer.Layer<Lifecycle> = Layer.succeed(
  Lifecycle,
  {
    changes: Stream.callback<LifecycleState>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const read = (): LifecycleState =>
            typeof document !== "undefined" && document.visibilityState === "hidden"
              ? "background"
              : "active"
          Queue.offerUnsafe(queue, read())
          if (typeof document === "undefined") {
            return () => {}
          }
          const onChange = () => {
            Queue.offerUnsafe(queue, read())
          }
          document.addEventListener("visibilitychange", onChange)
          return () => document.removeEventListener("visibilitychange", onChange)
        }),
        (cleanup) => Effect.sync(cleanup)
      )
    ).pipe(Stream.changes)
  }
)
