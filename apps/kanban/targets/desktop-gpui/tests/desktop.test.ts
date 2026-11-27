import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FolioApp,
  keyValueBoardRepositoryLayer,
  liveInspectorLayer,
  loadFolioProps,
  selectCanRedo,
  selectCanUndo,
  selectCards,
  selectDispatchCount,
  selectTheme
} from "@folio/kanban-app"
import { cardsInLane } from "@folio/kanban-domain"
import { GpuiHost } from "@universal-ui/host-gpui"
import { createFakeGpuixRenderer } from "@universal-ui/host-gpui/testing"
import {
  makeSequenceIdGeneratorLayer,
  staticLifecycleLayer,
  staticViewportLayer
} from "@universal-ui/platform/memory"
import { makeMemoryKeyValueStore } from "@universal-ui/storage/memory"
import { Effect, Layer } from "effect"

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
  it("mounts FolioApp on GPUI with explicit Effect layers and handles full board lifecycle", async () => {
    const renderer = createFakeGpuixRenderer()
    const store = makeMemoryKeyValueStore()
    const storageKey = "board"

    const boardRepoLayer = keyValueBoardRepositoryLayer(storageKey).pipe(
      Layer.provide(store.layer)
    )
    const appLayer = Layer.mergeAll(
      boardRepoLayer,
      liveInspectorLayer,
      staticLifecycleLayer("active"),
      staticViewportLayer({ width: 1280, height: 800, topInset: 0 }),
      makeSequenceIdGeneratorLayer()
    )

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const root = yield* GpuiHost.mount(
            FolioApp,
            loadFolioProps({
              runtimeTag: "desktop",
              platformLabel: "GPUI · Native GPU"
            }),
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
            waitFor(() => store.getRaw(storageKey) !== undefined)
          )

          const afterMove = root.model()!
          const inProgress = cardsInLane(selectCards(afterMove), "in_progress")
          const review = cardsInLane(selectCards(afterMove), "review")
          assert.equal(
            inProgress.some((c) => c.id === "card-101"),
            false
          )
          assert.equal(review[0]?.id, "card-101")
          assert.equal(selectDispatchCount(afterMove), 1)

          // Toggle Paper -> Graphite theme
          renderer.clickByTestId("theme.toggle")
          yield* Effect.promise(() =>
            waitFor(() => store.getRaw(storageKey)?.includes('"graphite"') === true)
          )
          assert.equal(selectTheme(root.model()!), "graphite")

          // Quick-add a card to Backlog via native GPUI input + submit
          renderer.clickByTestId("lane.add.backlog")
          yield* Effect.promise(tick)
          renderer.typeByTestId("quick.input", "Ship @effect/ui on Zed GPUI")
          yield* Effect.promise(tick)
          renderer.submitByTestId("quick.input", "Ship @effect/ui on Zed GPUI")
          yield* Effect.promise(() =>
            waitFor(() => selectCards(root.model()!).length === 9)
          )

          const backlog = cardsInLane(selectCards(root.model()!), "backlog")
          const created = backlog.find(
            (c) => c.title === "Ship @effect/ui on Zed GPUI"
          )
          assert.ok(created)
          assert.equal(created.id, "desktop-card-1")
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
          const done = cardsInLane(selectCards(root.model()!), "done")
          assert.equal(done[0]?.title, "Refined GPUI native host")

          // Undo & Redo
          assert.equal(selectCanUndo(root.model()!), true)
          renderer.clickByTestId("board.undo")
          yield* Effect.promise(tick)
          assert.equal(
            cardsInLane(selectCards(root.model()!), "done")[0]?.title ===
              "Refined GPUI native host",
            false
          )
          assert.equal(selectCanRedo(root.model()!), true)
          renderer.clickByTestId("board.redo")
          yield* Effect.promise(tick)
          assert.equal(
            cardsInLane(selectCards(root.model()!), "done")[0]?.title,
            "Refined GPUI native host"
          )

          // Escape keyDown cancels quick-add composer & editor modal
          renderer.clickByTestId("board.newCard")
          yield* Effect.promise(() =>
            waitFor(() => renderer.findByTestId("quick.input") !== undefined)
          )
          const quickEl = renderer.findByTestId("quick.input")!
          renderer.dispatch({ elementId: quickEl.id, eventType: "keyDown", key: "escape" })
          yield* Effect.promise(() =>
            waitFor(() => renderer.findByTestId("quick.input") === undefined)
          )
          assert.equal(renderer.findByTestId("quick.input"), undefined)

          // Delete card from editor, open/close inspector, trigger sync, reset demo
          renderer.clickByTestId(`card.open.${created.id}`)
          yield* Effect.promise(() =>
            waitFor(() => renderer.findByTestId("editor.delete") !== undefined)
          )
          renderer.clickByTestId("editor.delete")
          yield* Effect.promise(() =>
            waitFor(() => selectCards(root.model()!).length === 8)
          )
          assert.equal(selectCards(root.model()!).length, 8)

          renderer.clickByTestId("board.inspector")
          yield* Effect.promise(() =>
            waitFor(() => renderer.findByTestId("inspector.panel") !== undefined)
          )
          assert.ok(renderer.findByTestId("inspector.panel") !== undefined)
          renderer.clickByTestId("inspector.close")
          yield* Effect.promise(() =>
            waitFor(() => renderer.findByTestId("inspector.panel") === undefined)
          )

          renderer.clickByTestId("sync.trigger")
          yield* Effect.promise(() =>
            waitFor(() =>
              renderer.getAllText().some((t) => t.includes("Synced · 8 cards"))
            )
          )
          renderer.clickByTestId("board.reset")
          yield* Effect.promise(() =>
            waitFor(() =>
              renderer.getAllText().some((t) => t.includes("Reset board"))
            )
          )
        })
      ).pipe(Effect.provide(appLayer))
    )
  })
})
