import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { IdGenerator, Viewport } from "@universal-ui/core"
import { Effect, Fiber, Stream } from "effect"
import {
  makeBrowserViewportLayer,
  type BrowserViewportTarget
} from "../src/browser.ts"
import { cryptoIdGeneratorLayer, makeSequenceIdGeneratorLayer } from "../src/memory.ts"
import { nodeIdGeneratorLayer } from "../src/node.ts"

describe("@universal-ui/platform", () => {
  it("streams viewport resize changes from BrowserViewportTarget", async () => {
    const listeners = new Set<() => void>()
    const fakeWindow: BrowserViewportTarget & { innerWidth: number; innerHeight: number } = {
      innerWidth: 1200,
      innerHeight: 800,
      addEventListener: (_type, listener) => {
        listeners.add(listener)
      },
      removeEventListener: (_type, listener) => {
        listeners.delete(listener)
      }
    }

    const layer = makeBrowserViewportLayer({ target: fakeWindow })
    const collected = await Effect.runPromise(
      Effect.gen(function* () {
        const vp = yield* Viewport
        const initial = yield* vp.current
        const fiber = yield* Effect.forkChild(
          vp.changes.pipe(Stream.take(2), Stream.runCollect)
        )
        yield* Effect.yieldNow
        fakeWindow.innerWidth = 420
        for (const fn of listeners) fn()
        const events = yield* Fiber.join(fiber)
        return { initial, events }
      }).pipe(Effect.provide(layer))
    )

    assert.equal(collected.initial.width, 1200)
    assert.deepEqual(
      collected.events.map((e) => e.width),
      [1200, 420]
    )
    assert.equal(listeners.size, 0)
  })

  it("falls back safely when global window lacks DOM EventTarget methods", async () => {
    const g = globalThis as { window?: object | undefined }
    const hadWindow = "window" in g
    const prevWindow = g.window
    try {
      g.window = {}
      const layer = makeBrowserViewportLayer()
      const metrics = await Effect.runPromise(
        Effect.flatMap(Viewport, (vp) => vp.current).pipe(Effect.provide(layer))
      )
      assert.deepEqual(metrics, { width: 1280, height: 800, topInset: 0 })
    } finally {
      if (hadWindow) g.window = prevWindow
      else delete g.window
    }
  })

  it("provides deterministic, crypto, and Node IdGenerator adapters", async () => {
    const seq = await Effect.runPromise(
      Effect.flatMap(IdGenerator, (g) => g.nextId("task")).pipe(
        Effect.provide(makeSequenceIdGeneratorLayer())
      )
    )
    assert.equal(seq, "task-1")

    const cryptoId = await Effect.runPromise(
      Effect.flatMap(IdGenerator, (g) => g.nextId("task")).pipe(
        Effect.provide(cryptoIdGeneratorLayer)
      )
    )
    assert.ok(cryptoId.startsWith("task-"))

    const nodeId = await Effect.runPromise(
      Effect.flatMap(IdGenerator, (g) => g.nextId("task")).pipe(
        Effect.provide(nodeIdGeneratorLayer)
      )
    )
    assert.ok(nodeId.startsWith("task-"))
  })
})
