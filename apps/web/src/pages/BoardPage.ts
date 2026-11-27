import { PlusIcon, RefreshIcon, SearchIcon } from "#components/Icons"
import { CARD_DRAG_TYPE, KanbanCard } from "#components/KanbanCard"
import { ColumnId, COLUMNS, columnTitle, type Task } from "#domain/Task"
import { ListTasks } from "#queries/ListTasks"
import { Command, Component, Head, Router } from "@effect/ui"
import { Html, HtmlHead } from "@effect/ui/html"
import {
  applyHtmlAttrs,
  filterAndRankCards,
  nextSegmentedValue,
  readProgress,
  readSegmentedControl
} from "@folio/effect-ui-sdk"
import { Layer, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { AppRoute, type PriorityFilter } from "../routes.ts"
import {
  BoardPageMessage,
  DeleteCard,
  MoveCard,
  QuickCreateCard,
  ResetBoard
} from "./boardCommands.ts"

export {
  BoardPageMessage,
  DeleteCard,
  MoveCard,
  QuickCreateCard,
  ResetBoard
} from "./boardCommands.ts"

const BoardRoute = AppRoute.subset(["Board"])

const BoardNotice = Schema.Struct({
  tone: Schema.Literals(["info", "error"]),
  text: Schema.String
})

const BoardPageDef = Html.component({
  name: "BoardPage",
  props: Schema.Struct({ route: BoardRoute }),
  model: Schema.Struct({
    dropOver: Schema.NullOr(ColumnId),
    composingColumn: Schema.NullOr(ColumnId),
    composerTitle: Schema.String,
    busyCardId: Schema.NullOr(Schema.String),
    notice: Schema.NullOr(BoardNotice)
  }),
  message: BoardPageMessage,
  queries: {
    tasks: { query: ListTasks, args: () => ({}) }
  },
  restore: (model) => ({
    ...model,
    dropOver: null,
    busyCardId: null
  })
})

const priorityOptions: ReadonlyArray<{
  readonly value: PriorityFilter
  readonly label: string
}> = [
  { value: "all", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" }
]

const densityOptions: ReadonlyArray<{
  readonly value: "comfortable" | "compact"
  readonly label: string
}> = [
  { value: "comfortable", label: "Detailed" },
  { value: "compact", label: "Compact" }
]

export const BoardPageNoDeps = BoardPageDef.make({
  init: () => ({
    dropOver: null,
    composingColumn: null,
    composerTitle: "",
    busyCardId: null,
    notice: null
  }),
  update: {
    TypedSearch: ($, { text }) =>
      $.run(
        Router.patchSearch(AppRoute, $.props.route, {
          q: text.length > 0 ? text : undefined
        }).pipe(Command.asNoop)
      ),
    SelectedPriority: ($, { priority }) =>
      $.run(
        Router.patchSearch(AppRoute, $.props.route, { priority }).pipe(
          Command.asNoop
        )
      ),
    SelectedDensity: ($, { density }) =>
      $.run(
        Router.patchSearch(AppRoute, $.props.route, { density }).pipe(
          Command.asNoop
        )
      ).viewTransition(["layout"]),
    DraggedIntoColumn: ($, { column }) => $.evolve({ dropOver: column }),
    DraggedOutOfColumn: ($, { column }) =>
      $.model.dropOver === column ? $.evolve({ dropOver: null }) : $.model,
    DroppedCardInColumn: ($, { column, id }) => {
      if (id.length === 0) return $.evolve({ dropOver: null })
      return $.evolve({
        dropOver: null,
        busyCardId: id,
        notice: null
      })
        .run(MoveCard.make({ id, column }))
        .viewTransition(["move-card"])
    },
    RequestedMoveCard: ($, { column, id }) =>
      $.evolve({ busyCardId: id, notice: null })
        .run(MoveCard.make({ id, column }))
        .viewTransition(["move-card"]),
    RequestedDeleteCard: ($, { id }) =>
      $.evolve({ busyCardId: id, notice: null }).run(DeleteCard.make({ id })),
    ClickedOpenComposer: ($, { column }) =>
      $.evolve({
        composingColumn: column,
        composerTitle: "",
        notice: null
      }),
    TypedComposerTitle: ($, { text }) => $.evolve({ composerTitle: text }),
    ClickedCancelComposer: ($) =>
      $.evolve({ composingColumn: null, composerTitle: "" }),
    SubmittedComposer: ($) => {
      const column = $.model.composingColumn
      const title = $.model.composerTitle.trim()
      if (column === null) return $.model
      if (title.length < 3) {
        return $.evolve({
          notice: {
            tone: "error" as const,
            text: "Quick card titles need at least 3 characters."
          }
        })
      }
      return $.evolve({
        composingColumn: null,
        composerTitle: "",
        notice: null
      }).run(QuickCreateCard.make({ title, column }))
    },
    ClickedResetBoard: ($) =>
      $.evolve({ notice: null }).run(ResetBoard.make()),
    SucceededMoveCard: ($, { column }) =>
      $.evolve({
        busyCardId: null,
        notice: {
          tone: "info" as const,
          text: `Moved card to ${columnTitle(column)}.`
        }
      }),
    FailedMoveCard: ($, { reason }) =>
      $.evolve({
        busyCardId: null,
        notice: { tone: "error" as const, text: reason }
      }),
    SucceededQuickCreate: ($, { column, title }) =>
      $.evolve({
        notice: {
          tone: "info" as const,
          text: `Added "${title}" to ${columnTitle(column)}.`
        }
      }),
    FailedQuickCreate: ($, { reason }) =>
      $.evolve({ notice: { tone: "error" as const, text: reason } }),
    SucceededDeleteCard: ($) =>
      $.evolve({
        busyCardId: null,
        notice: { tone: "info" as const, text: "Card deleted." }
      }),
    FailedDeleteCard: ($, { reason }) =>
      $.evolve({
        busyCardId: null,
        notice: { tone: "error" as const, text: reason }
      }),
    SucceededResetBoard: ($) =>
      $.evolve({
        notice: { tone: "info" as const, text: "Board reset to sample cards." }
      }),
    DismissedNotice: ($) => $.evolve({ notice: null })
  },
  head: () => [
    Head.title("Board"),
    HtmlHead.meta({
      name: "description",
      content: "Kanban board powered by @effect/ui and The Elm Architecture"
    })
  ],
  view: (h, model) => {
    const { density, priority, q } = h.props.route.search
    const queryText = q ?? ""
    const compact = density === "compact"

    const renderBoard = (allTasks: ReadonlyArray<Task>, waiting: boolean) => {
      const visibleTasks = filterAndRankCards(allTasks, queryText, priority)
      const totalPoints = allTasks.reduce((sum, task) => sum + task.points, 0)
      const donePoints = allTasks
        .filter((task) => task.column === "done")
        .reduce((sum, task) => sum + task.points, 0)
      const velocity = readProgress({
        id: "web-board-velocity",
        value: donePoints,
        min: 0,
        max: totalPoints,
        ariaLabel: "Sprint velocity"
      })
      const priorityControl = readSegmentedControl({
        id: "web-priority-filter",
        value: priority,
        ariaLabel: "Filter by priority",
        items: priorityOptions
      })
      const densityControl = readSegmentedControl({
        id: "web-density-toggle",
        value: density,
        ariaLabel: "Card density",
        items: densityOptions
      })

      return h.div.class("board-shell").attr("aria-busy", String(waiting)).children(
        h.section.class("board-hero").children(
          h.div.class("board-hero-copy").children(
            h.span.class("eyebrow-tag").children("SPRINT 26 · @EFFECT/UI + UI SDK"),
            h.h1.class("board-heading").children("Workflow Kanban"),
            h.p.class("board-lead").children(
              "Drag cards across lanes or use keyboard arrows. Every move is a typed Effect Command invalidating cached Queries."
            )
          ),
          h.div.class("board-telemetry").children(
            h.div.class("stat-block").children(
              h.span.class("stat-label").children("Cards"),
              h.span.class("stat-value").children(String(allTasks.length))
            ),
            h.div.class("stat-block").children(
              h.span.class("stat-label").children("Completed"),
              h.span.class("stat-value").children(`${donePoints}/${totalPoints}pt`)
            ),
            applyHtmlAttrs(
              h.div.class("stat-block progress-block"),
              velocity.rootAttrs
            ).children(
              h.div.class("progress-header").children(
                h.span.class("stat-label").children("Velocity"),
                applyHtmlAttrs(
                  h.span.class("stat-mono"),
                  velocity.valueAttrs
                ).children(velocity.text)
              ),
              applyHtmlAttrs(
                h.div.class("progress-track"),
                velocity.trackAttrs
              ).children(
                applyHtmlAttrs(
                  h.div.class("progress-fill"),
                  velocity.indicatorAttrs
                ).style({ width: `${velocity.percent}%` })
              )
            )
          )
        ),
        h.section.class("board-toolbar").attr("aria-label", "Board controls").children(
          h.div.class("search-wrap").children(
            SearchIcon(h, 15),
            h.input
              .class("search-input")
              .attrs({
                type: "search",
                placeholder: "Fuzzy filter by key, title, #tag, or assignee…",
                "aria-label": "Search cards"
              })
              .value(queryText)
              .on("input", ({ value }) =>
                BoardPageMessage.TypedSearch({ text: value })
              )
          ),
          h.div.class("toolbar-group").children(
            applyHtmlAttrs(
              h.div.class("segmented-control"),
              priorityControl.rootAttrs
            ).children(
              priorityControl.items.map((opt) =>
                applyHtmlAttrs(
                  h.button
                    .key(opt.value)
                    .class("segment-btn", opt.checked && "is-active")
                    .attr("type", "button"),
                  opt.attrs
                )
                  .on(
                    "click",
                    BoardPageMessage.SelectedPriority({ priority: opt.value })
                  )
                  .on("keydown", ({ key }) => {
                    const next = nextSegmentedValue(
                      priorityControl.items,
                      priority,
                      key
                    )
                    return next !== undefined
                      ? BoardPageMessage.SelectedPriority({ priority: next })
                      : undefined
                  })
                  .children(opt.label)
              )
            ),
            applyHtmlAttrs(
              h.div.class("segmented-control"),
              densityControl.rootAttrs
            ).children(
              densityControl.items.map((opt) =>
                applyHtmlAttrs(
                  h.button
                    .key(opt.value)
                    .class("segment-btn", opt.checked && "is-active")
                    .attr("type", "button"),
                  opt.attrs
                )
                  .on(
                    "click",
                    BoardPageMessage.SelectedDensity({ density: opt.value })
                  )
                  .on("keydown", ({ key }) => {
                    const next = nextSegmentedValue(
                      densityControl.items,
                      density,
                      key
                    )
                    return next !== undefined
                      ? BoardPageMessage.SelectedDensity({ density: next })
                      : undefined
                  })
                  .children(opt.label)
              )
            ),
            h.button
              .class("ghost-btn")
              .attrs({
                type: "button",
                title: "Restore default sample cards"
              })
              .disabled(h.isRunning(ResetBoard))
              .on("click", BoardPageMessage.ClickedResetBoard())
              .children(RefreshIcon(h, 14), h.span("Reset demo"))
          )
        ),
        model.notice !== null &&
          h.div
            .class("board-notice", `tone-${model.notice.tone}`)
            .attr("role", model.notice.tone === "error" ? "alert" : "status")
            .children(
              h.span(model.notice.text),
              h.button
                .class("notice-dismiss")
                .attr("type", "button")
                .on("click", BoardPageMessage.DismissedNotice())
                .children("Dismiss")
            ),
        h.div.class("kanban-columns").children(
          COLUMNS.map((col) => {
            const colTasks = visibleTasks.filter(
              (task) => task.column === col.id
            )
            const colPoints = colTasks.reduce((sum, task) => sum + task.points, 0)
            const overWip =
              col.wipLimit !== undefined && colTasks.length > col.wipLimit
            const isDropTarget = model.dropOver === col.id
            const isComposing = model.composingColumn === col.id

            return h.section
              .key(col.id)
              .class(
                "kanban-column",
                `column-${col.id}`,
                isDropTarget && "is-drop-over",
                overWip && "is-over-wip"
              )
              .attr("aria-label", `${col.title} column`)
              .dropTarget({ accepts: [CARD_DRAG_TYPE], dropEffect: "move" })
              .on(
                "dragenter",
                BoardPageMessage.DraggedIntoColumn({ column: col.id })
              )
              .on(
                "dragleave",
                BoardPageMessage.DraggedOutOfColumn({ column: col.id })
              )
              .on("drop", ({ data }) =>
                BoardPageMessage.DroppedCardInColumn({
                  id: data[CARD_DRAG_TYPE] ?? "",
                  column: col.id
                })
              )
              .children(
                h.header.class("column-header").children(
                  h.div.class("column-heading-row").children(
                    h.span.class("column-code").children(col.code),
                    h.h2.class("column-title").children(col.title),
                    h.span
                      .class("column-count", overWip && "is-over")
                      .children(
                        col.wipLimit !== undefined
                          ? `${colTasks.length}/${col.wipLimit}`
                          : String(colTasks.length)
                      )
                  ),
                  h.div.class("column-meta-row").children(
                    h.span.class("column-points").children(`${colPoints} pt`),
                    overWip &&
                      h.span.class("wip-warning").children("WIP exceeded")
                  )
                ),
                h.div.class("column-body").children(
                  isComposing &&
                    h.form
                      .class("quick-composer")
                      .on("submit", BoardPageMessage.SubmittedComposer())
                      .children(
                        h.input
                          .class("composer-input")
                          .attrs({
                            type: "text",
                            placeholder: `New card in ${col.title}…`,
                            "aria-label": `New card title for ${col.title}`,
                            autofocus: ""
                          })
                          .value(model.composerTitle)
                          .on("input", ({ value }) =>
                            BoardPageMessage.TypedComposerTitle({ text: value })
                          )
                          .on("keydown", ({ key }) =>
                            key === "Escape"
                              ? BoardPageMessage.ClickedCancelComposer()
                              : undefined
                          ),
                        h.div.class("composer-actions").children(
                          h.button
                            .class("primary-btn small")
                            .attr("type", "submit")
                            .disabled(h.isRunning(QuickCreateCard))
                            .children("Add card"),
                          h.button
                            .class("ghost-btn small")
                            .attr("type", "button")
                            .on("click", BoardPageMessage.ClickedCancelComposer())
                            .children("Cancel")
                        )
                      ),
                  colTasks.length === 0 && !isComposing
                    ? h.div.class("column-empty").children(
                        h.p(
                          isDropTarget
                            ? `Drop card into ${col.title}`
                            : "No matching cards"
                        )
                      )
                    : colTasks.map((task) =>
                        KanbanCard(h, {
                          key: task.id,
                          props: {
                            task,
                            compact,
                            busy: model.busyCardId === task.id,
                            searchQuery: queryText
                          },
                          onEmit: {
                            RequestedMove: ({ column, id }) =>
                              BoardPageMessage.RequestedMoveCard({ id, column }),
                            RequestedDelete: ({ id }) =>
                              BoardPageMessage.RequestedDeleteCard({ id })
                          }
                        })
                      )
                ),
                h.footer.class("column-footer").children(
                  h.button
                    .class("column-add-btn")
                    .attr("type", "button")
                    .on(
                      "click",
                      BoardPageMessage.ClickedOpenComposer({ column: col.id })
                    )
                    .children(PlusIcon(h, 14), h.span("Quick add")),
                  h.a
                    .class("column-full-link")
                    .attr(
                      "href",
                      AppRoute.print(
                        AppRoute.NewTask({ search: { column: col.id } })
                      )
                    )
                    .children("Full form →")
                )
              )
          })
        )
      )
    }

    return AsyncResult.match(h.queries.tasks, {
      onInitial: () =>
        h.div.class("state-panel").children(
          h.p.class("state-title").children("Loading Kanban board…"),
          h.p.class("state-sub").children("Hydrating Query cache from TaskStore Layer")
        ),
      onFailure: () =>
        h.div.class("state-panel").children(
          h.p.class("state-title").children("Unable to load cards"),
          h.button
            .class("primary-btn")
            .attr("type", "button")
            .on("click", BoardPageMessage.ClickedResetBoard())
            .children("Reload board")
        ),
      onSuccess: ({ value, waiting }) => renderBoard(value, waiting)
    })
  }
})

export const BoardPage = BoardPageNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(
      ListTasks.layer,
      MoveCard.layer,
      QuickCreateCard.layer,
      DeleteCard.layer,
      ResetBoard.layer
    )
  )
)
