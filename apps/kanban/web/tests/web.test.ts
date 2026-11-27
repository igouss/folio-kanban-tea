import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FolioApp,
  makeKanbanLayer,
  makeMemoryBoardRepository,
  webAppProps
} from "@folio/kanban-app"
import { canRedoHistory, canUndoHistory, cardsInLane } from "@folio/kanban-domain"
import { WebHost } from "@universal-ui/host-web"
import { createFakeDom } from "@universal-ui/host-web/testing"
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

describe("Folio Kanban Web (@folio/kanban-app on @universal-ui/host-web)", () => {
  it("mounts FolioApp onto DOM, syncs document.title, exposes ARIA, and handles full board lifecycle", async () => {
    const dom = createFakeDom()
    const repo = makeMemoryBoardRepository()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const root = yield* WebHost.mountEffect(
            FolioApp,
            webAppProps(),
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
            waitFor(() => repo.getSaved() !== undefined)
          )
          assert.equal(cardsInLane(root.model()!.cards, "review")[0]?.id, "card-101")

          // Toggle Paper -> Graphite theme
          const themeBtn = dom.findByTestId("theme.toggle")
          assert.ok(themeBtn)
          themeBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => repo.getSaved()?.theme === "graphite")
          )
          assert.equal(root.model()!.theme, "graphite")

          // Open MVU Trace inspector
          const inspectorBtn = dom.findByTestId("board.inspector")
          assert.ok(inspectorBtn)
          inspectorBtn.dispatch("click")
          yield* Effect.promise(tick)
          assert.ok(dom.findByTestId("inspector.panel") !== undefined)

          // Quick-add a card via DOM input + Enter submit
          dom.findByTestId("lane.add.backlog")!.dispatch("click")
          yield* Effect.promise(tick)
          const quickInput = dom.findByTestId("quick.input")!
          quickInput.value = "Ship unified Web DOM host"
          quickInput.dispatch("input")
          yield* Effect.promise(tick)
          quickInput.dispatch("keydown", { key: "Enter" })
          yield* Effect.promise(tick)

          assert.equal(root.model()!.cards.length, 9)
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
      ).pipe(Effect.provide(makeKanbanLayer({ repository: repo.layer })))
    )
  })
})
