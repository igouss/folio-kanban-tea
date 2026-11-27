import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { KeyValueStore } from "@universal-ui/core"
import { Effect, Option } from "effect"
import { makeBrowserStoreLayer, type WebStorageLike } from "../src/browser.ts"
import { makeFileStoreLayer } from "../src/fs.ts"
import { makeMemoryKeyValueStore } from "../src/memory.ts"

describe("@universal-ui/storage", () => {
  it("adapts WebStorageLike to KeyValueStore with key prefixing", async () => {
    const raw = new Map<string, string>()
    const fakeStorage: WebStorageLike = {
      getItem: (k) => raw.get(k) ?? null,
      setItem: (k, v) => {
        raw.set(k, v)
      },
      removeItem: (k) => {
        raw.delete(k)
      }
    }

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* KeyValueStore
        yield* store.set("state", "ok")
        const loaded = yield* store.get("state")
        yield* store.remove("state")
        const removed = yield* store.get("state")
        return { loaded, removed }
      }).pipe(
        Effect.provide(
          makeBrowserStoreLayer({ prefix: "demo.", storage: fakeStorage })
        )
      )
    )

    assert.deepEqual(result.loaded, Option.some("ok"))
    assert.deepEqual(result.removed, Option.none())
  })

  it("adapts Node filesystem to KeyValueStore", async () => {
    const dir = mkdtempSync(join(tmpdir(), "universal-ui-storage-"))
    try {
      const storeLayer = makeFileStoreLayer({
        appDirName: "test-app",
        baseDir: dir
      })

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const store = yield* KeyValueStore
          const before = yield* store.get("prefs")
          yield* store.set("prefs", '{"theme":"dark"}')
          const after = yield* store.get("prefs")
          yield* store.remove("prefs")
          const removed = yield* store.get("prefs")
          return { before, after, removed }
        }).pipe(Effect.provide(storeLayer))
      )

      assert.deepEqual(result.before, Option.none())
      assert.deepEqual(result.after, Option.some('{"theme":"dark"}'))
      assert.deepEqual(result.removed, Option.none())
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("provides in-memory KeyValueStore adapter", async () => {
    const mem = makeMemoryKeyValueStore()
    await Effect.runPromise(
      Effect.flatMap(KeyValueStore, (store) => store.set("k", "v")).pipe(
        Effect.provide(mem.layer)
      )
    )
    assert.equal(mem.getRaw("k"), "v")
  })
})
