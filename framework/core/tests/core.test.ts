import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Effect, Option, Stream } from "effect"
import {
  KeyValueStore,
  Lifecycle,
  Ui,
  makeMemoryKeyValueStore,
  staticLifecycleLayer
} from "../src/index.ts"

describe("@universal-ui/core", () => {
  it("exposes universal-ui vocabulary with textParents invariant", () => {
    assert.equal(Ui.name, "universal-ui")
    assert.deepEqual(Ui.vocabulary.textParents, ["text"])
  })

  it("provides in-memory KeyValueStore port adapter", async () => {
    const mem = makeMemoryKeyValueStore({ theme: "paper" })
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* KeyValueStore
        const initial = yield* store.get("theme")
        yield* store.set("board", '{"cards":[]}')
        const saved = yield* store.get("board")
        yield* store.remove("theme")
        const afterRemove = yield* store.get("theme")
        return { initial, saved, afterRemove }
      }).pipe(Effect.provide(mem.layer))
    )

    assert.deepEqual(result.initial, Option.some("paper"))
    assert.deepEqual(result.saved, Option.some('{"cards":[]}'))
    assert.deepEqual(result.afterRemove, Option.none())
    assert.equal(mem.getRaw("board"), '{"cards":[]}')
  })

  it("provides typed Lifecycle port stream", async () => {
    const states = await Effect.runPromise(
      Effect.gen(function* () {
        const lifecycle = yield* Lifecycle
        return yield* Stream.runCollect(lifecycle.changes)
      }).pipe(Effect.provide(staticLifecycleLayer("active")))
    )
    assert.deepEqual(states, ["active"])
  })
})
