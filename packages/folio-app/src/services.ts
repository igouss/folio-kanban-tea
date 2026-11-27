import { Command } from "@effect/ui"
import {
  SavedBoardSchema,
  type SavedBoardSchema as SavedBoard
} from "@folio/kanban-core/schema"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"

export class BoardStorage extends Context.Service<BoardStorage, {
  readonly load: Effect.Effect<SavedBoard | undefined>
  readonly save: (board: SavedBoard) => Effect.Effect<void>
}>()("@folio/folio-app/BoardStorage") {}

export class SaveBoard extends Command.Service<SaveBoard>()("folio/SaveBoard", {
  args: SavedBoardSchema
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const storage = yield* BoardStorage
      return (board) => storage.save(board)
    })
  )
}

export const noopStorageLayer: Layer.Layer<BoardStorage> = Layer.succeed(
  BoardStorage,
  {
    load: Effect.succeed(undefined),
    save: () => Effect.void
  }
)

export const makeMemoryStorageLayer = (
  initial?: SavedBoard
): {
  readonly layer: Layer.Layer<BoardStorage>
  readonly getSaved: () => SavedBoard | undefined
} => {
  let saved = initial
  return {
    layer: Layer.succeed(BoardStorage, {
      load: Effect.sync(() => saved),
      save: (board) =>
        Effect.sync(() => {
          saved = board
        })
    }),
    getSaved: () => saved
  }
}

export class AppLifecycle extends Context.Service<AppLifecycle, {
  readonly changes: Stream.Stream<string>
}>()("@folio/folio-app/AppLifecycle") {}

export const staticLifecycleLayer = (
  initial = "active"
): Layer.Layer<AppLifecycle> =>
  Layer.succeed(AppLifecycle, {
    changes: Stream.make(initial)
  })

export const makeLifecycleLayer = (
  changes: Stream.Stream<string>
): Layer.Layer<AppLifecycle> =>
  Layer.succeed(AppLifecycle, { changes })

export const loadInitialBoard: Effect.Effect<
  Option.Option<SavedBoard>,
  never,
  BoardStorage
> = Effect.gen(function* () {
  const storage = yield* BoardStorage
  const saved = yield* storage.load
  return Option.fromUndefinedOr(saved)
})

export const makeAppLayer = (options?: {
  readonly storage?: Layer.Layer<BoardStorage>
  readonly lifecycle?: Layer.Layer<AppLifecycle>
}): Layer.Layer<BoardStorage | SaveBoard | AppLifecycle> => {
  const storageLayer = options?.storage ?? noopStorageLayer
  const lifecycleLayer = options?.lifecycle ?? staticLifecycleLayer("active")
  return Layer.mergeAll(
    storageLayer,
    SaveBoard.layer.pipe(Layer.provide(storageLayer)),
    lifecycleLayer
  )
}
