import { BoardRepository } from "@folio/kanban-domain/ports"
import { SavedBoardJson } from "@folio/kanban-domain/schema"
import { KeyValueStore } from "@universal-ui/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/**
 * Driven storage adapter bridging the domain BoardRepository port onto
 * @universal-ui/core's KeyValueStore port with JSON Effect Schema validation.
 * Platform composition roots opt into this adapter (or swap in any other
 * BoardRepository implementation, such as SQLite or an HTTP API).
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
