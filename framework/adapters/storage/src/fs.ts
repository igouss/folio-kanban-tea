import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
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

const isNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { readonly code?: unknown }).code === "ENOENT"

export const makeFileStoreLayer = (
  options: FileStoreOptions
): Layer.Layer<KeyValueStore> =>
  Layer.sync(KeyValueStore, () => {
    const dir = resolveDataDir(options)
    return {
      get: (key) =>
        Effect.tryPromise({
          try: () => readFile(filePathForKey(dir, key), "utf8"),
          catch: (error) => error
        }).pipe(
          Effect.map(Option.some),
          Effect.catch((error) =>
            isNotFoundError(error)
              ? Effect.succeed(Option.none())
              : Effect.logWarning(`Failed to read key "${key}" from file store`).pipe(
                  Effect.as(Option.none())
                )
          )
        ),
      set: (key, value) =>
        Effect.tryPromise({
          try: async () => {
            await mkdir(dir, { recursive: true })
            await writeFile(filePathForKey(dir, key), value, "utf8")
          },
          catch: (error) => error
        }).pipe(
          Effect.catch(() =>
            Effect.logWarning(`Failed to write key "${key}" to file store`)
          )
        ),
      remove: (key) =>
        Effect.tryPromise({
          try: () => unlink(filePathForKey(dir, key)),
          catch: (error) => error
        }).pipe(
          Effect.catch((error) =>
            isNotFoundError(error)
              ? Effect.void
              : Effect.logWarning(`Failed to remove key "${key}" from file store`)
          )
        )
    }
  })
