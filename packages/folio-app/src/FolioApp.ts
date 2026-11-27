import { Head, Subscription, UiSchema } from "@effect/ui"
import { formatTransferNotice } from "@folio/effect-ui-sdk"
import { Ui } from "@folio/effect-ui-universal"
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
import { Effect, Option, Schema, Stream } from "effect"
import { AppLifecycle, SaveBoard } from "./services.ts"
import { boardView } from "./views/BoardView.ts"

export const FolioPlatform = Schema.Literals(["web", "desktop", "mobile"])
export type FolioPlatform = typeof FolioPlatform.Type

export const FolioLayout = Schema.Literals(["columns", "tabs"])
export type FolioLayout = typeof FolioLayout.Type

export const CardDensity = Schema.Literals(["comfortable", "compact"])
export type CardDensity = typeof CardDensity.Type

export const FolioAppProps = Schema.Struct({
  platform: FolioPlatform,
  platformLabel: Schema.String,
  layout: FolioLayout,
  topInset: Schema.Number,
  initialBoard: Schema.OptionFromUndefinedOr(SavedBoardSchema)
})
export type FolioAppProps = typeof FolioAppProps.Type

export const webAppProps = (
  initialBoard: Option.Option<typeof SavedBoardSchema.Type> = Option.none()
): FolioAppProps => ({
  platform: "web",
  platformLabel: "Web · DOM Host",
  layout: "columns",
  topInset: 0,
  initialBoard
})

export const desktopAppProps = (
  initialBoard: Option.Option<typeof SavedBoardSchema.Type> = Option.none()
): FolioAppProps => ({
  platform: "desktop",
  platformLabel: "GPUI · Native GPU",
  layout: "columns",
  topInset: 0,
  initialBoard
})

export const mobileAppProps = (
  initialBoard: Option.Option<typeof SavedBoardSchema.Type> = Option.none()
): FolioAppProps => ({
  platform: "mobile",
  platformLabel: "Fabric · Native Mobile",
  layout: "tabs",
  topInset: 56,
  initialBoard
})

export const FolioAppModel = Schema.Struct({
  cards: Schema.Array(KanbanCardSchema),
  history: BoardHistorySchema,
  theme: ThemeMode,
  density: CardDensity,
  activeLane: LaneId,
  searchQuery: Schema.String,
  priorityFilter: PriorityFilter,
  composingLane: Schema.OptionFromNullOr(LaneId),
  quickTitle: Schema.String,
  editDraft: Schema.OptionFromNullOr(CardDraftSchema),
  notice: Schema.String,
  statusAnnouncement: Schema.String,
  appState: Schema.String,
  isBackgrounded: Schema.Boolean,
  backgroundTrips: Schema.Number,
  inspectorOpen: Schema.Boolean,
  traceEntries: Schema.Array(Schema.String),
  dispatchCount: Schema.Number,
  nextId: Schema.Number
})
export type FolioAppModel = typeof FolioAppModel.Type

export const FolioAppMessage = UiSchema.TaggedEnum({
  SelectedLane: { lane: LaneId },
  TypedSearchQuery: { text: Schema.String },
  SelectedPriorityFilter: { priority: PriorityFilter },
  SelectedDensity: { density: CardDensity },
  ClickedToggleTheme: {},
  ClickedToggleInspector: {},
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedStartAddCard: { lane: LaneId },
  TypedQuickTitle: { text: Schema.String },
  SubmittedQuickCard: {},
  CancelledQuickCard: {},
  ClickedMoveCard: { cardId: Schema.String, toLane: LaneId },
  ClickedDeleteCard: { cardId: Schema.String },
  ClickedOpenEditor: { cardId: Schema.String },
  TypedEditTitle: { text: Schema.String },
  TypedEditNotes: { text: Schema.String },
  TypedEditAssignee: { text: Schema.String },
  SelectedEditLane: { lane: LaneId },
  SelectedEditPriority: { priority: Priority },
  SelectedEditPoints: { points: Schema.Number },
  SubmittedEditCard: {},
  CancelledEditCard: {},
  ClickedResetDemo: {},
  DismissedNotice: {},
  ChangedAppState: { state: Schema.String }
})
export type FolioAppMessage = typeof FolioAppMessage.Type

const MAX_TRACE_ENTRIES = 16

const appendTrace = (
  entries: ReadonlyArray<string>,
  count: number,
  label: string
): ReadonlyArray<string> => [
  `#${count} ${label}`,
  ...entries.slice(0, MAX_TRACE_ENTRIES - 1)
]

export const FolioApp = Ui.component({
  name: "FolioApp",
  props: FolioAppProps,
  model: FolioAppModel,
  message: FolioAppMessage
}).make({
  init: ({ props }) => {
    const saved = Option.getOrUndefined(props.initialBoard)
    return {
      cards: saved?.cards ?? [...DEFAULT_CARDS],
      history: emptyHistory(),
      theme: saved?.theme ?? ("paper" as const),
      density: "comfortable" as const,
      activeLane: "in_progress" as const,
      searchQuery: "",
      priorityFilter: "all" as const,
      composingLane: Option.none(),
      quickTitle: "",
      editDraft: Option.none(),
      notice: "",
      statusAnnouncement: "",
      appState: "active",
      isBackgrounded: false,
      backgroundTrips: 0,
      inspectorOpen: false,
      traceEntries: [],
      dispatchCount: 0,
      nextId: 1
    }
  },

  head: ({ model, props }) => [
    Head.title(`Folio Kanban · ${props.platformLabel} (${model.cards.length} cards)`)
  ],

  subscriptions: () => [
    Subscription.make(
      "app-lifecycle",
      Stream.unwrap(
        Effect.map(AppLifecycle, (lifecycle) =>
          lifecycle.changes.pipe(
            Stream.map((state) => FolioAppMessage.ChangedAppState({ state }))
          )
        )
      )
    )
  ],

  update: {
    SelectedLane: ($, { lane }) => {
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        activeLane: lane,
        notice: "",
        statusAnnouncement: "",
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, `SelectedLane(${lane})`)
      })
    },

    TypedSearchQuery: ($, { text }) => {
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        searchQuery: text,
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, `TypedSearchQuery("${text}")`)
      })
    },

    SelectedPriorityFilter: ($, { priority }) => {
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        priorityFilter: priority,
        dispatchCount: nextCount,
        traceEntries: appendTrace(
          $.model.traceEntries,
          nextCount,
          `SelectedPriorityFilter(${priority})`
        )
      })
    },

    SelectedDensity: ($, { density }) => {
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        density,
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, `SelectedDensity(${density})`)
      }).viewTransition(["layout"])
    },

    ClickedToggleTheme: ($) => {
      const nextTheme = toggleTheme($.model.theme)
      const nextCount = $.model.dispatchCount + 1
      const message = `Switched theme to ${themeLabel(nextTheme)}.`
      return $.evolve({
        theme: nextTheme,
        notice: message,
        statusAnnouncement: message,
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, `ClickedToggleTheme(${nextTheme})`)
      }).run(SaveBoard.make({ cards: $.model.cards, theme: nextTheme }))
    },

    ClickedToggleInspector: ($) => {
      const nextOpen = !$.model.inspectorOpen
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        inspectorOpen: nextOpen,
        dispatchCount: nextCount,
        traceEntries: appendTrace(
          $.model.traceEntries,
          nextCount,
          `ClickedToggleInspector(${nextOpen ? "open" : "closed"})`
        )
      })
    },

    ClickedUndo: ($) => {
      const result = undoHistory($.model.history, $.model.cards)
      if (result === undefined) return $.model
      const nextCount = $.model.dispatchCount + 1
      const message = "Undid last change."
      return $.evolve({
        cards: result.cards,
        history: result.history,
        notice: message,
        statusAnnouncement: message,
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, "ClickedUndo")
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    ClickedRedo: ($) => {
      const result = redoHistory($.model.history, $.model.cards)
      if (result === undefined) return $.model
      const nextCount = $.model.dispatchCount + 1
      const message = "Redid change."
      return $.evolve({
        cards: result.cards,
        history: result.history,
        notice: message,
        statusAnnouncement: message,
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, "ClickedRedo")
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    ClickedStartAddCard: ($, { lane }) => {
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        composingLane: Option.some(lane),
        quickTitle: "",
        notice: "",
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, `ClickedStartAddCard(${lane})`)
      })
    },

    TypedQuickTitle: ($, { text }) =>
      $.evolve({ quickTitle: text }),

    SubmittedQuickCard: ($) => {
      const targetLane = Option.getOrElse($.model.composingLane, () => $.model.activeLane)
      const result = applyQuickCreate($.model, {
        title: $.model.quickTitle,
        lane: targetLane,
        id: `${$.props.platform}-card-${$.model.nextId}`,
        tag: $.props.platform
      })
      const nextCount = $.model.dispatchCount + 1
      if (!result.ok) {
        return $.evolve({
          notice: result.error,
          statusAnnouncement: result.error,
          dispatchCount: nextCount,
          traceEntries: appendTrace($.model.traceEntries, nextCount, "SubmittedQuickCard(invalid)")
        })
      }
      const message = `Added ${result.card.code} "${result.card.title}" to ${result.laneName}.`
      return $.evolve({
        cards: result.cards,
        history: result.history,
        composingLane: Option.none(),
        quickTitle: "",
        nextId: (n) => n + 1,
        notice: message,
        statusAnnouncement: message,
        dispatchCount: nextCount,
        traceEntries: appendTrace(
          $.model.traceEntries,
          nextCount,
          `SubmittedQuickCard(${result.card.code} -> ${targetLane})`
        )
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    CancelledQuickCard: ($) => {
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        composingLane: Option.none(),
        quickTitle: "",
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, "CancelledQuickCard")
      })
    },

    ClickedMoveCard: ($, { cardId, toLane }) => {
      const result = applyMoveCard($.model, cardId, toLane)
      if (result === undefined) return $.model
      const nextCount = $.model.dispatchCount + 1
      const announcement = formatTransferNotice({
        type: "drop",
        cardId,
        cardTitle: result.card.title,
        laneTitle: result.laneName,
        position: 1,
        total: result.totalInTargetLane
      })
      return $.evolve({
        cards: result.cards,
        history: result.history,
        notice: `Moved ${result.card.code} to ${result.laneName}.`,
        statusAnnouncement: announcement,
        dispatchCount: nextCount,
        traceEntries: appendTrace(
          $.model.traceEntries,
          nextCount,
          `ClickedMoveCard(${result.card.code} -> ${toLane})`
        )
      })
        .run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
        .viewTransition(["move-card"])
    },

    ClickedDeleteCard: ($, { cardId }) => {
      const result = applyDeleteCard($.model, cardId)
      if (result === undefined) return $.model
      const nextCount = $.model.dispatchCount + 1
      const message = `Deleted ${result.card.code}.`
      return $.evolve({
        cards: result.cards,
        history: result.history,
        editDraft: Option.none(),
        notice: message,
        statusAnnouncement: message,
        dispatchCount: nextCount,
        traceEntries: appendTrace(
          $.model.traceEntries,
          nextCount,
          `ClickedDeleteCard(${result.card.code})`
        )
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    ClickedOpenEditor: ($, { cardId }) => {
      const card = findCard($.model.cards, cardId)
      if (card === undefined) return $.model
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        editDraft: Option.some(cardToDraft(card)),
        notice: "",
        statusAnnouncement: "",
        dispatchCount: nextCount,
        traceEntries: appendTrace(
          $.model.traceEntries,
          nextCount,
          `ClickedOpenEditor(${card.code})`
        )
      })
    },

    TypedEditTitle: ($, { text }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, title: text }))
      }),

    TypedEditNotes: ($, { text }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, notes: text }))
      }),

    TypedEditAssignee: ($, { text }) =>
      $.evolve({
        editDraft: Option.map((d) => ({
          ...d,
          assignee: normalizeDraftAssignee(text)
        }))
      }),

    SelectedEditLane: ($, { lane }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, lane }))
      }),

    SelectedEditPriority: ($, { priority }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, priority }))
      }),

    SelectedEditPoints: ($, { points }) =>
      $.evolve({
        editDraft: Option.map((d) => ({ ...d, points }))
      }),

    SubmittedEditCard: ($) =>
      Option.match($.model.editDraft, {
        onNone: () => $.model,
        onSome: (draft) => {
          const result = applySaveDraft($.model, draft)
          const nextCount = $.model.dispatchCount + 1
          if (!result.ok) {
            return $.evolve({
              notice: result.error,
              statusAnnouncement: result.error,
              dispatchCount: nextCount,
              traceEntries: appendTrace($.model.traceEntries, nextCount, "SubmittedEditCard(invalid)")
            })
          }
          const message = `Saved ${result.card.code}.`
          return $.evolve({
            cards: result.cards,
            history: result.history,
            activeLane: draft.lane,
            editDraft: Option.none(),
            notice: message,
            statusAnnouncement: message,
            dispatchCount: nextCount,
            traceEntries: appendTrace(
              $.model.traceEntries,
              nextCount,
              `SubmittedEditCard(${result.card.code})`
            )
          }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
        }
      }),

    CancelledEditCard: ($) => {
      const nextCount = $.model.dispatchCount + 1
      return $.evolve({
        editDraft: Option.none(),
        notice: "",
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, "CancelledEditCard")
      })
    },

    ClickedResetDemo: ($) => {
      const result = applyResetBoard($.model)
      const nextCount = $.model.dispatchCount + 1
      const message = "Reset board to default cards."
      return $.evolve({
        cards: result.cards,
        history: result.history,
        activeLane: "in_progress" as const,
        searchQuery: "",
        priorityFilter: "all" as const,
        composingLane: Option.none(),
        quickTitle: "",
        editDraft: Option.none(),
        notice: message,
        statusAnnouncement: message,
        dispatchCount: nextCount,
        traceEntries: appendTrace($.model.traceEntries, nextCount, "ClickedResetDemo")
      }).run(SaveBoard.make({ cards: result.cards, theme: $.model.theme }))
    },

    DismissedNotice: ($) =>
      $.evolve({ notice: "", statusAnnouncement: "" }),

    ChangedAppState: ($, { state }) => {
      const enteredBackground = state === "background" && !$.model.isBackgrounded
      return $.evolve({
        appState: state,
        isBackgrounded: state === "background",
        backgroundTrips: enteredBackground
          ? $.model.backgroundTrips + 1
          : $.model.backgroundTrips
      })
    }
  },

  view: (h, model) => boardView(h, model)
})
