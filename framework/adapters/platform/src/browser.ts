import {
  IdGenerator,
  Lifecycle,
  Viewport,
  type LifecycleState,
  type ViewportMetrics
} from "@universal-ui/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import { cryptoIdGeneratorLayer } from "./memory.ts"

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

export interface BrowserViewportTarget {
  readonly innerWidth: number
  readonly innerHeight: number
  addEventListener(type: "resize", listener: () => void): void
  removeEventListener(type: "resize", listener: () => void): void
}

const readBrowserViewport = (
  target: BrowserViewportTarget | undefined,
  topInset: number
): ViewportMetrics => ({
  width: target?.innerWidth ?? 1280,
  height: target?.innerHeight ?? 800,
  topInset
})

export const makeBrowserViewportLayer = (options?: {
  readonly target?: BrowserViewportTarget | undefined
  readonly topInset?: number | undefined
}): Layer.Layer<Viewport> => {
  const topInset = options?.topInset ?? 0
  const resolveTarget = (): BrowserViewportTarget | undefined =>
    options?.target ??
    (typeof window !== "undefined" ? (window as unknown as BrowserViewportTarget) : undefined)

  return Layer.succeed(Viewport, {
    current: Effect.sync(() => readBrowserViewport(resolveTarget(), topInset)),
    changes: Stream.callback<ViewportMetrics>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const target = resolveTarget()
          Queue.offerUnsafe(queue, readBrowserViewport(target, topInset))
          if (target === undefined) {
            return () => {}
          }
          const onResize = () => {
            Queue.offerUnsafe(queue, readBrowserViewport(target, topInset))
          }
          target.addEventListener("resize", onResize)
          return () => target.removeEventListener("resize", onResize)
        }),
        (cleanup) => Effect.sync(cleanup)
      )
    ).pipe(
      Stream.changesWith(
        (a, b) =>
          a.width === b.width &&
          a.height === b.height &&
          a.topInset === b.topInset
      )
    )
  })
}

export const browserViewportLayer: Layer.Layer<Viewport> =
  makeBrowserViewportLayer()

export const browserIdGeneratorLayer: Layer.Layer<IdGenerator> =
  cryptoIdGeneratorLayer
