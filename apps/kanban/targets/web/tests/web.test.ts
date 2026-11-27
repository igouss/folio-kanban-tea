import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FolioApp,
  kanbanCommandsLayer,
  keyValueBoardRepositoryLayer,
  loadFolioProps
} from "@folio/kanban-app"
import { canRedoHistory, canUndoHistory, cardsInLane } from "@folio/kanban-domain"
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
    const appLayer = Layer.provideMerge(
      kanbanCommandsLayer,
      Layer.mergeAll(
        boardRepoLayer,
        staticLifecycleLayer("active"),
        staticViewportLayer({ width: 1280, height: 800, topInset: 0 }),
        makeSequenceIdGeneratorLayer()
      )
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
          assert.equal(cardsInLane(root.model()!.cards, "review")[0]?.id, "card-101")

          // Toggle Paper -> Graphite theme
          const themeBtn = dom.findByTestId("theme.toggle")
          assert.ok(themeBtn)
          themeBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => store.getRaw(storageKey)?.includes('"graphite"') === true)
          )
          assert.equal(root.model()!.theme, "graphite")

          // Open MVU Trace inspector
          const inspectorBtn = dom.findByTestId("board.inspector")
          assert.ok(inspectorBtn)
          inspectorBtn.dispatch("click")
          yield* Effect.promise(tick)
          assert.ok(dom.findByTestId("inspector.panel") !== undefined)

          // Quick-add a card via DOM input + Enter submit (mints ID via IdGenerator + Clock)
          dom.findByTestId("lane.add.backlog")!.dispatch("click")
          yield* Effect.promise(tick)
          const quickInput = dom.findByTestId("quick.input")!
          quickInput.value = "Ship unified Web DOM host"
          quickInput.dispatch("input")
          yield* Effect.promise(tick)
          quickInput.dispatch("keydown", { key: "Enter" })
          yield* Effect.promise(() =>
            waitFor(() => root.model()!.cards.length === 9)
          )

          assert.equal(root.model()!.cards.length, 9)
          assert.equal(root.model()!.cards[0]?.id, "web-card-1")
          assert.ok(dom.doc.title.includes("9 cards"))

          // Undo & Redo
          assert.equal(canUndoHistory(root.model()!.history), true)
          dom.findByTestId("board.undo")!.dispatch("click")
          yield* Effect.promise(tick)
          assert.equal(root.model()!.cards.length, 8)
          assert.equal(canRedoHistory(root.model()!.history), true)
          dom.findByTestId("board.redo")!.dispatch("click")
          yield* Effect.promise(tick)
          assert.equal(root.model()!.cards.length, 9)
        })
      ).pipe(Effect.provide(appLayer))
    )
  })
})
