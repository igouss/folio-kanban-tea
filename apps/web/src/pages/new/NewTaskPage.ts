import { ArrowLeftIcon } from "#components/Icons"
import {
  ColumnId,
  COLUMNS,
  NewTaskInput,
  TaskPriority,
  TasksTag
} from "#domain/Task"
import { TaskStore } from "#services/TaskStore"
import {
  Command,
  Component,
  Head,
  Router,
  UiSchema,
  Validation
} from "@effect/ui"
import { Html } from "@effect/ui/html"
import { Effect, Option, Schema } from "effect"
import { AppRoute } from "../../routes.ts"

const NewTaskRoute = AppRoute.subset(["NewTask"])

const Rule = Validation.Rule

export const NewTaskValidation = Validation.make(
  {
    title: {
      required: "Give this card a concise title",
      rules: [
        Rule.minLength(3, "Title must be at least 3 characters"),
        Rule.maxLength(96, "Keep titles under 96 characters")
      ]
    },
    notes: {
      rules: [Rule.maxLength(600, "Description must be under 600 characters")]
    },
    column: {
      value: ColumnId
    },
    priority: {
      value: TaskPriority
    },
    assignee: {
      required: "Assign 2-letter initials (e.g. AL)",
      rules: [
        Rule.pattern(/^[A-Za-z]{2,3}$/, "Use 2 or 3 letters (e.g. AL, MK)")
      ]
    },
    points: {
      required: "Enter story points (1–13)",
      rules: [
        Rule.pattern(/^(?:[1-9]|1[0-3])$/, "Pick a number between 1 and 13")
      ]
    },
    tags: {
      rules: []
    }
  },
  { mode: "onBlur", errors: "first" }
)

const TextField = Schema.Literals(["title", "notes", "assignee", "points", "tags"])

export const NewTaskMessage = UiSchema.TaggedEnum({
  UpdatedTextField: { name: TextField, value: Schema.String },
  BlurredTextField: { name: TextField },
  SelectedColumn: { column: ColumnId },
  SelectedPriority: { priority: TaskPriority },
  SubmittedForm: {},
  SucceededCreateTask: { id: Schema.String },
  FailedCreateTask: { reason: Schema.String }
})

export class CreateTask extends Command.Service<CreateTask>()(
  "folio/CreateTask",
  {
    args: { input: NewTaskInput },
    success: NewTaskMessage,
    invalidates: () => [TasksTag]
  }
) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return ({ input }) =>
        store.create(input).pipe(
          Effect.match({
            onSuccess: (task) =>
              NewTaskMessage.SucceededCreateTask({ id: task.id }),
            onFailure: (error) =>
              NewTaskMessage.FailedCreateTask({ reason: error.reason })
          })
        )
    })
  )
}

const parseTags = (raw: string): ReadonlyArray<string> =>
  raw
    .split(",")
    .map((part) => part.trim().toLowerCase().replace(/^#/, ""))
    .filter((part) => part.length > 0)
    .slice(0, 5)

export const NewTaskPageNoDeps = Html.component({
  name: "NewTaskPage",
  props: Schema.Struct({ route: NewTaskRoute }),
  model: Schema.Struct({
    form: NewTaskValidation.State,
    submitting: Schema.Boolean
  }),
  message: NewTaskMessage,
  restore: (model) => ({ ...model, submitting: false })
}).make({
  init: ($) => ({
    form: NewTaskValidation.init({
      title: "",
      notes: "",
      column: $.props.route.search.column,
      priority: "medium",
      assignee: "AL",
      points: "3",
      tags: "feature, ui"
    }),
    submitting: false
  }),
  update: {
    UpdatedTextField: ($, { name, value }) =>
      $.model.submitting
        ? $.model
        : $.evolve({
            form: (form) => NewTaskValidation.change(form, name, value)
          }),
    BlurredTextField: ($, { name }) =>
      $.evolve({
        form: (form) => NewTaskValidation.blur(form, name)
      }),
    SelectedColumn: ($, { column }) =>
      $.evolve({
        form: (form) => NewTaskValidation.change(form, "column", column)
      }),
    SelectedPriority: ($, { priority }) =>
      $.evolve({
        form: (form) => NewTaskValidation.change(form, "priority", priority)
      }),
    SubmittedForm: ($) => {
      const form = NewTaskValidation.submit($.model.form)
      return Option.match(NewTaskValidation.validate(form).value, {
        onNone: () => $.evolve({ form }),
        onSome: (values) =>
          $.model.submitting
            ? $.model
            : $.set({ form, submitting: true }).run(
                CreateTask.make({
                  input: {
                    title: values.title,
                    notes: values.notes,
                    column: values.column,
                    priority: values.priority,
                    assignee: values.assignee.toUpperCase(),
                    points: Number(values.points),
                    tags: parseTags(values.tags)
                  }
                })
              )
      })
    },
    SucceededCreateTask: ($) =>
      $.evolve({ submitting: false }).run(
        Router.push(AppRoute, AppRoute.Board()).pipe(Command.asNoop)
      ),
    FailedCreateTask: ($, { reason }) => ({
      submitting: false,
      form: NewTaskValidation.reject($.model.form, { title: [reason] })
    })
  },
  head: () => [Head.title("New Card")],
  view: (h, model) => {
    const { fields } = NewTaskValidation.validate(model.form)

    const fieldError = (field: Validation.Field<unknown>) =>
      field._tag === "Invalid"
        ? h.p.class("field-error").attr("role", "alert").children(field.errors[0] ?? "")
        : null

    return h.section.class("narrow-page").children(
      h.a
        .class("back-link")
        .attr("href", AppRoute.print(AppRoute.Board()))
        .children(ArrowLeftIcon(h, 14), h.span("Back to Kanban board")),
      h.div.class("page-card").children(
        h.span.class("eyebrow-tag").children("VALIDATION.MAKE · SCHEMA FORM"),
        h.h1.class("page-title").children("Create Kanban Card"),
        h.p.class("page-lead").children(
          "Validation errors are never stored in the Model — they are derived purely on every render and checked before dispatching CreateTask."
        ),
        h.form
          .class("editorial-form")
          .attr("novalidate", "")
          .on("submit", NewTaskMessage.SubmittedForm())
          .children(
            h.div.class("form-field").children(
              h.label.class("field-label").attr("for", "card-title").children("Card title *"),
              h.input
                .class("field-input", fields.title._tag === "Invalid" && "is-invalid")
                .attrs({
                  id: "card-title",
                  type: "text",
                  placeholder: "e.g. Add keyboard navigation across lanes",
                  "aria-invalid": fields.title._tag === "Invalid" ? "true" : undefined
                })
                .value(fields.title.value)
                .disabled(model.submitting)
                .on("input", ({ value }) =>
                  NewTaskMessage.UpdatedTextField({ name: "title", value })
                )
                .on(
                  "blur",
                  NewTaskMessage.BlurredTextField({ name: "title" })
                ),
              fieldError(fields.title)
            ),
            h.div.class("form-grid-2").children(
              h.div.class("form-field").children(
                h.label.class("field-label").attr("for", "card-column").children("Lane"),
                h.select
                  .class("field-select")
                  .attr("id", "card-column")
                  .value(fields.column.value)
                  .disabled(model.submitting)
                  .on("change", ({ value }) => {
                    const match = COLUMNS.find((c) => c.id === value)
                    return match
                      ? NewTaskMessage.SelectedColumn({ column: match.id })
                      : undefined
                  })
                  .children(
                    COLUMNS.map((col) =>
                      h.option.key(col.id).attr("value", col.id).children(col.title)
                    )
                  )
              ),
              h.div.class("form-field").children(
                h.label.class("field-label").attr("for", "card-priority").children("Priority"),
                h.select
                  .class("field-select")
                  .attr("id", "card-priority")
                  .value(fields.priority.value)
                  .disabled(model.submitting)
                  .on("change", ({ value }) =>
                    value === "high" || value === "medium" || value === "low"
                      ? NewTaskMessage.SelectedPriority({ priority: value })
                      : undefined
                  )
                  .children(
                    h.option.attr("value", "high").children("High"),
                    h.option.attr("value", "medium").children("Medium"),
                    h.option.attr("value", "low").children("Low")
                  )
              )
            ),
            h.div.class("form-grid-2").children(
              h.div.class("form-field").children(
                h.label.class("field-label").attr("for", "card-assignee").children("Assignee initials *"),
                h.input
                  .class("field-input", fields.assignee._tag === "Invalid" && "is-invalid")
                  .attrs({
                    id: "card-assignee",
                    type: "text",
                    maxlength: "3",
                    "aria-invalid":
                      fields.assignee._tag === "Invalid" ? "true" : undefined
                  })
                  .value(fields.assignee.value)
                  .disabled(model.submitting)
                  .on("input", ({ value }) =>
                    NewTaskMessage.UpdatedTextField({ name: "assignee", value })
                  )
                  .on(
                    "blur",
                    NewTaskMessage.BlurredTextField({ name: "assignee" })
                  ),
                fieldError(fields.assignee)
              ),
              h.div.class("form-field").children(
                h.label.class("field-label").attr("for", "card-points").children("Story points (1–13) *"),
                h.input
                  .class("field-input", fields.points._tag === "Invalid" && "is-invalid")
                  .attrs({
                    id: "card-points",
                    type: "text",
                    inputmode: "numeric",
                    "aria-invalid":
                      fields.points._tag === "Invalid" ? "true" : undefined
                  })
                  .value(fields.points.value)
                  .disabled(model.submitting)
                  .on("input", ({ value }) =>
                    NewTaskMessage.UpdatedTextField({ name: "points", value })
                  )
                  .on(
                    "blur",
                    NewTaskMessage.BlurredTextField({ name: "points" })
                  ),
                fieldError(fields.points)
              )
            ),
            h.div.class("form-field").children(
              h.label.class("field-label").attr("for", "card-tags").children("Tags (comma separated)"),
              h.input
                .class("field-input")
                .attrs({
                  id: "card-tags",
                  type: "text",
                  placeholder: "architecture, ui, queries"
                })
                .value(fields.tags.value)
                .disabled(model.submitting)
                .on("input", ({ value }) =>
                  NewTaskMessage.UpdatedTextField({ name: "tags", value })
                )
            ),
            h.div.class("form-field").children(
              h.label.class("field-label").attr("for", "card-notes").children("Specification / notes"),
              h.textarea
                .class("field-textarea", fields.notes._tag === "Invalid" && "is-invalid")
                .attrs({
                  id: "card-notes",
                  rows: "4",
                  placeholder: "Acceptance criteria, Effect layers, or implementation notes…"
                })
                .value(fields.notes.value)
                .disabled(model.submitting)
                .on("input", ({ value }) =>
                  NewTaskMessage.UpdatedTextField({ name: "notes", value })
                )
                .on(
                  "blur",
                  NewTaskMessage.BlurredTextField({ name: "notes" })
                ),
              fieldError(fields.notes)
            ),
            h.div.class("form-actions").children(
              h.button
                .class("primary-btn")
                .attr("type", "submit")
                .disabled(model.submitting)
                .children(model.submitting ? "Creating card…" : "Create card"),
              h.a
                .class("ghost-btn")
                .attr("href", AppRoute.print(AppRoute.Board()))
                .children("Cancel")
            )
          )
      )
    )
  }
})

export const NewTaskPage = NewTaskPageNoDeps.pipe(
  Component.provide(CreateTask.layer)
)
