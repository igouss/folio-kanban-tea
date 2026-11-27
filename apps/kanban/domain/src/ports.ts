import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type { SavedBoard } from "./types.ts"

/**
 * Domain outbound port for loading and persisting Kanban board state.
 * Completely independent of UI frameworks, serialization formats, and storage transports.
 */
export class BoardRepository extends Context.Service<BoardRepository, {
  readonly load: Effect.Effect<Option.Option<SavedBoard>>
  readonly save: (board: SavedBoard) => Effect.Effect<void>
}>()("@folio/kanban-domain/BoardRepository") {}

export const loadInitialBoard: Effect.Effect<
  Option.Option<SavedBoard>,
  never,
  BoardRepository
> = Effect.flatMap(BoardRepository, (repo) => repo.load)

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
