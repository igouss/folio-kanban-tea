import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Component } from "@effect/ui"
import { Story, TestHost } from "@effect/ui/testing"
import {
  DEFAULT_CARDS,
  cardToDraft,
  cardsInLane,
  parseCardId,
  parseCardTitle,
  type CardId,
  type CardTitle
} from "@folio/kanban-domain"
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
  CardEditor,
  CardEditorEvents,
  CardEditorMessage,
  FolioApp,
  FolioAppBase,
  FolioAppMessage,
  MintCardMeta,
  SaveBoard,
  SendSyncEvent,
  SyncEventSchema,
  SyncStatus,
  SyncStatusBase,
  SyncStatusMessage,
  TraceFeed,
  keyValueBoardRepositoryLayer,
  liveInspectorLayer,
  loadFolioProps,
  noopInspectorLayer,
  selectBackgroundTrips,
  selectCanRedo,
  selectCanUndo,
  selectCards,
  selectDensity,
  selectInspectorOpen,
  selectNotice,
  selectTheme,
  selectViewport,
  selectWorkspaceMode
} from "../src/index.ts"

const mustCardId = (raw: string): CardId => {
  const parsed = parseCardId(raw)
  assert.ok(parsed !== undefined)
  return parsed
}

const mustCardTitle = (raw: string): CardTitle => {
  const parsed = parseCardTitle(raw)
  assert.ok(parsed !== undefined)
  return parsed
}

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
          const s = yield* Story.make(FolioAppBase, desktopTestProps)
          assert.deepEqual(s.subscriptions, ["app-lifecycle", "viewport"])
          assert.equal(selectCards(s.model).length, 8)
          assert.equal(selectTheme(s.model), "paper")

          // Quick-add validation stays pure
          s.send(FolioAppMessage.ClickedStartAddCard({ lane: "backlog" }))
          s.send(FolioAppMessage.TypedQuickTitle({ text: "A" }))
          s.send(FolioAppMessage.SubmittedQuickCard())
          const invalidNotice = selectNotice(s.model)
          assert.equal(invalidNotice._tag, "Visible")
          if (invalidNotice._tag === "Visible") {
            assert.equal(invalidNotice.tone, "error")
            assert.ok(invalidNotice.message.includes("at least"))
          }

          // Valid quick-add enters SubmittingCard, issues MintCardMeta, then SaveBoard
          s.send(FolioAppMessage.TypedQuickTitle({ text: "Unified cross-platform app" }))
          const pending = s
            .send(FolioAppMessage.SubmittedQuickCard())
            .expectExact(MintCardMeta)
          assert.equal(selectWorkspaceMode(s.model)._tag, "SubmittingCard")
          pending
            .resolve(MintCardMeta, {
              requestId: 1,
              id: mustCardId("web-card-1"),
              createdAt: "2026-11-27T00:00:00.000Z",
              title: mustCardTitle("Unified cross-platform app"),
              lane: "backlog",
              tag: "web"
            })
            .expectExact(SaveBoard)
            .resolve(SaveBoard, Component.noop)
          assert.deepEqual(selectWorkspaceMode(s.model), { _tag: "Idle" })

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
          // Typed MintCardMeta failure returns to Composing with error notice
          s.send(FolioAppMessage.ClickedStartAddCard({ lane: "review" }))
          s.send(FolioAppMessage.TypedQuickTitle({ text: "Will fail mint" }))
          s.send(FolioAppMessage.SubmittedQuickCard())
            .expectExact(MintCardMeta)
            .fail(MintCardMeta, "Generator unavailable")
          assert.deepEqual(selectWorkspaceMode(s.model), {
            _tag: "Composing",
            lane: "review",
            title: "Will fail mint"
          })
          const mintErr = selectNotice(s.model)
          assert.equal(mintErr._tag, "Visible")
          if (mintErr._tag === "Visible") {
            assert.equal(mintErr.tone, "error")
            assert.ok(mintErr.message.includes("Generator unavailable"))
          }
        })
      )
    )
  })

  it("Story: CardEditor validates drafts locally and emits typed Saved / Deleted / Cancelled events", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const initialDraft = cardToDraft(DEFAULT_CARDS[0]!)
          const s = yield* Story.make(CardEditor, {
            draft: initialDraft,
            theme: "paper",
            mode: "modal"
          })

          // Invalid short title stays in CardEditor with an error notice and emits nothing
          s.send(CardEditorMessage.TypedTitle({ text: "X" }))
          s.send(CardEditorMessage.ClickedSave())
          assert.equal(s.model.notice._tag, "Visible")

          // Valid edit clears notice and emits Saved with validated title
          s.send(CardEditorMessage.TypedTitle({ text: "  Refined Card Title  " }))
          s.send(CardEditorMessage.SelectedLane({ lane: "done" }))
          s.send(CardEditorMessage.TypedAssignee({ text: "ab" }))
          s.send(CardEditorMessage.ClickedSave()).emitted(
            CardEditorEvents.Saved({
              draft: {
                ...initialDraft,
                title: "  Refined Card Title  ",
                lane: "done",
                assignee: "AB"
              },
              title: mustCardTitle("Refined Card Title")
            })
          )
          assert.equal(s.model.notice._tag, "Hidden")

          s.send(CardEditorMessage.ClickedCancel()).emitted(
            CardEditorEvents.Cancelled()
          )

          s.send(CardEditorMessage.ClickedDelete()).emitted(
            CardEditorEvents.Deleted({ cardId: initialDraft.cardId })
          )
        })
      )
    )
  })

  it("Story & TestHost: SyncStatus bridges a component-local ScopedMachine via SendSyncEvent + Subscription", async () => {
    const sampleBoard = { cards: [...DEFAULT_CARDS], theme: "paper" as const }

    // 1. Pure Story test on SyncStatusBase: Send dispatches SendSyncEvent as data
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const s = yield* Story.make(SyncStatusBase, {
            board: sampleBoard,
            theme: "paper"
          })
          assert.deepEqual(s.subscriptions, ["sync-machine"])
          assert.deepEqual(s.model, { _tag: "Idle" })

          s.send(
            SyncStatusMessage.Send({
              event: SyncEventSchema.SyncRequested({ board: sampleBoard })
            })
          )
            .expectExact(SendSyncEvent)
            .resolve(SendSyncEvent, undefined)

          s.send(
            SyncStatusMessage.Synced({
              state: {
                _tag: "Synced",
                savedAt: "2026-11-27T00:00:00.000Z",
                cardCount: sampleBoard.cards.length
              }
            })
          )
          assert.equal(s.model._tag, "Synced")
        })
      )
    )

    // 2. Live TestHost test on Component.provide(..., { local: true }) SyncStatus
    const repo = makeMemoryBoardRepository()
    const envLayer = Layer.mergeAll(
      TestHost.layer(),
      Ui.hostLayer("test"),
      repo.layer
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const root = yield* TestHost.mount(SyncStatus, {
          board: sampleBoard,
          theme: "paper"
        })
        yield* TestHost.settle
        assert.equal(root.model()?._tag, "Idle")

        root.send(
          SyncStatusMessage.Send({
            event: SyncEventSchema.SyncRequested({ board: sampleBoard })
          })
        )
        yield* TestHost.settle

        const model = root.model()
        assert.equal(model?._tag, "Synced")
        if (model?._tag === "Synced") {
          assert.equal(model.cardCount, sampleBoard.cards.length)
        }
        assert.equal(repo.getSaved()?.cards.length, sampleBoard.cards.length)
      }).pipe(Effect.scoped, Effect.provide(envLayer))
    )
  })

  it("TestHost: runs FolioApp directly on platform ports via Component.provide and streams MessageLog entries", async () => {
    const repo = makeMemoryBoardRepository()
    const envLayer = Layer.mergeAll(
      TestHost.layer(),
      Ui.hostLayer("test"),
      repo.layer,
      liveInspectorLayer,
      makeSequenceIdGeneratorLayer(),
      staticLifecycleLayer("active"),
      staticViewportLayer({ width: 1280, height: 800, topInset: 0 })
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

        const feed = yield* TraceFeed
        const traceEntries = yield* feed.snapshot
        assert.ok(
          traceEntries.some((entry) => entry.includes("FolioApp · ClickedToggleTheme"))
        )
        assert.ok(
          traceEntries.every((entry) => !entry.includes("InspectorPanel"))
        )
      }).pipe(Effect.scoped, Effect.provide(envLayer))
    )
  })

  it("composes KeyValueBoardRepository adapter onto KeyValueStore + platform ports", async () => {
    const store = makeMemoryKeyValueStore()
    const boardRepoLayer = keyValueBoardRepositoryLayer("folio.test.board").pipe(
      Layer.provide(store.layer)
    )
    const appLayer = Layer.mergeAll(
      TestHost.layer(),
      Ui.hostLayer("test"),
      boardRepoLayer,
      noopInspectorLayer,
      makeSequenceIdGeneratorLayer(),
      staticLifecycleLayer("active"),
      staticViewportLayer({ width: 390, height: 844, topInset: 56 })
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
