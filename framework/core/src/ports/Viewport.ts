import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

export const ViewportMetricsSchema = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
  topInset: Schema.Number
})
export type ViewportMetrics = typeof ViewportMetricsSchema.Type

/**
 * Outbound port for reading and observing host viewport geometry and safe-area insets.
 */
export class Viewport extends Context.Service<Viewport, {
  readonly current: Effect.Effect<ViewportMetrics>
  readonly changes: Stream.Stream<ViewportMetrics>
}>()("@universal-ui/core/Viewport") {}

export const staticViewportLayer = (
  metrics: ViewportMetrics
): Layer.Layer<Viewport> =>
  Layer.succeed(Viewport, {
    current: Effect.succeed(metrics),
    changes: Stream.make(metrics)
  })
