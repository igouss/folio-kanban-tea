import { Command } from "@effect/ui"
import { BoardRepository } from "@folio/kanban-domain/ports"
import { SavedBoardSchema } from "@folio/kanban-domain/schema"
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"

/**
 * Application command that delegates board persistence to the domain BoardRepository port.
 * Knows nothing about KeyValueStore, JSON, localStorage, or filesystems.
 */
export class SaveBoard extends Command.Service<SaveBoard>()("folio/SaveBoard", {
  args: SavedBoardSchema,
  mode: "queue"
}) {
  static readonly layer: Layer.Layer<SaveBoard, never, BoardRepository> =
    this.toLayer(
      Effect.gen(function* () {
        const repo = yield* BoardRepository
        return (board) => repo.save(board)
      })
    )
}
