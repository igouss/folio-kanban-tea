import { Fabric } from "@folio/effect-ui-fabric"
import { appStateSubscription } from "@folio/effect-ui-fabric/subscription"
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
  type EditDraft,
  KanbanMobileMessage,
  KanbanMobileModel,
  type Screen
} from "../domain/schema"
import { view } from "../views/BoardView"

export {
  EditDraft,
  KanbanMobileMessage,
  KanbanMobileModel,
  Screen
} from "../domain/schema"

const mapDraft = (
  screen: Screen,
  f: (draft: EditDraft) => EditDraft
): Screen =>
  screen._tag === "Detail"
    ? { _tag: "Detail", draft: f(screen.draft) }
    : screen

export const KanbanMobile = Fabric.component({
  name: "KanbanMobile",
  model: KanbanMobileModel,
  message: KanbanMobileMessage
}).make({
  init: () => ({
    cards: [...DEFAULT_CARDS],
    history: emptyHistory(),
    activeLane: "in_progress" as const,
    screen: { _tag: "Board" as const },
    searchQuery: "",
    priorityFilter: "all" as const,
    quickTitle: "",
    theme: "paper" as const,
    appState: "active",
    isBackgrounded: false,
    backgroundTrips: 0,
    statusBanner: "",
    statusAnnouncement: "",
    nextId: 1
  }),

  subscriptions: () => [
    appStateSubscription((state) =>
      KanbanMobileMessage.ChangedAppState({ state })
    )
  ],

  update: {
    SelectedLane: ($, { lane }) =>
      $.evolve({ activeLane: lane, statusBanner: "", statusAnnouncement: "" }),

    TypedSearchQuery: ($, { text }) => $.evolve({ searchQuery: text }),

    SelectedPriorityFilter: ($, { priority }) =>
      $.evolve({ priorityFilter: priority }),

    TypedQuickTitle: ($, { text }) => $.evolve({ quickTitle: text }),

    SubmittedQuickCard: ($) => {
      const result = applyQuickCreate($.model, {
        title: $.model.quickTitle,
        lane: $.model.activeLane,
        id: `mobile-card-${$.model.nextId}`,
        tag: "fabric"
      })
      if (!result.ok) {
        return $.evolve({
          statusBanner: result.error,
          statusAnnouncement: result.error
        })
      }
      const message = `Added ${result.card.code} to ${result.laneName}.`
      return $.evolve({
        cards: result.cards,
        history: result.history,
        quickTitle: "",
        nextId: (n) => n + 1,
        statusBanner: message,
        statusAnnouncement: message
      })
    },

    PressedMoveCard: ($, { cardId, toLane }) => {
      const result = applyMoveCard($.model, cardId, toLane)
      if (result === undefined) return $.model
      return $.evolve({
        cards: result.cards,
        history: result.history,
        statusBanner: `Moved ${result.card.code} to ${result.laneName}.`,
        statusAnnouncement: formatTransferNotice({
          type: "drop",
          cardId,
          cardTitle: result.card.title,
          laneTitle: result.laneName,
          position: 1,
          total: result.totalInTargetLane
        })
      })
    },

    PressedDeleteCard: ($, { cardId }) => {
      const result = applyDeleteCard($.model, cardId)
      if (result === undefined) return $.model
      const message = `Deleted ${result.card.code}.`
      return $.evolve({
        cards: result.cards,
        history: result.history,
        screen: { _tag: "Board" as const },
        statusBanner: message,
        statusAnnouncement: message
      })
    },

    PressedOpenCard: ($, { cardId }) => {
      const card = findCard($.model.cards, cardId)
      if (card === undefined) return $.model
      return $.evolve({
        screen: {
          _tag: "Detail" as const,
          draft: cardToDraft(card)
        },
        statusBanner: "",
        statusAnnouncement: ""
      })
    },

    PressedBackToBoard: ($) =>
      $.evolve({ screen: { _tag: "Board" as const } }),

    TypedDraftTitle: ($, { text }) =>
      $.evolve({ screen: (s) => mapDraft(s, (d) => ({ ...d, title: text })) }),

    TypedDraftNotes: ($, { text }) =>
      $.evolve({ screen: (s) => mapDraft(s, (d) => ({ ...d, notes: text })) }),

    TypedDraftAssignee: ($, { text }) =>
      $.evolve({
        screen: (s) =>
          mapDraft(s, (d) => ({
            ...d,
            assignee: normalizeDraftAssignee(text)
          }))
      }),

    SelectedDraftLane: ($, { lane }) =>
      $.evolve({ screen: (s) => mapDraft(s, (d) => ({ ...d, lane })) }),

    SelectedDraftPriority: ($, { priority }) =>
      $.evolve({ screen: (s) => mapDraft(s, (d) => ({ ...d, priority })) }),

    SelectedDraftPoints: ($, { points }) =>
      $.evolve({ screen: (s) => mapDraft(s, (d) => ({ ...d, points })) }),

    PressedSaveDraft: ($) => {
      if ($.model.screen._tag !== "Detail") return $.model
      const draft = $.model.screen.draft
      const result = applySaveDraft($.model, draft)
      if (!result.ok) {
        return $.evolve({
          statusBanner: result.error,
          statusAnnouncement: result.error
        })
      }
      const message = `Saved ${result.card.code}.`
      return $.evolve({
        cards: result.cards,
        history: result.history,
        activeLane: draft.lane,
        screen: { _tag: "Board" as const },
        statusBanner: message,
        statusAnnouncement: message
      })
    },

    PressedUndo: ($) => {
      const result = undoHistory($.model.history, $.model.cards)
      if (result === undefined) return $.model
      return $.evolve({
        cards: result.cards,
        history: result.history,
        statusBanner: "Undid last change.",
        statusAnnouncement: "Undid last change."
      })
    },

    PressedRedo: ($) => {
      const result = redoHistory($.model.history, $.model.cards)
      if (result === undefined) return $.model
      return $.evolve({
        cards: result.cards,
        history: result.history,
        statusBanner: "Redid change.",
        statusAnnouncement: "Redid change."
      })
    },

    PressedToggleTheme: ($) => {
      const next = toggleTheme($.model.theme)
      const message = `Switched to ${themeLabel(next)} theme.`
      return $.evolve({
        theme: next,
        statusBanner: message,
        statusAnnouncement: message
      })
    },

    PressedResetDemo: ($) => {
      const result = applyResetBoard($.model)
      return $.evolve({
        cards: result.cards,
        history: result.history,
        activeLane: "in_progress" as const,
        screen: { _tag: "Board" as const },
        searchQuery: "",
        priorityFilter: "all" as const,
        quickTitle: "",
        statusBanner: "Reset board to default cards.",
        statusAnnouncement: "Reset board to default cards."
      })
    },

    DismissedBanner: ($) =>
      $.evolve({ statusBanner: "", statusAnnouncement: "" }),

    ChangedAppState: ($, { state }) => {
      const enteredBackground =
        state === "background" && !$.model.isBackgrounded
      return $.evolve({
        appState: state,
        isBackgrounded: state === "background",
        backgroundTrips: enteredBackground
          ? $.model.backgroundTrips + 1
          : $.model.backgroundTrips
      })
    }
  },

  view: (h, model) => view(h, model)
})
