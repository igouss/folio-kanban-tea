import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { BoardStorage } from "@folio/folio-app"
import { SavedBoardJson } from "@folio/kanban-core/schema"
import { Effect, Layer, Schema } from "effect"

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
