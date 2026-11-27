import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Component } from "@effect/ui"
import { Story, TestHost } from "@effect/ui/testing"
import { Ui } from "@folio/effect-ui-universal"
import { canRedoHistory, canUndoHistory, cardsInLane } from "@folio/kanban-core"
import { Effect, Layer } from "effect"
import {
  FolioApp,
  FolioAppMessage,
  SaveBoard,
  makeAppLayer,
  makeMemoryStorageLayer,
  mobileAppProps,
  webAppProps
} from "../src/index.ts"

describe("@folio/folio-app (Unified @effect/ui Application)", () => {
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

  it("TestHost: mounts unified FolioApp, toggles theme/density/inspector, and persists to BoardStorage", async () => {
    const storage = makeMemoryStorageLayer()
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
        assert.equal(storage.getSaved()?.theme, "graphite")
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(
            TestHost.layer(),
            Ui.hostLayer("test"),
            makeAppLayer({ storage: storage.layer })
          )
        )
      )
    )
  })

  it("TestHost: supports mobile tabs layout and AppLifecycle background trips", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const root = yield* TestHost.mount(FolioApp, mobileAppProps())
        yield* TestHost.settle
        assert.equal(root.model()?.activeLane, "in_progress")

        root.send(FolioAppMessage.SelectedLane({ lane: "done" }))
        yield* TestHost.settle
        assert.equal(root.model()?.activeLane, "done")

        root.send(FolioAppMessage.ChangedAppState({ state: "background" }))
        root.send(FolioAppMessage.ChangedAppState({ state: "active" }))
        yield* TestHost.settle
        assert.equal(root.model()?.appState, "active")
        assert.equal(root.model()?.backgroundTrips, 1)
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(
            TestHost.layer(),
            Ui.hostLayer("test"),
            makeAppLayer()
          )
        )
      )
    )
  })
})
