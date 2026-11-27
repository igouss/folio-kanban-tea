import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

export const LifecycleState = Schema.Literals(["active", "inactive", "background"])
export type LifecycleState = typeof LifecycleState.Type

/**
 * Outbound port for observing host application lifecycle transitions
 * (foreground active, inactive, background).
 */
export class Lifecycle extends Context.Service<Lifecycle, {
  readonly changes: Stream.Stream<LifecycleState>
}>()("@universal-ui/core/Lifecycle") {}

export const staticLifecycleLayer = (
  initial: LifecycleState = "active"
): Layer.Layer<Lifecycle> =>
  Layer.succeed(Lifecycle, {
    changes: Stream.make(initial)
  })

export const makeLifecycleLayer = (
  changes: Stream.Stream<LifecycleState>
): Layer.Layer<Lifecycle> =>
  Layer.succeed(Lifecycle, { changes })
