import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Effect, Fiber, Option, Stream } from "effect"
import {
  IdGenerator,
  KeyValueStore,
  Lifecycle,
  Ui,
  Viewport,
  makeMemoryKeyValueStore,
  makeSequenceIdGeneratorLayer,
  startScopedMachine,
  staticLifecycleLayer,
  staticViewportLayer
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

  it("provides typed Lifecycle, Viewport, and IdGenerator ports", async () => {
    const states = await Effect.runPromise(
      Effect.gen(function* () {
        const lifecycle = yield* Lifecycle
        return yield* Stream.runCollect(lifecycle.changes)
      }).pipe(Effect.provide(staticLifecycleLayer("active")))
    )
    assert.deepEqual(states, ["active"])

    const viewport = await Effect.runPromise(
      Effect.flatMap(Viewport, (vp) => vp.current).pipe(
        Effect.provide(staticViewportLayer({ width: 1280, height: 800, topInset: 0 }))
      )
    )
    assert.deepEqual(viewport, { width: 1280, height: 800, topInset: 0 })

    const seqLayer = makeSequenceIdGeneratorLayer()
    const ids = await Effect.runPromise(
      Effect.gen(function* () {
        const gen = yield* IdGenerator
        return [yield* gen.nextId("card"), yield* gen.nextId("card")]
      }).pipe(Effect.provide(seqLayer))
    )
    assert.deepEqual(ids, ["card-1", "card-2"])

    // Reusing the same sequence layer starts fresh per build
    const isolatedIds = await Effect.runPromise(
      Effect.flatMap(IdGenerator, (gen) => gen.nextId("card")).pipe(
        Effect.provide(seqLayer)
      )
    )
    assert.equal(isolatedIds, "card-1")
  })

  it("runs a scoped effectful state machine with streaming snapshots and switch interruption", async () => {
    const snapshots = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* startScopedMachine<
            { readonly _tag: "Idle" } | { readonly _tag: "Done"; readonly value: string },
            { readonly _tag: "Run"; readonly value: string; readonly delayMs: number }
          >({
            initial: { _tag: "Idle" },
            mode: "switch",
            handle: ({ event, setState }) =>
              Effect.gen(function* () {
                if (event.delayMs > 0) {
                  yield* Effect.promise(
                    () => new Promise((resolve) => setTimeout(resolve, event.delayMs))
                  )
                }
                yield* setState({ _tag: "Done", value: event.value })
              })
          })

          const collector = yield* Effect.forkChild(
            actor.changes.pipe(Stream.take(2), Stream.runCollect)
          )
          yield* Effect.yieldNow

          // First slow run gets interrupted by second fast run in "switch" mode
          yield* actor.send({ _tag: "Run", value: "stale", delayMs: 80 })
          yield* Effect.yieldNow
          yield* actor.send({ _tag: "Run", value: "fresh", delayMs: 0 })

          return yield* Fiber.join(collector)
        })
      )
    )

    assert.deepEqual(snapshots, [
      { _tag: "Idle" },
      { _tag: "Done", value: "fresh" }
    ])
  })
})
