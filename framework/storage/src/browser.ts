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
): Layer.Layer<KeyValueStore> => {
  const prefix = options.prefix ?? ""
  const fullKey = (key: string) => `${prefix}${key}`

  return Layer.succeed(KeyValueStore, {
    get: (key) =>
      Effect.sync(() => {
        try {
          const raw = resolveStorage(options.storage)?.getItem(fullKey(key))
          return raw !== null && raw !== undefined ? Option.some(raw) : Option.none()
        } catch {
          return Option.none()
        }
      }),
    set: (key, value) =>
      Effect.sync(() => {
        try {
          resolveStorage(options.storage)?.setItem(fullKey(key), value)
        } catch {
          // Ignore quota or private-browsing storage errors.
        }
      }),
    remove: (key) =>
      Effect.sync(() => {
        try {
          resolveStorage(options.storage)?.removeItem(fullKey(key))
        } catch {
          // Ignore storage removal errors.
        }
      })
  })
}

export const browserStoreLayer: Layer.Layer<KeyValueStore> = makeBrowserStoreLayer()
