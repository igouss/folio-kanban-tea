import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Component } from "@effect/ui"
import { Story, TestHost } from "@effect/ui/testing"
import { canRedoHistory, canUndoHistory, cardsInLane } from "@folio/kanban-domain"
import { Ui, makeMemoryKeyValueStore } from "@universal-ui/core"
import { Effect, Layer, Option } from "effect"
import {
  FolioApp,
  FolioAppMessage,
  SaveBoard,
  loadInitialBoard,
  makeKanbanLayer,
  makeKanbanLayerFromStore,
  makeMemoryBoardRepository,
  mobileAppProps,
  webAppProps
} from "../src/index.ts"

describe("@folio/kanban-app (Hexagonal Kanban Application)", () => {
  it("Story: validates quick-add, creates card, moves lane, edits, and supports Undo/Redo", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const s = yield* Story.make(FolioApp, webAppProps())
          assert.deepEqual(s.subscriptions, ["app-lifecycle"])
          assert.equal(s.model.cards.length, 8)
          assert.equal(s.model.theme, "paper")

          // Quick-add validation
          s.send(FolioAppMessage.ClickedStartAddCard({ lane: "backlog" }))
          s.send(FolioAppMessage.TypedQuickTitle({ text: "A" }))
          s.send(FolioAppMessage.SubmittedQuickCard())
          assert.ok(s.model.notice.includes("at least"))

          // Valid quick-add issues SaveBoard command
          s.send(FolioAppMessage.TypedQuickTitle({ text: "Unified cross-platform app" }))
          s.send(FolioAppMessage.SubmittedQuickCard())
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)
          assert.equal(s.model.cards.length, 9)
          const created = cardsInLane(s.model.cards, "backlog").find(
            (c) => c.title === "Unified cross-platform app"
          )
          assert.ok(created)
          assert.equal(created.code, "FOL-109")

          // Move card & persist
          s.send(
            FolioAppMessage.ClickedMoveCard({
              cardId: created.id,
              toLane: "in_progress"
            })
          )
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)
          assert.equal(
            cardsInLane(s.model.cards, "in_progress")[0]?.id,
            created.id
          )

          // Undo & Redo
          assert.equal(canUndoHistory(s.model.history), true)
          s.send(FolioAppMessage.ClickedUndo())
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)
          assert.equal(
            cardsInLane(s.model.cards, "backlog").some((c) => c.id === created.id),
            true
          )
          assert.equal(canRedoHistory(s.model.history), true)
          s.send(FolioAppMessage.ClickedRedo())
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)
          assert.equal(
            cardsInLane(s.model.cards, "in_progress")[0]?.id,
            created.id
          )
        })
      )
    )
  })

  it("TestHost: mounts FolioApp and persists through BoardRepository port", async () => {
    const repo = makeMemoryBoardRepository()
    await Effect.runPromise(
      Effect.gen(function* () {
        const root = yield* TestHost.mount(FolioApp, webAppProps())
        yield* TestHost.settle
        assert.equal(root.model()?.cards.length, 8)
        assert.equal(root.model()?.inspectorOpen, false)

        root.send(FolioAppMessage.ClickedToggleInspector())
        yield* TestHost.settle
        assert.equal(root.model()?.inspectorOpen, true)

        root.send(FolioAppMessage.SelectedDensity({ density: "compact" }))
        yield* TestHost.settle
        assert.equal(root.model()?.density, "compact")

        root.send(FolioAppMessage.ClickedToggleTheme())
        yield* TestHost.settle
        assert.equal(root.model()?.theme, "graphite")
        assert.equal(repo.getSaved()?.theme, "graphite")
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(
            TestHost.layer(),
            Ui.hostLayer("test"),
            makeKanbanLayer({ repository: repo.layer })
          )
        )
      )
    )
  })

  it("bridges BoardRepository onto @universal-ui/core KeyValueStore port with Schema round-trip", async () => {
    const store = makeMemoryKeyValueStore()
    const layer = makeKanbanLayerFromStore({
      storageKey: "folio.test.board",
      store: store.layer
    })

    await Effect.runPromise(
      Effect.gen(function* () {
        const before = yield* loadInitialBoard
        assert.equal(Option.isNone(before), true)

        const root = yield* TestHost.mount(FolioApp, webAppProps())
        yield* TestHost.settle
        root.send(FolioAppMessage.ClickedToggleTheme())
        yield* TestHost.settle

        const after = yield* loadInitialBoard
        assert.equal(Option.isSome(after), true)
        if (Option.isSome(after)) {
          assert.equal(after.value.theme, "graphite")
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(TestHost.layer(), Ui.hostLayer("test"), layer)
        )
      )
    )
  })

  it("TestHost: supports mobile tabs layout and typed Lifecycle background trips", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const root = yield* TestHost.mount(FolioApp, mobileAppProps())
        yield* TestHost.settle
        assert.equal(root.model()?.activeLane, "in_progress")

        root.send(FolioAppMessage.SelectedLane({ lane: "done" }))
        yield* TestHost.settle
        assert.equal(root.model()?.activeLane, "done")

        root.send(FolioAppMessage.ChangedLifecycle({ state: "background" }))
        root.send(FolioAppMessage.ChangedLifecycle({ state: "active" }))
        yield* TestHost.settle
        assert.equal(root.model()?.appState, "active")
        assert.equal(root.model()?.backgroundTrips, 1)
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(
            TestHost.layer(),
            Ui.hostLayer("test"),
            makeKanbanLayer()
          )
        )
      )
    )
  })
})
