import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"

/**
 * Outbound port for persistent string key-value storage across platforms.
 * Implemented by platform adapters (Browser localStorage, Node FileStore,
 * Native storage, or in-memory test doubles).
 */
export class KeyValueStore extends Context.Service<KeyValueStore, {
  readonly get: (key: string) => Effect.Effect<Option.Option<string>>
  readonly set: (key: string, value: string) => Effect.Effect<void>
  readonly remove: (key: string) => Effect.Effect<void>
}>()("@universal-ui/core/KeyValueStore") {}

export const noopKeyValueStoreLayer: Layer.Layer<KeyValueStore> = Layer.succeed(
  KeyValueStore,
  {
    get: () => Effect.succeed(Option.none()),
    set: () => Effect.void,
    remove: () => Effect.void
  }
)

export interface MemoryKeyValueStore {
  readonly layer: Layer.Layer<KeyValueStore>
  readonly entries: ReadonlyMap<string, string>
  readonly getRaw: (key: string) => string | undefined
}

export const makeMemoryKeyValueStore = (
  initial?: Readonly<Record<string, string>>
): MemoryKeyValueStore => {
  const store = new Map<string, string>(
    initial !== undefined ? Object.entries(initial) : []
  )
  return {
    layer: Layer.succeed(KeyValueStore, {
      get: (key) => Effect.sync(() => Option.fromUndefinedOr(store.get(key))),
      set: (key, value) =>
        Effect.sync(() => {
          store.set(key, value)
        }),
      remove: (key) =>
        Effect.sync(() => {
          store.delete(key)
        })
    }),
    entries: store,
    getRaw: (key) => store.get(key)
  }
}
