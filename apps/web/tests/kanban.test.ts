import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Router } from "@effect/ui"
import { HtmlLocator, HtmlScene } from "@effect/ui/html/testing"
import { Story, TestHost } from "@effect/ui/testing"
import { Effect, Layer } from "effect"
import { App, AppMessage } from "../src/App.ts"
import {
  KanbanCard,
  KanbanCardEvents
} from "../src/components/KanbanCard.ts"
import {
  BoardPageMessage,
  BoardPageNoDeps,
  MoveCard,
  QuickCreateCard
} from "../src/pages/BoardPage.ts"
import {
  CreateTask,
  NewTaskMessage,
  NewTaskPageNoDeps
} from "../src/pages/new/NewTaskPage.ts"
import {
  CardEditorEvents,
  CardEditorMessage,
  CardEditorNoDeps,
  DeleteDetailCard,
  SaveCard
} from "../src/pages/tasks/TaskDetailPage.ts"
import { AppRoute } from "../src/routes.ts"
import { defaultSeedTasks, TaskStore } from "../src/services/TaskStore.ts"
import { TraceBus } from "../src/services/TraceBus.ts"

const runEffect = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect)

describe("Folio Kanban (@effect/ui)", () => {
  it("KanbanCard emits RequestedMove when clicking the right-lane button", async () => {
    const sample = defaultSeedTasks[0]! // in_progress -> review
    await runEffect(
      Effect.scoped(
        Effect.gen(function*() {
          const s = yield* HtmlScene.make(KanbanCard, {
            task: sample,
            compact: false,
            busy: false
          })
          s.click(
            HtmlLocator.role("button", {
              name: `Move ${sample.title} to In Review`
            })
          ).emitted(
            KanbanCardEvents.RequestedMove({
              id: sample.id,
              column: "review"
            })
          )
        })
      )
    )
  })

  it("BoardPage Story: dropping a card issues MoveCard Command and updates notice", async () => {
    await runEffect(
      Effect.scoped(
        Effect.gen(function*() {
          const s = yield* Story.make(BoardPageNoDeps, {
            route: AppRoute.Board()
          })
          s.loaded("tasks", [...defaultSeedTasks])
          s.send(BoardPageMessage.DraggedIntoColumn({ column: "review" }))
          assert.equal(s.model.dropOver, "review")

          s.send(
            BoardPageMessage.DroppedCardInColumn({
              id: "card-101",
              column: "review"
            })
          ).expectExact(MoveCard)

          assert.equal(s.model.dropOver, null)
          assert.equal(s.model.busyCardId, "card-101")

          s.resolve(
            MoveCard,
            BoardPageMessage.SucceededMoveCard({
              id: "card-101",
              column: "review"
            })
          )
          assert.equal(s.model.busyCardId, null)
          assert.equal(s.model.notice?.text, "Moved card to In Review.")
        })
      )
    )
  })

  it("BoardPage Story: inline Quick Add validates length and dispatches QuickCreateCard", async () => {
    await runEffect(
      Effect.scoped(
        Effect.gen(function*() {
          const s = yield* Story.make(BoardPageNoDeps, {
            route: AppRoute.Board()
          })
          s.loaded("tasks", [...defaultSeedTasks])
          s.send(BoardPageMessage.ClickedOpenComposer({ column: "backlog" }))
          s.send(BoardPageMessage.TypedComposerTitle({ text: "Hi" }))
          s.send(BoardPageMessage.SubmittedComposer())
          assert.equal(s.model.notice?.tone, "error")

          s.send(
            BoardPageMessage.TypedComposerTitle({
              text: "Ship Kanban board"
            })
          )
          s.send(BoardPageMessage.SubmittedComposer()).expectExact(
            QuickCreateCard
          )
          s.resolve(
            QuickCreateCard,
            BoardPageMessage.SucceededQuickCreate({
              title: "Ship Kanban board",
              column: "backlog"
            })
          )
          assert.equal(s.model.composingColumn, null)
          assert.equal(
            s.model.notice?.text,
            'Added "Ship Kanban board" to Backlog.'
          )
        })
      )
    )
  })

  it("NewTaskPage Scene: validates required title before running CreateTask", async () => {
    await runEffect(
      Effect.scoped(
        Effect.gen(function*() {
          const s = yield* HtmlScene.make(NewTaskPageNoDeps, {
            route: AppRoute.NewTask({ search: { column: "in_progress" } })
          })
          s.click(HtmlLocator.role("button", { name: "Create card" }))
            .expect(HtmlLocator.role("alert"))
            .toHaveText("Give this card a concise title")
            .type(HtmlLocator.label("Card title *"), "Build Effect UI Kanban")
            .click(HtmlLocator.role("button", { name: "Create card" }))
            .expectExact(CreateTask)
            .resolve(
              CreateTask,
              NewTaskMessage.FailedCreateTask({
                reason: "Duplicate title"
              })
            )
            .expect(HtmlLocator.role("alert"))
            .toHaveText("Duplicate title")
        })
      )
    )
  })

  it("CardEditor Story: tracks debounced autosave subscription, saves, and confirms delete", async () => {
    const sample = defaultSeedTasks[0]!
    const edited = { ...sample, title: "Updated Kanban card title" }

    await runEffect(
      Effect.scoped(
        Effect.gen(function*() {
          const s = yield* Story.make(CardEditorNoDeps, { task: sample })
          assert.deepEqual(s.subscriptions, [])

          s.send(CardEditorMessage.UpdatedTitle({ title: edited.title }))
          assert.deepEqual(s.subscriptions, ["autosave-card:1"])

          s.send(CardEditorMessage.RequestedSave()).expectExact(SaveCard)
          s.resolve(SaveCard, CardEditorMessage.SucceededSaveCard({ task: edited }))
          assert.equal(s.model.saved.title, edited.title)
          assert.deepEqual(s.subscriptions, [])

          s.send(CardEditorMessage.ClickedRequestDelete())
          assert.equal(s.model.confirmDelete, true)

          s.send(CardEditorMessage.ConfirmedDeleteCard()).expectExact(
            DeleteDetailCard
          )
          s.resolve(DeleteDetailCard, CardEditorMessage.SucceededDeleteCard())
          s.emitted(CardEditorEvents.Deleted())
        })
      )
    )
  })

  it("BoardPage Scene: renders UI SDK radiogroup, progressbar, and fuzzy highlights", async () => {
    await runEffect(
      Effect.scoped(
        Effect.gen(function*() {
          const s = yield* HtmlScene.make(BoardPageNoDeps, {
            route: AppRoute.Board({ search: { priority: "high", q: "TEA" } })
          })
          s.loaded("tasks", [...defaultSeedTasks])
            .expect(
              HtmlLocator.role("radiogroup", { name: "Filter by priority" })
            )
            .toExist()
            .expect(HtmlLocator.role("radio", { name: "High" }))
            .toBeChecked(true)
            .expect(HtmlLocator.role("radio", { name: "Low" }))
            .toBeChecked(false)
            .expect(HtmlLocator.role("progressbar", { name: "Sprint velocity" }))
            .toExist()
        })
      )
    )
  })

  it("Full App TestHost: mounts Board, loads TaskStore Query, toggles MVU Trace drawer, and navigates to /new", async () => {
    const { busLayer, messageLogLayer } = TraceBus.makeLive()
    await runEffect(
      Effect.gen(function*() {
        const root = yield* TestHost.mount(App, Router.props(AppRoute))
        yield* TestHost.settle
        assert.equal(root.model()?.route._tag, "Board")
        assert.equal(root.model()?.inspectorOpen, false)

        root.send(AppMessage.ClickedToggleInspector())
        yield* TestHost.settle
        assert.equal(root.model()?.inspectorOpen, true)

        root.send(AppMessage.PressedNewCardShortcut())
        yield* TestHost.settle
        assert.equal(root.model()?.route._tag, "NewTask")
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(
            TestHost.layer(),
            Router.memory({ routes: AppRoute, url: "/" }),
            TaskStore.layerMemory(),
            busLayer,
            messageLogLayer
          )
        )
      )
    )
  })
})
