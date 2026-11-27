import { KeyValueStore } from "@universal-ui/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"

export interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface BrowserStoreOptions {
  readonly prefix?: string
  readonly storage?: WebStorageLike | undefined
}

const resolveStorage = (
  explicit: WebStorageLike | undefined
): WebStorageLike | undefined => {
  if (explicit !== undefined) return explicit
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export const makeBrowserStoreLayer = (
  options: BrowserStoreOptions = {}
): Layer.Layer<KeyValueStore> =>
  Layer.sync(KeyValueStore, () => {
    const prefix = options.prefix ?? ""
    const fullKey = (key: string) => `${prefix}${key}`

    return {
      get: (key) =>
        Effect.try({
          try: () => resolveStorage(options.storage)?.getItem(fullKey(key)),
          catch: (error) => error
        }).pipe(
          Effect.map((raw) =>
            raw !== null && raw !== undefined ? Option.some(raw) : Option.none()
          ),
          Effect.catch(() => Effect.succeed(Option.none()))
        ),
      set: (key, value) =>
        Effect.try({
          try: () => {
            resolveStorage(options.storage)?.setItem(fullKey(key), value)
          },
          catch: (error) => error
        }).pipe(Effect.catch(() => Effect.void)),
      remove: (key) =>
        Effect.try({
          try: () => {
            resolveStorage(options.storage)?.removeItem(fullKey(key))
          },
          catch: (error) => error
        }).pipe(Effect.catch(() => Effect.void))
    }
  })

export const browserStoreLayer: Layer.Layer<KeyValueStore> = makeBrowserStoreLayer()
