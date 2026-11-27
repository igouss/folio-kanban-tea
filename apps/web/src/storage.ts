import {
  AppLifecycle,
  BoardStorage
} from "@folio/folio-app"
import { SavedBoardJson } from "@folio/kanban-core/schema"
import { Effect, Layer, Queue, Schema, Stream } from "effect"

const STORAGE_KEY = "folio.unified.kanban.v1"

export const browserStorageLayer: Layer.Layer<BoardStorage> = Layer.succeed(
  BoardStorage,
  {
    load: Effect.sync(() => {
      try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
        if (!raw) return undefined
        return Schema.decodeUnknownSync(SavedBoardJson)(raw)
      } catch {
        return undefined
      }
    }),
    save: (board) =>
      Effect.sync(() => {
        try {
          globalThis.localStorage?.setItem(
            STORAGE_KEY,
            Schema.encodeSync(SavedBoardJson)(board)
          )
        } catch {
          // Ignore storage quota or private-browsing failures.
        }
      })
  }
)

export const browserLifecycleLayer: Layer.Layer<AppLifecycle> = Layer.succeed(
  AppLifecycle,
  {
    changes: Stream.callback<string>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const read = () =>
            typeof document !== "undefined" && document.visibilityState === "hidden"
              ? "background"
              : "active"
          Queue.offerUnsafe(queue, read())
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
