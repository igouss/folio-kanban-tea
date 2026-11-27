import { Command, Head, UiSchema } from "@effect/ui"
import { Gpui } from "@folio/effect-ui-gpui"
import { createBoardHistory, formatTransferNotice } from "@folio/effect-ui-sdk"
import { Effect, Option, Schema } from "effect"
import {
  Column,
  DEFAULT_COLUMNS,
  EditDraft,
  Priority,
  PriorityFilter,
  SavedBoard,
  ThemeMode,
  appendCard,
  findCardWithColumn,
  insertCard,
  nextCardCode,
  removeCard,
  reorder
} from "../domain/board.ts"
import { BoardStorage } from "../services/storage.ts"
import { boardView } from "../views/BoardView.ts"

export const KanbanDesktopProps = Schema.Struct({
  initialBoard: Schema.OptionFromUndefinedOr(SavedBoard)
})
export type KanbanDesktopProps = typeof KanbanDesktopProps.Type

export const KanbanDesktopModel = Schema.Struct({
  columns: Schema.Array(Column),
  theme: ThemeMode,
  searchQuery: Schema.String,
  priorityFilter: PriorityFilter,
  newCardColumnId: Schema.OptionFromNullOr(Schema.String),
  newCardTitle: Schema.String,
  editDraft: Schema.OptionFromNullOr(EditDraft),
  notice: Schema.String,
  canUndo: Schema.Boolean,
  canRedo: Schema.Boolean,
  dispatchCount: Schema.Number,
  nextId: Schema.Number
})
export type KanbanDesktopModel = typeof KanbanDesktopModel.Type

export const KanbanDesktopMessage = UiSchema.TaggedEnum({
  TypedSearchQuery: { value: Schema.String },
  SelectedPriorityFilter: { priority: PriorityFilter },
  ClickedToggleTheme: {},
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedAddCard: { columnId: Schema.String },
  TypedNewCardTitle: { value: Schema.String },
  SubmittedNewCard: {},
  CancelledNewCard: {},
  ClickedMoveCard: {
    cardId: Schema.String,
    fromColumnId: Schema.String,
    toColumnId: Schema.String
  },
  ClickedDeleteCard: { cardId: Schema.String, columnId: Schema.String },
  ClickedOpenEditor: { cardId: Schema.String },
  TypedEditTitle: { value: Schema.String },
  TypedEditNotes: { value: Schema.String },
  SelectedEditPriority: { priority: Priority },
  SelectedEditColumn: { columnId: Schema.String },
  TypedEditAssignee: { value: Schema.String },
  SelectedEditPoints: { points: Schema.Number },
  SubmittedEditCard: {},
  CancelledEditCard: {},
  ClickedResetDemo: {},
  DismissedNotice: {}
})
export type KanbanDesktopMessage = typeof KanbanDesktopMessage.Type

export class SaveBoard extends Command.Service<SaveBoard>()("desktop/SaveBoard", {
  args: SavedBoard
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const storage = yield* BoardStorage
      return (board) => storage.save(board)
    })
  )
}

const findCardTitle = (columns: ReadonlyArray<Column>, cardId: string): string => {
  for (const col of columns) {
    const hit = col.cards.find((c) => c.id === cardId)
    if (hit !== undefined) return hit.title
  }
  return cardId
}

const findColumnName = (columns: ReadonlyArray<Column>, columnId: string): string =>
  columns.find((c) => c.id === columnId)?.name ?? columnId

const boardHistory = createBoardHistory<ReadonlyArray<Column>>(DEFAULT_COLUMNS, {
  limit: 50
})

export const KanbanDesktop = Gpui.component({
  name: "KanbanDesktop",
  props: KanbanDesktopProps,
  model: KanbanDesktopModel,
  message: KanbanDesktopMessage
}).make({
  init: ({ props }) => {
    const saved = Option.getOrUndefined(props.initialBoard)
    const initialColumns = saved?.columns ?? DEFAULT_COLUMNS
    boardHistory.reset(initialColumns)
    return {
      columns: initialColumns,
      theme: saved?.theme ?? ("paper" as const),
      searchQuery: "",
      priorityFilter: "all" as const,
      newCardColumnId: Option.none(),
      newCardTitle: "",
      editDraft: Option.none(),
      notice: "",
      canUndo: false,
      canRedo: false,
      dispatchCount: 0,
      nextId: 1
    }
  },

  head: ({ model }) => {
    const total = model.columns.reduce((acc, col) => acc + col.cards.length, 0)
    return [Head.title(`Folio Kanban · @effect/ui GPUI (${total} cards)`)]
  },

  update: {
    TypedSearchQuery: ($, { value }) =>
      $.evolve({ searchQuery: value, dispatchCount: (n) => n + 1 }),

    SelectedPriorityFilter: ($, { priority }) =>
      $.evolve({ priorityFilter: priority, dispatchCount: (n) => n + 1 }),

    ClickedToggleTheme: ($) => {
      const nextTheme = $.model.theme === "paper" ? ("graphite" as const) : ("paper" as const)
      return $.evolve({
        theme: nextTheme,
        notice: `Switched GPUI theme to ${nextTheme === "paper" ? "Paper (Light)" : "Graphite (Dark)"}.`,
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ columns: $.model.columns, theme: nextTheme }))
    },

    ClickedUndo: ($) => {
      const previous = boardHistory.undo()
      if (previous === undefined) return $.model
      return $.evolve({
        columns: previous,
        canUndo: boardHistory.canUndo(),
        canRedo: boardHistory.canRedo(),
        notice: "Undid last board change.",
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ columns: previous, theme: $.model.theme }))
    },

    ClickedRedo: ($) => {
      const next = boardHistory.redo()
      if (next === undefined) return $.model
      return $.evolve({
        columns: next,
        canUndo: boardHistory.canUndo(),
        canRedo: boardHistory.canRedo(),
        notice: "Redid board change.",
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ columns: next, theme: $.model.theme }))
    },

    ClickedAddCard: ($, { columnId }) =>
      $.evolve({
        newCardColumnId: Option.some(columnId),
        newCardTitle: "",
        dispatchCount: (n) => n + 1
      }),

    TypedNewCardTitle: ($, { value }) =>
      $.evolve({ newCardTitle: value, dispatchCount: (n) => n + 1 }),

    SubmittedNewCard: ($) =>
      Option.match($.model.newCardColumnId, {
        onNone: () => $.model,
        onSome: (columnId) => {
          const title = $.model.newCardTitle.trim()
          if (title.length < 2) {
            return $.evolve({
              notice: "Card title must be at least 2 characters.",
              dispatchCount: (n) => n + 1
            })
          }
          const code = nextCardCode($.model.columns)
          const cardId = `gpui-card-${$.model.nextId}`
          const nextColumns = $.model.columns.map((column) =>
            column.id !== columnId
              ? column
              : appendCard(column, {
                  id: cardId,
                  code,
                  title,
                  notes: "",
                  priority: "medium",
                  assignee: "ME",
                  points: 2,
                  tags: ["gpui"],
                  sortKey: ""
                })
          )
          const laneName = findColumnName($.model.columns, columnId)
          boardHistory.record(nextColumns)
          return $.evolve({
            columns: nextColumns,
            newCardColumnId: Option.none(),
            newCardTitle: "",
            nextId: (n) => n + 1,
            canUndo: boardHistory.canUndo(),
            canRedo: boardHistory.canRedo(),
            notice: `Added ${code} "${title}" to ${laneName}.`,
            dispatchCount: (n) => n + 1
          }).run(SaveBoard.make({ columns: nextColumns, theme: $.model.theme }))
        }
      }),

    CancelledNewCard: ($) =>
      $.evolve({
        newCardColumnId: Option.none(),
        newCardTitle: "",
        dispatchCount: (n) => n + 1
      }),

    ClickedMoveCard: ($, { cardId, fromColumnId, toColumnId }) => {
      const nextColumns = reorder($.model.columns, cardId, fromColumnId, toColumnId, 0)
      const title = findCardTitle($.model.columns, cardId)
      const laneName = findColumnName($.model.columns, toColumnId)
      const destTotal =
        nextColumns.find((col) => col.id === toColumnId)?.cards.length ?? 1
      boardHistory.record(nextColumns)
      return $.evolve({
        columns: nextColumns,
        canUndo: boardHistory.canUndo(),
        canRedo: boardHistory.canRedo(),
        notice: formatTransferNotice({
          type: "drop",
          cardId,
          cardTitle: title,
          laneTitle: laneName,
          position: 1,
          total: destTotal
        }),
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ columns: nextColumns, theme: $.model.theme }))
    },

    ClickedDeleteCard: ($, { cardId, columnId }) => {
      const title = findCardTitle($.model.columns, cardId)
      const nextColumns = $.model.columns.map((column) =>
        column.id === columnId ? removeCard(column, cardId).column : column
      )
      boardHistory.record(nextColumns)
      return $.evolve({
        columns: nextColumns,
        editDraft: Option.none(),
        canUndo: boardHistory.canUndo(),
        canRedo: boardHistory.canRedo(),
        notice: `Deleted "${title}".`,
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ columns: nextColumns, theme: $.model.theme }))
    },

    ClickedOpenEditor: ($, { cardId }) =>
      Option.match(findCardWithColumn($.model.columns, cardId), {
        onNone: () => $.model,
        onSome: ({ column, card }) =>
          $.evolve({
            editDraft: Option.some({
              cardId: card.id,
              columnId: column.id,
              code: card.code,
              title: card.title,
              notes: card.notes,
              priority: card.priority,
              assignee: card.assignee,
              points: card.points
            }),
            dispatchCount: (n) => n + 1
          })
      }),

    TypedEditTitle: ($, { value }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, title: value })),
        dispatchCount: (n) => n + 1
      }),

    TypedEditNotes: ($, { value }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, notes: value })),
        dispatchCount: (n) => n + 1
      }),

    SelectedEditPriority: ($, { priority }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, priority })),
        dispatchCount: (n) => n + 1
      }),

    SelectedEditColumn: ($, { columnId }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, columnId })),
        dispatchCount: (n) => n + 1
      }),

    TypedEditAssignee: ($, { value }) =>
      $.evolve({
        editDraft: Option.map((d) => ({
          ...d,
          assignee: value.toUpperCase().slice(0, 3)
        })),
        dispatchCount: (n) => n + 1
      }),

    SelectedEditPoints: ($, { points }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, points })),
        dispatchCount: (n) => n + 1
      }),

    SubmittedEditCard: ($) =>
      Option.match($.model.editDraft, {
        onNone: () => $.model,
        onSome: (draft) => {
          const trimmedTitle = draft.title.trim()
          if (trimmedTitle.length < 2) {
            return $.evolve({
              notice: "Card title must be at least 2 characters.",
              dispatchCount: (n) => n + 1
            })
          }
          const existing = findCardWithColumn($.model.columns, draft.cardId)
          if (Option.isNone(existing)) {
            return $.evolve({ editDraft: Option.none(), dispatchCount: (n) => n + 1 })
          }
          const { column: originalCol, card: originalCard } = existing.value
          const updatedCard = {
            ...originalCard,
            title: trimmedTitle,
            notes: draft.notes.trim(),
            priority: draft.priority,
            assignee: draft.assignee.trim() || "ME",
            points: draft.points
          }
          const nextColumns =
            originalCol.id === draft.columnId
              ? $.model.columns.map((col) =>
                  col.id !== originalCol.id
                    ? col
                    : {
                        ...col,
                        cards: col.cards.map((c) =>
                          c.id === draft.cardId ? updatedCard : c
                        )
                      }
                )
              : $.model.columns.map((col) => {
                  if (col.id === originalCol.id) {
                    return removeCard(col, draft.cardId).column
                  }
                  if (col.id === draft.columnId) {
                    return insertCard(col, updatedCard, 0)
                  }
                  return col
                })
          boardHistory.record(nextColumns)
          return $.evolve({
            columns: nextColumns,
            editDraft: Option.none(),
            canUndo: boardHistory.canUndo(),
            canRedo: boardHistory.canRedo(),
            notice: `Saved ${updatedCard.code}.`,
            dispatchCount: (n) => n + 1
          }).run(SaveBoard.make({ columns: nextColumns, theme: $.model.theme }))
        }
      }),

    CancelledEditCard: ($) =>
      $.evolve({ editDraft: Option.none(), dispatchCount: (n) => n + 1 }),

    ClickedResetDemo: ($) => {
      boardHistory.record(DEFAULT_COLUMNS)
      return $.evolve({
        columns: DEFAULT_COLUMNS,
        searchQuery: "",
        priorityFilter: "all" as const,
        newCardColumnId: Option.none(),
        editDraft: Option.none(),
        canUndo: boardHistory.canUndo(),
        canRedo: boardHistory.canRedo(),
        notice: "Reset Kanban board to default cards.",
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ columns: DEFAULT_COLUMNS, theme: $.model.theme }))
    },

    DismissedNotice: ($) =>
      $.evolve({ notice: "", dispatchCount: (n) => n + 1 })
  },

  view: (h, model) => boardView(h, model)
})
