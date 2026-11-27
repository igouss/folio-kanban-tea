import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FolioApp,
  desktopAppProps,
  makeKanbanLayer,
  makeMemoryBoardRepository
} from "@folio/kanban-app"
import { canRedoHistory, canUndoHistory, cardsInLane } from "@folio/kanban-domain"
import { GpuiHost } from "@universal-ui/host-gpui"
import { createFakeGpuixRenderer } from "@universal-ui/host-gpui/testing"
import { Effect } from "effect"

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 15))

const waitFor = async (predicate: () => boolean, timeoutMs = 500): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) break
    await tick()
  }
}

describe("Folio Kanban Desktop (@folio/kanban-app on @universal-ui/host-gpui)", () => {
  it("mounts FolioApp on GPUI, updates window title, moves cards, toggles theme, adds & edits cards", async () => {
    const renderer = createFakeGpuixRenderer()
    const repo = makeMemoryBoardRepository()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const root = yield* GpuiHost.mount(
            FolioApp,
            desktopAppProps(),
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
          yield* Effect.promise(() =>
            waitFor(() => repo.getSaved() !== undefined)
          )

          const afterMove = root.model()!
          const inProgress = cardsInLane(afterMove.cards, "in_progress")
          const review = cardsInLane(afterMove.cards, "review")
          assert.equal(
            inProgress.some((c) => c.id === "card-101"),
            false
          )
          assert.equal(review[0]?.id, "card-101")
          assert.equal(afterMove.dispatchCount, 1)
          assert.ok(repo.getSaved() !== undefined)

          // Toggle Paper -> Graphite theme
          renderer.clickByTestId("theme.toggle")
          yield* Effect.promise(() =>
            waitFor(() => repo.getSaved()?.theme === "graphite")
          )
          assert.equal(root.model()!.theme, "graphite")
          assert.equal(repo.getSaved()!.theme, "graphite")

          // Quick-add a card to Backlog via native GPUI input + submit
          renderer.clickByTestId("lane.add.backlog")
          yield* Effect.promise(tick)
          renderer.typeByTestId("quick.input", "Ship @effect/ui on Zed GPUI")
          yield* Effect.promise(tick)
          renderer.submitByTestId("quick.input", "Ship @effect/ui on Zed GPUI")
          yield* Effect.promise(tick)

          const backlog = cardsInLane(root.model()!.cards, "backlog")
          const created = backlog.find(
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
          assert.ok(renderer.findByTestId("editor.view") !== undefined)
          renderer.typeByTestId("editor.title", "Refined GPUI native host")
          yield* Effect.promise(tick)
          renderer.clickByTestId("editor.lane.done")
          yield* Effect.promise(tick)
          renderer.clickByTestId("editor.save")
          yield* Effect.promise(tick)

          assert.equal(renderer.findByTestId("editor.view"), undefined)
          const done = cardsInLane(root.model()!.cards, "done")
          assert.equal(done[0]?.title, "Refined GPUI native host")

          // Undo & Redo
          assert.equal(canUndoHistory(root.model()!.history), true)
          renderer.clickByTestId("board.undo")
          yield* Effect.promise(tick)
          assert.equal(
            cardsInLane(root.model()!.cards, "done")[0]?.title ===
              "Refined GPUI native host",
            false
          )
          assert.equal(canRedoHistory(root.model()!.history), true)
          renderer.clickByTestId("board.redo")
          yield* Effect.promise(tick)
          assert.equal(
            cardsInLane(root.model()!.cards, "done")[0]?.title,
            "Refined GPUI native host"
          )
        })
      ).pipe(Effect.provide(makeKanbanLayer({ repository: repo.layer })))
    )
  })
})
