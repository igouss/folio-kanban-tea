import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { KeyValueStore } from "@universal-ui/core"
import { Effect, Option } from "effect"
import { makeFileStoreLayer } from "../src/index.ts"

describe("@universal-ui/host-gpui", () => {
  it("adapts Node filesystem to the KeyValueStore port", async () => {
    const dir = mkdtempSync(join(tmpdir(), "universal-ui-gpui-store-"))
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
})
