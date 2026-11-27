import { ArrowLeftIcon, CheckIcon, TrashIcon } from "#components/Icons"
import {
  ColumnId,
  COLUMNS,
  Task,
  TaskPriority,
  TasksTag
} from "#domain/Task"
import { GetTask } from "#queries/GetTask"
import { TaskStore } from "#services/TaskStore"
import {
  Command,
  Component,
  Head,
  Router,
  Subscription,
  UiSchema
} from "@effect/ui"
import { Html } from "@effect/ui/html"
import { Effect, Layer, Schema, Stream } from "effect"
import { AsyncResult } from "effect/reactivity"
import { AppRoute } from "../../routes.ts"

export const CardEditorMessage = UiSchema.TaggedEnum({
  UpdatedTitle: { title: Schema.String },
  UpdatedNotes: { notes: Schema.String },
  SelectedColumn: { column: ColumnId },
  SelectedPriority: { priority: TaskPriority },
  UpdatedAssignee: { assignee: Schema.String },
  UpdatedPoints: { points: Schema.Number },
  RequestedSave: {},
  SucceededSaveCard: { task: Task },
  FailedSaveCard: { reason: Schema.String },
  ClickedRequestDelete: {},
  CancelledDeleteDialog: {},
  ClosedDeleteDialog: {},
  ConfirmedDeleteCard: {},
  SucceededDeleteCard: {},
  FailedDeleteCard: { reason: Schema.String }
})

export const CardEditorEvents = UiSchema.TaggedEnum({
  Deleted: {}
})

export class SaveCard extends Command.Service<SaveCard>()("folio/SaveCard", {
  args: { task: Task },
  success: CardEditorMessage,
  mode: "queue",
  invalidates: () => [TasksTag]
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return ({ task }) =>
        store.save(task).pipe(
          Effect.match({
            onSuccess: (saved) =>
              CardEditorMessage.SucceededSaveCard({ task: saved }),
            onFailure: (error) =>
              CardEditorMessage.FailedSaveCard({ reason: error.reason })
          })
        )
    })
  )
}

export class DeleteDetailCard extends Command.Service<DeleteDetailCard>()(
  "folio/DeleteDetailCard",
  {
    args: { id: Schema.String },
    success: CardEditorMessage,
    invalidates: () => [TasksTag]
  }
) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return ({ id }) =>
        store.remove(id).pipe(
          Effect.match({
            onSuccess: () => CardEditorMessage.SucceededDeleteCard(),
            onFailure: (error) =>
              CardEditorMessage.FailedDeleteCard({
                reason: `Card ${error.id} was not found.`
              })
          })
        )
    })
  )
}

const isDirty = (draft: Task, saved: Task): boolean =>
  draft.title !== saved.title ||
  draft.notes !== saved.notes ||
  draft.column !== saved.column ||
  draft.priority !== saved.priority ||
  draft.assignee !== saved.assignee ||
  draft.points !== saved.points

const CardEditorDef = Html.component({
  name: "CardEditor",
  props: Schema.Struct({ task: Task }),
  model: Schema.Struct({
    draft: Task,
    saved: Task,
    edits: Schema.Number,
    error: Schema.NullOr(Schema.String),
    confirmDelete: Schema.Boolean
  }),
  message: CardEditorMessage,
  events: CardEditorEvents,
  restore: (model) => ({ ...model, confirmDelete: false })
})

export const CardEditorNoDeps = CardEditorDef.make({
  init: ($) => ({
    draft: $.props.task,
    saved: $.props.task,
    edits: 0,
    error: null,
    confirmDelete: false
  }),
  update: {
    UpdatedTitle: ($, { title }) =>
      $.evolve({
        draft: (draft) => ({ ...draft, title }),
        edits: (n) => n + 1,
        error: null
      }),
    UpdatedNotes: ($, { notes }) =>
      $.evolve({
        draft: (draft) => ({ ...draft, notes }),
        edits: (n) => n + 1,
        error: null
      }),
    SelectedColumn: ($, { column }) =>
      $.evolve({
        draft: (draft) => ({ ...draft, column }),
        edits: (n) => n + 1,
        error: null
      }),
    SelectedPriority: ($, { priority }) =>
      $.evolve({
        draft: (draft) => ({ ...draft, priority }),
        edits: (n) => n + 1,
        error: null
      }),
    UpdatedAssignee: ($, { assignee }) =>
      $.evolve({
        draft: (draft) => ({
          ...draft,
          assignee: assignee.toUpperCase().slice(0, 3)
        }),
        edits: (n) => n + 1,
        error: null
      }),
    UpdatedPoints: ($, { points }) =>
      $.evolve({
        draft: (draft) => ({ ...draft, points }),
        edits: (n) => n + 1,
        error: null
      }),
    RequestedSave: ($) =>
      isDirty($.model.draft, $.model.saved)
        ? $.evolve({ error: null }).run(SaveCard.make({ task: $.model.draft }))
        : $.model,
    SucceededSaveCard: ($, { task }) =>
      $.evolve({ saved: task, error: null }),
    FailedSaveCard: ($, { reason }) => $.evolve({ error: reason }),
    ClickedRequestDelete: ($) => $.evolve({ confirmDelete: true }),
    CancelledDeleteDialog: ($) => $.evolve({ confirmDelete: false }),
    ClosedDeleteDialog: ($) => $.evolve({ confirmDelete: false }),
    ConfirmedDeleteCard: ($) =>
      $.evolve({ confirmDelete: false }).run(
        DeleteDetailCard.make({ id: $.model.saved.id })
      ),
    SucceededDeleteCard: ($) => $.emit(CardEditorEvents.Deleted()),
    FailedDeleteCard: ($, { reason }) => $.evolve({ error: reason })
  },
  // Keyed on `model.edits` so every keystroke restarts the 2-second debounce cleanly.
  subscriptions: ({ model }) => [
    isDirty(model.draft, model.saved) &&
      Subscription.make("autosave-card", model.edits, () =>
        Stream.fromEffect(
          Effect.as(
            Effect.sleep("2 seconds"),
            CardEditorMessage.RequestedSave()
          )
        )
      )
  ],
  view: (h, model) => {
    const dirty = isDirty(model.draft, model.saved)
    const saving = h.isRunning(SaveCard)

    return h.div.class("page-card").children(
      h.div.class("editor-top-bar").children(
        h.div.class("editor-id-row").children(
          h.span.class("card-key large").children(model.saved.key),
          h.span
            .class("save-status-pill", dirty ? "is-dirty" : "is-saved")
            .children(
              saving
                ? "Saving via Command…"
                : dirty
                  ? "Unsaved · autosaves in 2s"
                  : [CheckIcon(h, 13), h.span("Synced")]
            )
        ),
        h.button
          .class("ghost-btn danger")
          .attr("type", "button")
          .on("click", CardEditorMessage.ClickedRequestDelete())
          .children(TrashIcon(h, 14), h.span("Delete card"))
      ),
      h.form
        .class("editorial-form")
        .on("submit", CardEditorMessage.RequestedSave())
        .children(
          h.div.class("form-field").children(
            h.label.class("field-label").attr("for", "edit-title").children("Title"),
            h.input
              .class("field-input title-input")
              .attr("id", "edit-title")
              .value(model.draft.title)
              .on("input", ({ value }) =>
                CardEditorMessage.UpdatedTitle({ title: value })
              )
              .on(
                "keydown",
                ({ ctrl, key, meta }) =>
                  (ctrl || meta) && key === "s"
                    ? CardEditorMessage.RequestedSave()
                    : undefined,
                { preventDefault: true }
              )
          ),
          h.div.class("form-grid-4").children(
            h.div.class("form-field").children(
              h.label.class("field-label").attr("for", "edit-column").children("Lane"),
              h.select
                .class("field-select")
                .attr("id", "edit-column")
                .value(model.draft.column)
                .on("change", ({ value }) => {
                  const found = COLUMNS.find((c) => c.id === value)
                  return found
                    ? CardEditorMessage.SelectedColumn({ column: found.id })
                    : undefined
                })
                .children(
                  COLUMNS.map((col) =>
                    h.option.key(col.id).attr("value", col.id).children(col.title)
                  )
                )
            ),
            h.div.class("form-field").children(
              h.label.class("field-label").attr("for", "edit-priority").children("Priority"),
              h.select
                .class("field-select")
                .attr("id", "edit-priority")
                .value(model.draft.priority)
                .on("change", ({ value }) =>
                  value === "high" || value === "medium" || value === "low"
                    ? CardEditorMessage.SelectedPriority({ priority: value })
                    : undefined
                )
                .children(
                  h.option.attr("value", "high").children("High"),
                  h.option.attr("value", "medium").children("Medium"),
                  h.option.attr("value", "low").children("Low")
                )
            ),
            h.div.class("form-field").children(
              h.label.class("field-label").attr("for", "edit-assignee").children("Assignee"),
              h.input
                .class("field-input")
                .attrs({ id: "edit-assignee", maxlength: "3" })
                .value(model.draft.assignee)
                .on("input", ({ value }) =>
                  CardEditorMessage.UpdatedAssignee({ assignee: value })
                )
            ),
            h.div.class("form-field").children(
              h.label.class("field-label").attr("for", "edit-points").children("Points"),
              h.select
                .class("field-select")
                .attr("id", "edit-points")
                .value(String(model.draft.points))
                .on("change", ({ value }) =>
                  CardEditorMessage.UpdatedPoints({ points: Number(value) })
                )
                .children(
                  [1, 2, 3, 5, 8, 13].map((pt) =>
                    h.option
                      .key(String(pt))
                      .attr("value", String(pt))
                      .children(`${pt} pt`)
                  )
                )
            )
          ),
          h.div.class("form-field").children(
            h.label.class("field-label").attr("for", "edit-notes").children("Notes & implementation details"),
            h.textarea
              .class("field-textarea")
              .attrs({ id: "edit-notes", rows: "6" })
              .value(model.draft.notes)
              .on("input", ({ value }) =>
                CardEditorMessage.UpdatedNotes({ notes: value })
              )
              .on(
                "keydown",
                ({ ctrl, key, meta }) =>
                  (ctrl || meta) && key === "s"
                    ? CardEditorMessage.RequestedSave()
                    : undefined,
                { preventDefault: true }
              )
          ),
          model.error !== null &&
            h.p.class("field-error").attr("role", "alert").children(model.error),
          h.div.class("form-actions").children(
            h.button
              .class("primary-btn")
              .attr("type", "submit")
              .disabled(!dirty || saving)
              .children(saving ? "Saving…" : "Save now (⌘S)"),
            h.a
              .class("ghost-btn")
              .attr("href", AppRoute.print(AppRoute.Board()))
              .children("Done")
          )
        ),
      h.dialog
        .class("confirm-dialog")
        .attr("aria-label", "Delete card confirmation")
        .modal(model.confirmDelete)
        .on("cancel", CardEditorMessage.CancelledDeleteDialog())
        .on("close", CardEditorMessage.ClosedDeleteDialog())
        .children(
          h.h2.class("dialog-title").children(`Delete ${model.saved.key}?`),
          h.p.class("dialog-body").children(
            `"${model.saved.title}" will be permanently removed from the board.`
          ),
          h.div.class("dialog-actions").children(
            h.button
              .class("ghost-btn")
              .attr("type", "button")
              .on("click", CardEditorMessage.CancelledDeleteDialog())
              .children("Keep card"),
            h.button
              .class("danger-btn")
              .attr("type", "button")
              .on("click", CardEditorMessage.ConfirmedDeleteCard())
              .children("Delete permanently")
          )
        )
    )
  }
})

export const CardEditor = CardEditorNoDeps.pipe(
  Component.provide(Layer.merge(SaveCard.layer, DeleteDetailCard.layer))
)

export const TaskDetailPageMessage = UiSchema.TaggedEnum({
  DeletedCard: {}
})

export const TaskDetailPageNoDeps = Html.component({
  name: "TaskDetailPage",
  props: Schema.Struct({ id: Schema.String }),
  model: Schema.Struct({}),
  message: TaskDetailPageMessage,
  queries: {
    task: { query: GetTask, args: ({ props }) => ({ id: props.id }) }
  }
}).make({
  init: () => ({}),
  update: {
    DeletedCard: ($) =>
      $.run(Router.push(AppRoute, AppRoute.Board()).pipe(Command.asNoop))
  },
  head: ({ queries }) => [
    Head.title(
      AsyncResult.isSuccess(queries.task)
        ? `${queries.task.value.key} · ${queries.task.value.title}`
        : "Card"
    )
  ],
  view: (h) =>
    h.section.class("narrow-page").children(
      h.a
        .class("back-link")
        .attr("href", AppRoute.print(AppRoute.Board()))
        .children(ArrowLeftIcon(h, 14), h.span("Back to Kanban board")),
      AsyncResult.match(h.queries.task, {
        onInitial: () =>
          h.div.class("state-panel").children(
            h.p.class("state-title").children("Loading card…")
          ),
        onFailure: () =>
          h.div.class("state-panel").children(
            h.p.class("state-title").children("Card not found"),
            h.p.class("state-sub").children(
              `No card with id "${h.props.id}" exists on this board.`
            ),
            h.a
              .class("primary-btn")
              .attr("href", AppRoute.print(AppRoute.Board()))
              .children("Return to board")
          ),
        onSuccess: ({ value: task }) =>
          CardEditor(h, {
            key: task.id,
            props: { task },
            onEmit: {
              Deleted: () => TaskDetailPageMessage.DeletedCard()
            }
          })
      })
    )
})

export const TaskDetailPage = TaskDetailPageNoDeps.pipe(
  Component.provide(GetTask.layer)
)
