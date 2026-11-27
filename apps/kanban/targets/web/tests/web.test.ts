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
  selectTheme
} from "@folio/kanban-app"
import { cardsInLane } from "@folio/kanban-domain"
import { WebHost } from "@universal-ui/host-web"
import { createFakeDom } from "@universal-ui/host-web/testing"
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

describe("Folio Kanban Web (@folio/kanban-app on @universal-ui/host-web)", () => {
  it("mounts FolioApp onto DOM, wires storage/lifecycle/viewport/id layers, and handles full board lifecycle", async () => {
    const dom = createFakeDom()
    const store = makeMemoryKeyValueStore()
    const storageKey = "folio.web.test"

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
          const root = yield* WebHost.mountEffect(
            FolioApp,
            loadFolioProps({
              runtimeTag: "web",
              platformLabel: "Web · DOM Host"
            }),
            dom.container as unknown as Element
          )

          assert.ok(dom.doc.title.includes("Web · DOM Host"))
          assert.ok(dom.doc.title.includes("8 cards"))
          assert.ok(dom.textContent().includes("Folio Kanban"))
          assert.ok(
            dom.findByRole("radiogroup", "Filter by priority") !== undefined
          )
          assert.ok(
            dom.findByRole("progressbar", "Sprint velocity") !== undefined
          )
          assert.ok(
            dom.findByRole("region", "Folio Kanban board") !== undefined
          )

          // Move FOL-101 from In Progress to In Review via DOM click
          const moveBtn = dom.findByTestId("card.next.card-101")
          assert.ok(moveBtn)
          moveBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => store.getRaw(storageKey) !== undefined)
          )
          assert.equal(cardsInLane(selectCards(root.model()!), "review")[0]?.id, "card-101")

          // Toggle Paper -> Graphite theme
          const themeBtn = dom.findByTestId("theme.toggle")
          assert.ok(themeBtn)
          themeBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => store.getRaw(storageKey)?.includes('"graphite"') === true)
          )
          assert.equal(selectTheme(root.model()!), "graphite")

          // Open MVU Trace inspector (backed by @effect/ui MessageLog Feature)
          const inspectorBtn = dom.findByTestId("board.inspector")
          assert.ok(inspectorBtn)
          inspectorBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("inspector.panel") !== undefined)
          )
          assert.ok(dom.findByTestId("inspector.panel") !== undefined)
          assert.ok(dom.textContent().includes("FolioApp · ClickedToggleTheme"))

          // Quick-add a card via DOM input + Enter submit (mints ID via IdGenerator + Clock)
          dom.findByTestId("lane.add.backlog")!.dispatch("click")
          yield* Effect.promise(tick)
          const quickInput = dom.findByTestId("quick.input")!
          quickInput.value = "Ship unified Web DOM host"
          quickInput.dispatch("input")
          yield* Effect.promise(tick)
          quickInput.dispatch("keydown", { key: "Enter" })
          yield* Effect.promise(() =>
            waitFor(() => selectCards(root.model()!).length === 9)
          )

          assert.equal(selectCards(root.model()!).length, 9)
          assert.equal(selectCards(root.model()!)[0]?.id, "web-card-1")
          assert.ok(dom.doc.title.includes("9 cards"))

          // Trigger component-local SyncStatus machine via DOM click
          const syncBtn = dom.findByTestId("sync.trigger")
          assert.ok(syncBtn)
          syncBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.textContent().includes("Synced · 9 cards"))
          )
          assert.ok(dom.textContent().includes("Synced · 9 cards"))

          // Undo & Redo
          assert.equal(selectCanUndo(root.model()!), true)
          dom.findByTestId("board.undo")!.dispatch("click")
          yield* Effect.promise(tick)
          assert.equal(selectCards(root.model()!).length, 8)
          assert.equal(selectCanRedo(root.model()!), true)
          dom.findByTestId("board.redo")!.dispatch("click")
          yield* Effect.promise(tick)
          assert.equal(selectCards(root.model()!).length, 9)
        })
      ).pipe(Effect.provide(appLayer))
    )
  })
})
