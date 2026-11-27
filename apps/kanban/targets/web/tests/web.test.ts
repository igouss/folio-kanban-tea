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
  selectDensity,
  selectInspectorOpen,
  selectTheme
} from "@folio/kanban-app"
import { cardsInLane } from "@folio/kanban-domain"
import { Viewport, type ViewportMetrics } from "@universal-ui/core"
import { WebHost } from "@universal-ui/host-web"
import { createFakeDom } from "@universal-ui/host-web/testing"
import {
  makeSequenceIdGeneratorLayer,
  staticLifecycleLayer,
  staticViewportLayer
} from "@universal-ui/platform/memory"
import { makeMemoryKeyValueStore } from "@universal-ui/storage/memory"
import { Effect, Layer, Queue, Stream } from "effect"

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
            dom.container
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

          // Priority filter + keyboard roving arrow + Density toggle
          dom.findByTestId("filter.high")!.dispatch("click")
          yield* Effect.promise(tick)
          dom.findByTestId("filter.high")!.dispatch("keydown", { key: "ArrowRight" })
          yield* Effect.promise(tick)
          dom.findByTestId("filter.all")!.dispatch("click")
          yield* Effect.promise(tick)
          dom.findByTestId("density.compact")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => selectDensity(root.model()!) === "compact")
          )
          assert.equal(selectDensity(root.model()!), "compact")

          // CardEditor modal: validation error -> edit fields -> save -> reopen & delete
          dom.findByTestId("card.open.web-card-1")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("editor.view") !== undefined)
          )
          const titleInput = dom.findByTestId("editor.title")!
          titleInput.value = "X"
          titleInput.dispatch("input")
          yield* Effect.promise(tick)
          dom.findByTestId("editor.save")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("editor.notice") !== undefined)
          )
          titleInput.value = "Edited Web Card"
          titleInput.dispatch("input")
          dom.findByTestId("editor.lane.done")!.dispatch("click")
          dom.findByTestId("editor.priority.high")!.dispatch("click")
          dom.findByTestId("editor.points.8")!.dispatch("click")
          yield* Effect.promise(tick)
          dom.findByTestId("editor.save")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("editor.view") === undefined)
          )
          const edited = selectCards(root.model()!).find((c) => c.id === "web-card-1")
          assert.equal(edited?.title, "Edited Web Card")
          assert.equal(edited?.lane, "done")
          assert.equal(edited?.points, 8)

          dom.findByTestId("card.open.web-card-1")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("editor.delete") !== undefined)
          )
          dom.findByTestId("editor.delete")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => selectCards(root.model()!).length === 8)
          )

          // Dismiss notice, close inspector, reset demo
          dom.findByTestId("notice.dismiss")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("board.notice") === undefined)
          )
          dom.findByTestId("inspector.close")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("inspector.panel") === undefined)
          )
          assert.equal(selectInspectorOpen(root.model()!), false)
          dom.findByTestId("board.reset")!.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => dom.textContent().includes("Reset board to default cards."))
          )
        })
      ).pipe(Effect.provide(appLayer))
    )
  })

  it("switches responsively between columns and tabs layout on viewport resize", async () => {
    const dom = createFakeDom()
    const store = makeMemoryKeyValueStore()
    let currentViewport: ViewportMetrics = { width: 1280, height: 800, topInset: 0 }
    const listeners = new Set<(m: ViewportMetrics) => void>()
    const dynamicViewportLayer = Layer.succeed(Viewport, {
      current: Effect.sync(() => currentViewport),
      changes: Stream.callback<ViewportMetrics>((q) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const fn = (m: ViewportMetrics) => { Queue.offerUnsafe(q, m) }
            listeners.add(fn)
            return () => { listeners.delete(fn) }
          }),
          (cleanup) => Effect.sync(cleanup)
        )
      )
    })

    const appLayer = Layer.mergeAll(
      keyValueBoardRepositoryLayer("folio.web.responsive").pipe(
        Layer.provide(store.layer)
      ),
      liveInspectorLayer,
      staticLifecycleLayer("active"),
      dynamicViewportLayer,
      makeSequenceIdGeneratorLayer()
    )

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* WebHost.mountEffect(
            FolioApp,
            loadFolioProps({ runtimeTag: "web", platformLabel: "Web · DOM Host" }),
            dom.container
          )
          assert.ok(dom.findByTestId("lane.backlog") !== undefined)
          yield* Effect.promise(() => waitFor(() => listeners.size > 0))
          currentViewport = { width: 420, height: 800, topInset: 0 }
          for (const fn of listeners) fn(currentViewport)
          yield* Effect.promise(() =>
            waitFor(() => dom.findByTestId("lane.tab.backlog") !== undefined)
          )
          dom.findByTestId("lane.tab.backlog")!.dispatch("click")
          yield* Effect.promise(tick)
          assert.equal(
            dom.findByTestId("lane.tab.backlog")!.getAttribute("aria-selected"),
            "true"
          )
        })
      ).pipe(Effect.provide(appLayer))
    )
  })
})
