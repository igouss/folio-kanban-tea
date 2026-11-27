import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { KeyValueStore } from "@universal-ui/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"

export interface FileStoreOptions {
  readonly appDirName: string
  readonly baseDir?: string | undefined
}

const resolveDataDir = (options: FileStoreOptions): string => {
  if (options.baseDir !== undefined && options.baseDir.length > 0) {
    return options.baseDir
  }
  const xdg = process.env["XDG_DATA_HOME"]
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".local", "share")
  return join(base, options.appDirName)
}

const filePathForKey = (dir: string, key: string): string => {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_")
  return join(dir, `${safe}.json`)
}

export const makeFileStoreLayer = (
  options: FileStoreOptions
): Layer.Layer<KeyValueStore> => {
  const dir = resolveDataDir(options)
  return Layer.succeed(KeyValueStore, {
    get: (key) =>
      Effect.sync(() => {
        const filePath = filePathForKey(dir, key)
        if (!existsSync(filePath)) return Option.none()
        try {
          return Option.some(readFileSync(filePath, "utf8"))
        } catch {
          return Option.none()
        }
      }),
    set: (key, value) =>
      Effect.sync(() => {
        try {
          mkdirSync(dir, { recursive: true })
          writeFileSync(filePathForKey(dir, key), value, "utf8")
        } catch {
          // Ignore disk persistence failures in restricted environments.
        }
      }),
    remove: (key) =>
      Effect.sync(() => {
        const filePath = filePathForKey(dir, key)
        if (!existsSync(filePath)) return
        try {
          unlinkSync(filePath)
        } catch {
          // Ignore file removal errors.
        }
      })
  })
}
