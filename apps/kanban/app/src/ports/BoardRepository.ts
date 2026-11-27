import { Command } from "@effect/ui"
import {
  SavedBoardJson,
  SavedBoardSchema,
  type SavedBoardSchema as SavedBoard
} from "@folio/kanban-domain/schema"
import {
  KeyValueStore,
  Lifecycle,
  staticLifecycleLayer
} from "@universal-ui/core"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/**
 * Kanban application outbound port for persisting and loading board state.
 * Independent of storage transport (localStorage, disk JSON, SQLite, memory).
 */
export class BoardRepository extends Context.Service<BoardRepository, {
  readonly load: Effect.Effect<Option.Option<SavedBoard>>
  readonly save: (board: SavedBoard) => Effect.Effect<void>
}>()("@folio/kanban-app/BoardRepository") {}

export class SaveBoard extends Command.Service<SaveBoard>()("folio/SaveBoard", {
  args: SavedBoardSchema
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const repo = yield* BoardRepository
      return (board) => repo.save(board)
    })
  )
}

export const noopBoardRepositoryLayer: Layer.Layer<BoardRepository> =
  Layer.succeed(BoardRepository, {
    load: Effect.succeed(Option.none()),
    save: () => Effect.void
  })

export interface MemoryBoardRepository {
  readonly layer: Layer.Layer<BoardRepository>
  readonly getSaved: () => SavedBoard | undefined
}

export const makeMemoryBoardRepository = (
  initial?: SavedBoard
): MemoryBoardRepository => {
  let saved = initial
  return {
    layer: Layer.succeed(BoardRepository, {
      load: Effect.sync(() => Option.fromUndefinedOr(saved)),
      save: (board) =>
        Effect.sync(() => {
          saved = board
        })
    }),
    getSaved: () => saved
  }
}

/**
 * Driven adapter bridging Kanban's domain BoardRepository port onto
 * @universal-ui/core's generic KeyValueStore port with Effect Schema validation.
 */
export const keyValueBoardRepositoryLayer = (
  storageKey: string
): Layer.Layer<BoardRepository, never, KeyValueStore> =>
  Layer.effect(
    BoardRepository,
    Effect.gen(function* () {
      const store = yield* KeyValueStore
      return {
        load: Effect.map(store.get(storageKey), (maybeRaw) =>
          Option.flatMap(maybeRaw, (raw) => {
            try {
              return Option.some(Schema.decodeUnknownSync(SavedBoardJson)(raw))
            } catch {
              return Option.none()
            }
          })
        ),
        save: (board) =>
          Effect.suspend(() => {
            try {
              const encoded = Schema.encodeSync(SavedBoardJson)(board)
              return store.set(storageKey, encoded)
            } catch {
              return Effect.void
            }
          })
      }
    })
  )

export const loadInitialBoard: Effect.Effect<
  Option.Option<SavedBoard>,
  never,
  BoardRepository
> = Effect.flatMap(BoardRepository, (repo) => repo.load)

export const makeKanbanLayer = (options?: {
  readonly repository?: Layer.Layer<BoardRepository>
  readonly lifecycle?: Layer.Layer<Lifecycle>
}): Layer.Layer<BoardRepository | SaveBoard | Lifecycle> => {
  const repoLayer = options?.repository ?? noopBoardRepositoryLayer
  const lifecycleLayer = options?.lifecycle ?? staticLifecycleLayer("active")
  return Layer.mergeAll(
    repoLayer,
    SaveBoard.layer.pipe(Layer.provide(repoLayer)),
    lifecycleLayer
  )
}

export const makeKanbanLayerFromStore = (options: {
  readonly storageKey: string
  readonly store: Layer.Layer<KeyValueStore>
  readonly lifecycle?: Layer.Layer<Lifecycle>
}): Layer.Layer<BoardRepository | SaveBoard | Lifecycle> =>
  makeKanbanLayer({
    repository: keyValueBoardRepositoryLayer(options.storageKey).pipe(
      Layer.provide(options.store)
    ),
    ...(options.lifecycle !== undefined ? { lifecycle: options.lifecycle } : {})
  })
