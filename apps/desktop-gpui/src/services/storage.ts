import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { SavedBoardJson, type SavedBoard } from "../domain/board.ts"

export class BoardStorage extends Context.Service<BoardStorage, {
  readonly load: Effect.Effect<SavedBoard | undefined>
  readonly save: (board: SavedBoard) => Effect.Effect<void>
}>()("@folio/desktop-gpui/BoardStorage") {}

const defaultFilePath = (): string => {
  const xdg = process.env["XDG_DATA_HOME"]
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".local", "share")
  return join(base, "folio-kanban-gpui", "board.json")
}

export const makeFileStorageLayer = (
  filePath = defaultFilePath()
): Layer.Layer<BoardStorage> =>
  Layer.succeed(BoardStorage, {
    load: Effect.sync(() => {
      if (!existsSync(filePath)) return undefined
      try {
        const raw = readFileSync(filePath, "utf8")
        return Schema.decodeUnknownSync(SavedBoardJson)(raw)
      } catch {
        return undefined
      }
    }),
    save: (board) =>
      Effect.sync(() => {
        try {
          mkdirSync(dirname(filePath), { recursive: true })
          writeFileSync(
            filePath,
            Schema.encodeSync(SavedBoardJson)(board),
            "utf8"
          )
        } catch {
          // Ignore disk persistence failures in restricted environments.
        }
      })
  })

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
