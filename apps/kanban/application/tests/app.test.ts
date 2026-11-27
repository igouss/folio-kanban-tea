import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Component } from "@effect/ui"
import { Story, TestHost } from "@effect/ui/testing"
import { cardsInLane } from "@folio/kanban-domain"
import {
  loadInitialBoard,
  makeMemoryBoardRepository
} from "@folio/kanban-domain/ports"
import {
  Ui,
  makeMemoryKeyValueStore,
  makeSequenceIdGeneratorLayer,
  staticLifecycleLayer,
  staticViewportLayer
} from "@universal-ui/core"
import { Effect, Layer, Option } from "effect"
import {
  FolioApp,
  FolioAppMessage,
  MintCardMeta,
  SaveBoard,
  kanbanCommandsLayer,
  keyValueBoardRepositoryLayer,
  loadFolioProps,
  selectBackgroundTrips,
  selectCanRedo,
  selectCanUndo,
  selectCards,
  selectDensity,
  selectInspectorOpen,
  selectNotice,
  selectTheme,
  selectViewport
} from "../src/index.ts"

const desktopTestProps = {
  runtimeTag: "web",
  platformLabel: "Test Desktop",
  initialViewport: { width: 1280, height: 800, topInset: 0 },
  initialBoard: Option.none()
} as const

describe("@folio/kanban-app (Thin @effect/ui Shell over Pure Reducer)", () => {
  it("Story: interprets reducer AppEffects into MintCardMeta and SaveBoard commands", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const s = yield* Story.make(FolioApp, desktopTestProps)
          assert.deepEqual(s.subscriptions, ["app-lifecycle", "viewport"])
          assert.equal(selectCards(s.model).length, 8)
          assert.equal(selectTheme(s.model), "paper")

          // Quick-add validation stays pure
          s.send(FolioAppMessage.ClickedStartAddCard({ lane: "backlog" }))
          s.send(FolioAppMessage.TypedQuickTitle({ text: "A" }))
          s.send(FolioAppMessage.SubmittedQuickCard())
          assert.ok(selectNotice(s.model).includes("at least"))

          // Valid quick-add issues MintCardMeta, then SaveBoard
          s.send(FolioAppMessage.TypedQuickTitle({ text: "Unified cross-platform app" }))
          s.send(FolioAppMessage.SubmittedQuickCard())
            .expectExact(MintCardMeta)
            .resolve(MintCardMeta, {
              id: "web-card-1",
              createdAt: "2026-11-27T00:00:00.000Z",
              title: "Unified cross-platform app",
              lane: "backlog",
              tag: "web"
            })
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)

          assert.equal(selectCards(s.model).length, 9)
          const created = cardsInLane(selectCards(s.model), "backlog").find(
            (c) => c.title === "Unified cross-platform app"
          )
          assert.ok(created)
          assert.equal(created.id, "web-card-1")
          assert.equal(created.createdAt, "2026-11-27T00:00:00.000Z")
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
            cardsInLane(selectCards(s.model), "in_progress")[0]?.id,
            created.id
          )

          // Undo & Redo
          assert.equal(selectCanUndo(s.model), true)
          s.send(FolioAppMessage.ClickedUndo())
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)
          assert.equal(
            cardsInLane(selectCards(s.model), "backlog").some((c) => c.id === created.id),
            true
          )
          assert.equal(selectCanRedo(s.model), true)
          s.send(FolioAppMessage.ClickedRedo())
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)
          assert.equal(
            cardsInLane(selectCards(s.model), "in_progress")[0]?.id,
            created.id
          )
        })
      )
    )
  })

  it("TestHost: runs directly against domain BoardRepository without KeyValueStore", async () => {
    const repo = makeMemoryBoardRepository()
    const envLayer = Layer.provideMerge(
      kanbanCommandsLayer,
      Layer.mergeAll(
        TestHost.layer(),
        Ui.hostLayer("test"),
        repo.layer,
        makeSequenceIdGeneratorLayer(),
        staticLifecycleLayer("active"),
        staticViewportLayer({ width: 1280, height: 800, topInset: 0 })
      )
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const props = yield* loadFolioProps({
          runtimeTag: "test",
          platformLabel: "Test Host"
        })
        const root = yield* TestHost.mount(FolioApp, props)
        yield* TestHost.settle
        assert.equal(selectCards(root.model()!).length, 8)
        assert.equal(selectInspectorOpen(root.model()!), false)

        root.send(FolioAppMessage.ClickedToggleInspector())
        yield* TestHost.settle
        assert.equal(selectInspectorOpen(root.model()!), true)

        root.send(FolioAppMessage.SelectedDensity({ density: "compact" }))
        yield* TestHost.settle
        assert.equal(selectDensity(root.model()!), "compact")

        root.send(FolioAppMessage.ClickedToggleTheme())
        yield* TestHost.settle
        assert.equal(selectTheme(root.model()!), "graphite")
        assert.equal(repo.getSaved()?.theme, "graphite")
      }).pipe(Effect.scoped, Effect.provide(envLayer))
    )
  })

  it("composes KeyValueBoardRepository adapter onto KeyValueStore + platform ports", async () => {
    const store = makeMemoryKeyValueStore()
    const boardRepoLayer = keyValueBoardRepositoryLayer("folio.test.board").pipe(
      Layer.provide(store.layer)
    )
    const appLayer = Layer.provideMerge(
      kanbanCommandsLayer,
      Layer.mergeAll(
        TestHost.layer(),
        Ui.hostLayer("test"),
        boardRepoLayer,
        makeSequenceIdGeneratorLayer(),
        staticLifecycleLayer("active"),
        staticViewportLayer({ width: 390, height: 844, topInset: 56 })
      )
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const before = yield* loadInitialBoard
        assert.equal(Option.isNone(before), true)

        const props = yield* loadFolioProps({
          runtimeTag: "mobile",
          platformLabel: "Mobile Test"
        })
        const root = yield* TestHost.mount(FolioApp, props)
        yield* TestHost.settle
        assert.equal(selectViewport(root.model()!).width, 390)

        // Quick-add mints ID via IdGenerator and persists via KeyValueBoardRepository
        root.send(FolioAppMessage.TypedQuickTitle({ text: "Wired via Effect DI" }))
        root.send(FolioAppMessage.SubmittedQuickCard())
        yield* TestHost.settle
        assert.equal(selectCards(root.model()!)[0]?.id, "mobile-card-1")

        // Reactive viewport resize updates layout geometry live
        root.send(
          FolioAppMessage.ChangedViewport({
            viewport: { width: 1200, height: 800, topInset: 0 }
          })
        )
        root.send(FolioAppMessage.ChangedLifecycle({ state: "background" }))
        root.send(FolioAppMessage.ChangedLifecycle({ state: "active" }))
        yield* TestHost.settle
        assert.equal(selectViewport(root.model()!).width, 1200)
        assert.equal(selectBackgroundTrips(root.model()!), 1)

        const after = yield* loadInitialBoard
        assert.equal(Option.isSome(after), true)
        if (Option.isSome(after)) {
          assert.equal(after.value.cards.length, 9)
        }
      }).pipe(Effect.scoped, Effect.provide(appLayer))
    )
  })
})
