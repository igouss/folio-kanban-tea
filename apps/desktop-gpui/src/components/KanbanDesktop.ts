import { Command, Head, UiSchema } from "@effect/ui"
import { Gpui } from "@folio/effect-ui-gpui"
import { formatTransferNotice } from "@folio/effect-ui-sdk"
import {
  DEFAULT_CARDS,
  applyDeleteCard,
  applyMoveCard,
  applyQuickCreate,
  applyResetBoard,
  applySaveDraft,
  cardToDraft,
  emptyHistory,
  findCard,
  normalizeDraftAssignee,
  redoHistory,
  themeLabel,
  toggleTheme,
  undoHistory
} from "@folio/kanban-core"
import {
  BoardHistorySchema,
  CardDraftSchema,
  KanbanCardSchema,
  LaneId,
  Priority,
  PriorityFilter,
  SavedBoardSchema,
  ThemeMode
} from "@folio/kanban-core/schema"
import { Effect, Option, Schema } from "effect"
import { BoardStorage } from "../services/storage.ts"
import { boardView } from "../views/BoardView.ts"

export const KanbanDesktopProps = Schema.Struct({
  initialBoard: Schema.OptionFromUndefinedOr(SavedBoardSchema)
})
export type KanbanDesktopProps = typeof KanbanDesktopProps.Type

export const KanbanDesktopModel = Schema.Struct({
  cards: Schema.Array(KanbanCardSchema),
  history: BoardHistorySchema,
  theme: ThemeMode,
  searchQuery: Schema.String,
  priorityFilter: PriorityFilter,
  newCardLane: Schema.OptionFromNullOr(LaneId),
  newCardTitle: Schema.String,
  editDraft: Schema.OptionFromNullOr(CardDraftSchema),
  notice: Schema.String,
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
  ClickedAddCard: { lane: LaneId },
  TypedNewCardTitle: { value: Schema.String },
  SubmittedNewCard: {},
  CancelledNewCard: {},
  ClickedMoveCard: { cardId: Schema.String, toLane: LaneId },
  ClickedDeleteCard: { cardId: Schema.String },
  ClickedOpenEditor: { cardId: Schema.String },
  TypedEditTitle: { value: Schema.String },
  TypedEditNotes: { value: Schema.String },
  SelectedEditPriority: { priority: Priority },
  SelectedEditLane: { lane: LaneId },
  TypedEditAssignee: { value: Schema.String },
  SelectedEditPoints: { points: Schema.Number },
  SubmittedEditCard: {},
  CancelledEditCard: {},
  ClickedResetDemo: {},
  DismissedNotice: {}
})
export type KanbanDesktopMessage = typeof KanbanDesktopMessage.Type

export class SaveBoard extends Command.Service<SaveBoard>()("desktop/SaveBoard", {
  args: SavedBoardSchema
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const storage = yield* BoardStorage
      return (board) => storage.save(board)
    })
  )
}

export const KanbanDesktop = Gpui.component({
  name: "KanbanDesktop",
  props: KanbanDesktopProps,
  model: KanbanDesktopModel,
  message: KanbanDesktopMessage
}).make({
  init: ({ props }) => {
    const saved = Option.getOrUndefined(props.initialBoard)
    return {
      cards: saved?.cards ?? [...DEFAULT_CARDS],
      history: emptyHistory(),
      theme: saved?.theme ?? ("paper" as const),
      searchQuery: "",
      priorityFilter: "all" as const,
      newCardLane: Option.none(),
      newCardTitle: "",
      editDraft: Option.none(),
      notice: "",
      dispatchCount: 0,
      nextId: 1
    }
  },

  head: ({ model }) => [
    Head.title(`Folio Kanban · @effect/ui GPUI (${model.cards.length} cards)`)
  ],

  update: {
    TypedSearchQuery: ($, { value }) =>
      $.evolve({ searchQuery: value, dispatchCount: (n) => n + 1 }),

    SelectedPriorityFilter: ($, { priority }) =>
      $.evolve({ priorityFilter: priority, dispatchCount: (n) => n + 1 }),

    ClickedToggleTheme: ($) => {
      const nextTheme = toggleTheme($.model.theme)
      return $.evolve({
        theme: nextTheme,
        notice: `Switched GPUI theme to ${themeLabel(nextTheme)}.`,
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ cards: $.model.cards, theme: nextTheme }))
    },

    ClickedUndo: ($) => {
      const result = undoHistory($.model.history, $.model.cards)
      if (result === undefined) return $.model
      return $.evolve({
        cards: result.cards,
        history: result.history,
        notice: "Undid last board change.",
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    ClickedRedo: ($) => {
      const result = redoHistory($.model.history, $.model.cards)
      if (result === undefined) return $.model
      return $.evolve({
        cards: result.cards,
        history: result.history,
        notice: "Redid board change.",
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    ClickedAddCard: ($, { lane }) =>
      $.evolve({
        newCardLane: Option.some(lane),
        newCardTitle: "",
        dispatchCount: (n) => n + 1
      }),

    TypedNewCardTitle: ($, { value }) =>
      $.evolve({ newCardTitle: value, dispatchCount: (n) => n + 1 }),

    SubmittedNewCard: ($) =>
      Option.match($.model.newCardLane, {
        onNone: () => $.model,
        onSome: (lane) => {
          const result = applyQuickCreate($.model, {
            title: $.model.newCardTitle,
            lane,
            id: `gpui-card-${$.model.nextId}`,
            tag: "gpui"
          })
          if (!result.ok) {
            return $.evolve({
              notice: result.error,
              dispatchCount: (n) => n + 1
            })
          }
          return $.evolve({
            cards: result.cards,
            history: result.history,
            newCardLane: Option.none(),
            newCardTitle: "",
            nextId: (n) => n + 1,
            notice: `Added ${result.card.code} "${result.card.title}" to ${result.laneName}.`,
            dispatchCount: (n) => n + 1
          }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
        }
      }),

    CancelledNewCard: ($) =>
      $.evolve({
        newCardLane: Option.none(),
        newCardTitle: "",
        dispatchCount: (n) => n + 1
      }),

    ClickedMoveCard: ($, { cardId, toLane }) => {
      const result = applyMoveCard($.model, cardId, toLane)
      if (result === undefined) return $.model
      return $.evolve({
        cards: result.cards,
        history: result.history,
        notice: formatTransferNotice({
          type: "drop",
          cardId,
          cardTitle: result.card.title,
          laneTitle: result.laneName,
          position: 1,
          total: result.totalInTargetLane
        }),
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    ClickedDeleteCard: ($, { cardId }) => {
      const result = applyDeleteCard($.model, cardId)
      if (result === undefined) return $.model
      return $.evolve({
        cards: result.cards,
        history: result.history,
        editDraft: Option.none(),
        notice: `Deleted "${result.card.title}".`,
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    ClickedOpenEditor: ($, { cardId }) => {
      const card = findCard($.model.cards, cardId)
      if (card === undefined) return $.model
      return $.evolve({
        editDraft: Option.some(cardToDraft(card)),
        dispatchCount: (n) => n + 1
      })
    },

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

    SelectedEditLane: ($, { lane }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, lane })),
        dispatchCount: (n) => n + 1
      }),

    TypedEditAssignee: ($, { value }) =>
      $.evolve({
        editDraft: Option.map((d) => ({
          ...d,
          assignee: normalizeDraftAssignee(value)
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
          const result = applySaveDraft($.model, draft)
          if (!result.ok) {
            return $.evolve({
              notice: result.error,
              dispatchCount: (n) => n + 1
            })
          }
          return $.evolve({
            cards: result.cards,
            history: result.history,
            editDraft: Option.none(),
            notice: `Saved ${result.card.code}.`,
            dispatchCount: (n) => n + 1
          }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
        }
      }),

    CancelledEditCard: ($) =>
      $.evolve({ editDraft: Option.none(), dispatchCount: (n) => n + 1 }),

    ClickedResetDemo: ($) => {
      const result = applyResetBoard($.model)
      return $.evolve({
        cards: result.cards,
        history: result.history,
        searchQuery: "",
        priorityFilter: "all" as const,
        newCardLane: Option.none(),
        editDraft: Option.none(),
        notice: "Reset Kanban board to default cards.",
        dispatchCount: (n) => n + 1
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    DismissedNotice: ($) =>
      $.evolve({ notice: "", dispatchCount: (n) => n + 1 })
  },

  view: (h, model) => boardView(h, model)
})
