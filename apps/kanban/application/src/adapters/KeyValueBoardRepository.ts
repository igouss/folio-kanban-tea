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
      const decodeBoard = Schema.decodeUnknownEffect(SavedBoardJson)
      const encodeBoard = Schema.encodeEffect(SavedBoardJson)

      return {
        load: Effect.flatMap(store.get(storageKey), (maybeRaw) =>
          Option.match(maybeRaw, {
            onNone: () => Effect.succeed(Option.none()),
            onSome: (raw) =>
              decodeBoard(raw).pipe(
                Effect.tapError((error) =>
                  Effect.logWarning(
                    `Ignoring corrupt saved board at "${storageKey}": ${error.message}`
                  )
                ),
                Effect.option
              )
          })
        ),
        save: (board) =>
          encodeBoard(board).pipe(
            Effect.flatMap((encoded) => store.set(storageKey, encoded)),
            Effect.catch((error) =>
              Effect.logWarning(
                `Failed to serialize board for "${storageKey}": ${error.message}`
              )
            )
          )
      }
    })
  )
