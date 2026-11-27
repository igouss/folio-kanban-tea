import {
  ArrowLeftIcon,
  ArrowRightIcon,
  GripIcon,
  TrashIcon
} from "#components/Icons"
import {
  adjacentColumns,
  ColumnId,
  columnTitle,
  priorityLabel,
  Task
} from "#domain/Task"
import { UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { highlightText } from "@folio/effect-ui-sdk"
import { Schema } from "effect"
import { AppRoute } from "../routes.ts"

export const CARD_DRAG_TYPE = "application/x-folio-card"

export const KanbanCardProps = Schema.Struct({
  task: Task,
  compact: Schema.Boolean,
  busy: Schema.Boolean,
  searchQuery: Schema.optional(Schema.String)
})
export type KanbanCardProps = typeof KanbanCardProps.Type

export const KanbanCardMessage = UiSchema.TaggedEnum({
  ClickedMoveLeft: {},
  ClickedMoveRight: {},
  ClickedDelete: {}
})

export const KanbanCardEvents = UiSchema.TaggedEnum({
  RequestedMove: { id: Schema.String, column: ColumnId },
  RequestedDelete: { id: Schema.String }
})

export const KanbanCard = Html.component({
  name: "KanbanCard",
  props: KanbanCardProps,
  model: Schema.Struct({}),
  message: KanbanCardMessage,
  events: KanbanCardEvents
}).make({
  init: () => ({}),
  update: {
    ClickedMoveLeft: ($) => {
      const { prev } = adjacentColumns($.props.task.column)
      return prev === undefined
        ? $.model
        : $.emit(
            KanbanCardEvents.RequestedMove({
              id: $.props.task.id,
              column: prev
            })
          )
    },
    ClickedMoveRight: ($) => {
      const { next } = adjacentColumns($.props.task.column)
      return next === undefined
        ? $.model
        : $.emit(
            KanbanCardEvents.RequestedMove({
              id: $.props.task.id,
              column: next
            })
          )
    },
    ClickedDelete: ($) =>
      $.emit(KanbanCardEvents.RequestedDelete({ id: $.props.task.id }))
  },
  view: (h) => {
    const { busy, compact, searchQuery, task } = h.props
    const { next, prev } = adjacentColumns(task.column)
    const detailHref = AppRoute.print(
      AppRoute.TaskDetail({ params: { id: task.id } })
    )
    const titleSegments = highlightText(task.title, searchQuery ?? "")

    return h.article
      .class(
        "kanban-card",
        `priority-${task.priority}`,
        compact && "is-compact",
        busy && "is-busy"
      )
      .style({ viewTransitionName: `card-${task.id}` })
      .draggable({ [CARD_DRAG_TYPE]: task.id }, { effectAllowed: "move" })
      .children(
        h.div.class("card-top").children(
          h.div.class("card-key-group").children(
            h.span.class("drag-grip").attr("title", "Drag card to another column").children(
              GripIcon(h, 13)
            ),
            h.span.class("card-key").children(task.key),
            h.span
              .class("priority-pill", `priority-${task.priority}`)
              .children(priorityLabel(task.priority))
          ),
          h.div.class("card-actions").children(
            prev !== undefined &&
              h.button
                .class("icon-btn")
                .attrs({
                  type: "button",
                  title: `Move to ${columnTitle(prev)}`,
                  "aria-label": `Move ${task.title} to ${columnTitle(prev)}`
                })
                .disabled(busy)
                .on("click", KanbanCardMessage.ClickedMoveLeft())
                .children(ArrowLeftIcon(h, 13)),
            next !== undefined &&
              h.button
                .class("icon-btn")
                .attrs({
                  type: "button",
                  title: `Move to ${columnTitle(next)}`,
                  "aria-label": `Move ${task.title} to ${columnTitle(next)}`
                })
                .disabled(busy)
                .on("click", KanbanCardMessage.ClickedMoveRight())
                .children(ArrowRightIcon(h, 13)),
            h.button
              .class("icon-btn danger")
              .attrs({
                type: "button",
                title: "Delete card",
                "aria-label": `Delete ${task.title}`
              })
              .disabled(busy)
              .on("click", KanbanCardMessage.ClickedDelete())
              .children(TrashIcon(h, 13))
          )
        ),
        h.a
          .class("card-title-link")
          .attr("href", detailHref)
          .children(
            titleSegments.length === 1 && !titleSegments[0]?.match
              ? task.title
              : titleSegments.map((seg, idx) =>
                  seg.match
                    ? h.mark.key(String(idx)).class("search-hit").children(seg.text)
                    : seg.text
                )
          ),
        !compact &&
          task.notes.length > 0 &&
          h.p.class("card-excerpt").children(task.notes),
        h.div.class("card-footer").children(
          h.div.class("card-tags").children(
            task.tags.map((tag) =>
              h.span.key(tag).class("tag-chip").children(`#${tag}`)
            )
          ),
          h.div.class("card-meta").children(
            h.span
              .class("points-badge")
              .attr("title", `${task.points} story points`)
              .children(`${task.points}pt`),
            h.span
              .class("assignee-avatar")
              .attr("title", `Assignee ${task.assignee}`)
              .children(task.assignee)
          )
        )
      )
  }
})
