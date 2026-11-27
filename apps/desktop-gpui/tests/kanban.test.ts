import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { GpuiHost } from "@folio/effect-ui-gpui"
import { createFakeGpuixRenderer } from "@folio/effect-ui-gpui/testing"
import { Effect, Layer, Option } from "effect"
import { KanbanDesktop, SaveBoard } from "../src/components/KanbanDesktop.ts"
import { makeMemoryStorageLayer } from "../src/services/storage.ts"

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 10))

describe("Folio Kanban Desktop (@effect/ui + Zed GPUI Host)", () => {
  it("mounts on GPUI, updates window title, moves cards, toggles theme, adds & edits cards", async () => {
    const renderer = createFakeGpuixRenderer()
    const storage = makeMemoryStorageLayer()
    const appLayer = Layer.merge(
      storage.layer,
      SaveBoard.layer.pipe(Layer.provide(storage.layer))
    )

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const root = yield* GpuiHost.mount(
            KanbanDesktop,
            { initialBoard: Option.none() },
            renderer
          )

          assert.ok(renderer.getRootId() !== undefined)
          assert.ok(renderer.getBatchCount() >= 1)
          assert.ok(renderer.getWindowTitle().includes("8 cards"))
          assert.ok(renderer.getAllText().includes("Folio Kanban"))
          assert.ok(renderer.getAllText().includes("@effect/ui"))
          assert.ok(renderer.getAllText().includes("GPUI · Native GPU"))

          // Move FOL-101 from In Progress to In Review via native GPUI click
          renderer.clickByTestId("card.next.card-101")
          yield* Effect.promise(tick)

          const afterMove = root.model()!
          const inProgress = afterMove.columns.find((c) => c.id === "in_progress")!
          const review = afterMove.columns.find((c) => c.id === "review")!
          assert.equal(
            inProgress.cards.some((c) => c.id === "card-101"),
            false
          )
          assert.equal(review.cards[0]?.id, "card-101")
          assert.equal(afterMove.dispatchCount, 1)
          assert.ok(storage.getSaved() !== undefined)

          // Toggle Paper -> Graphite theme
          renderer.clickByTestId("theme.toggle")
          yield* Effect.promise(tick)
          assert.equal(root.model()!.theme, "graphite")
          assert.equal(storage.getSaved()!.theme, "graphite")

          // Quick-add a card to Backlog via native GPUI input + submit
          renderer.clickByTestId("lane.add.backlog")
          yield* Effect.promise(tick)
          renderer.typeByTestId("add.input", "Ship @effect/ui on Zed GPUI")
          yield* Effect.promise(tick)
          renderer.submitByTestId("add.input", "Ship @effect/ui on Zed GPUI")
          yield* Effect.promise(tick)

          const backlog = root.model()!.columns.find((c) => c.id === "backlog")!
          const created = backlog.cards.find(
            (c) => c.title === "Ship @effect/ui on Zed GPUI"
          )
          assert.ok(created)
          assert.equal(created.code, "FOL-109")
          assert.ok(renderer.getWindowTitle().includes("9 cards"))

          // Filter by search query
          renderer.typeByTestId("board.search", "Zed GPUI")
          yield* Effect.promise(tick)
          assert.ok(renderer.findByTestId(`card.${created.id}`) !== undefined)
          assert.equal(renderer.findByTestId("card.card-101"), undefined)
          renderer.typeByTestId("board.search", "")
          yield* Effect.promise(tick)

          // Open editor modal, edit title, move lane, and save
          renderer.clickByTestId("card.open.card-104")
          yield* Effect.promise(tick)
          assert.ok(renderer.findByTestId("editor.modal") !== undefined)
          renderer.typeByTestId("editor.title", "Refined GPUI native host")
          yield* Effect.promise(tick)
          renderer.clickByTestId("editor.lane.done")
          yield* Effect.promise(tick)
          renderer.clickByTestId("editor.save")
          yield* Effect.promise(tick)

          assert.equal(renderer.findByTestId("editor.modal"), undefined)
          const done = root.model()!.columns.find((c) => c.id === "done")!
          assert.equal(done.cards[0]?.title, "Refined GPUI native host")

          // Undo & Redo via @ui-sdk/core createUndoStack
          assert.equal(root.model()!.canUndo, true)
          renderer.clickByTestId("board.undo")
          yield* Effect.promise(tick)
          assert.equal(
            root.model()!.columns.find((c) => c.id === "done")!.cards[0]?.title ===
              "Refined GPUI native host",
            false
          )
          assert.equal(root.model()!.canRedo, true)
          renderer.clickByTestId("board.redo")
          yield* Effect.promise(tick)
          assert.equal(
            root.model()!.columns.find((c) => c.id === "done")!.cards[0]?.title,
            "Refined GPUI native host"
          )
        })
      ).pipe(Effect.provide(appLayer))
    )
  })
})
