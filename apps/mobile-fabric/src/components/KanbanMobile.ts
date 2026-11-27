import { Fabric } from "@folio/effect-ui-fabric"
import { appStateSubscription } from "@folio/effect-ui-fabric/subscription"
import { createBoardHistory } from "@folio/effect-ui-sdk"
import {
  DEFAULT_CARDS,
  createCard,
  deleteCard,
  laneTitle as laneLabel,
  moveCard,
  nextCardCode as nextCode,
  updateCard,
  type KanbanCard
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

const mobileHistory = createBoardHistory<ReadonlyArray<KanbanCard>>(
  [...DEFAULT_CARDS],
  { limit: 50 }
)

export const KanbanMobile = Fabric.component({
  name: "KanbanMobile",
  model: KanbanMobileModel,
  message: KanbanMobileMessage
}).make({
  init: () => {
    const initialCards = [...DEFAULT_CARDS]
    mobileHistory.reset(initialCards)
    return {
      cards: initialCards,
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
      canUndo: false,
      canRedo: false,
      nextId: 1
    }
  },

  subscriptions: () => [
    appStateSubscription((state) =>
      KanbanMobileMessage.ChangedAppState({ state })
    )
  ],

  update: {
    SelectedLane: ($, { lane }) =>
      $.evolve({ activeLane: lane, statusBanner: "" }),

    TypedSearchQuery: ($, { text }) => $.evolve({ searchQuery: text }),

    SelectedPriorityFilter: ($, { priority }) =>
      $.evolve({ priorityFilter: priority }),

    TypedQuickTitle: ($, { text }) => $.evolve({ quickTitle: text }),

    SubmittedQuickCard: ($) => {
      const title = $.model.quickTitle.trim()
      if (title.length < 2) {
        return $.evolve({ statusBanner: "Title must be at least 2 characters." })
      }
      const code = nextCode($.model.cards)
      const created = createCard(
        $.model.cards,
        {
          title,
          notes: "",
          lane: $.model.activeLane,
          priority: "medium",
          assignee: "ME",
          points: 2,
          tags: ["fabric"]
        },
        {
          id: `mobile-card-${$.model.nextId}`,
          createdAt: "2026-11-26T00:00:00.000Z"
        }
      )
      mobileHistory.record(created.cards)
      return $.evolve({
        cards: created.cards,
        quickTitle: "",
        nextId: (n) => n + 1,
        canUndo: mobileHistory.canUndo(),
        canRedo: mobileHistory.canRedo(),
        statusBanner: `Added ${code} to ${laneLabel($.model.activeLane)}.`
      })
    },

    PressedMoveCard: ($, { cardId, toLane }) => {
      const card = $.model.cards.find((c) => c.id === cardId)
      if (!card) return $.model
      const nextCards = moveCard($.model.cards, cardId, toLane)
      mobileHistory.record(nextCards)
      return $.evolve({
        cards: nextCards,
        canUndo: mobileHistory.canUndo(),
        canRedo: mobileHistory.canRedo(),
        statusBanner: `Moved ${card.code} to ${laneLabel(toLane)}.`
      })
    },

    PressedDeleteCard: ($, { cardId }) => {
      const card = $.model.cards.find((c) => c.id === cardId)
      if (!card) return $.model
      const nextCards = deleteCard($.model.cards, cardId)
      mobileHistory.record(nextCards)
      return $.evolve({
        cards: nextCards,
        screen: { _tag: "Board" as const },
        canUndo: mobileHistory.canUndo(),
        canRedo: mobileHistory.canRedo(),
        statusBanner: `Deleted ${card.code}.`
      })
    },

    PressedOpenCard: ($, { cardId }) => {
      const card = $.model.cards.find((c) => c.id === cardId)
      if (!card) return $.model
      return $.evolve({
        screen: {
          _tag: "Detail" as const,
          draft: {
            cardId: card.id,
            code: card.code,
            title: card.title,
            notes: card.notes,
            lane: card.lane,
            priority: card.priority,
            assignee: card.assignee,
            points: card.points
          }
        },
        statusBanner: ""
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
            assignee: text.toUpperCase().slice(0, 3)
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
      const title = draft.title.trim()
      if (title.length < 2) {
        return $.evolve({ statusBanner: "Title must be at least 2 characters." })
      }
      const nextCards = updateCard($.model.cards, draft.cardId, {
        title,
        notes: draft.notes.trim(),
        lane: draft.lane,
        priority: draft.priority,
        assignee: draft.assignee.trim() || "ME",
        points: draft.points
      })
      mobileHistory.record(nextCards)
      return $.evolve({
        cards: nextCards,
        activeLane: draft.lane,
        screen: { _tag: "Board" as const },
        canUndo: mobileHistory.canUndo(),
        canRedo: mobileHistory.canRedo(),
        statusBanner: `Saved ${draft.code}.`
      })
    },

    PressedUndo: ($) => {
      const prev = mobileHistory.undo()
      if (prev === undefined) return $.model
      return $.evolve({
        cards: prev,
        canUndo: mobileHistory.canUndo(),
        canRedo: mobileHistory.canRedo(),
        statusBanner: "Undid last change."
      })
    },

    PressedRedo: ($) => {
      const next = mobileHistory.redo()
      if (next === undefined) return $.model
      return $.evolve({
        cards: next,
        canUndo: mobileHistory.canUndo(),
        canRedo: mobileHistory.canRedo(),
        statusBanner: "Redid change."
      })
    },

    PressedToggleTheme: ($) => {
      const next = $.model.theme === "paper" ? ("graphite" as const) : ("paper" as const)
      return $.evolve({
        theme: next,
        statusBanner: `Switched to ${next === "paper" ? "Paper (Light)" : "Graphite (Dark)"} theme.`
      })
    },

    PressedResetDemo: ($) => {
      const nextCards = [...DEFAULT_CARDS]
      mobileHistory.record(nextCards)
      return $.evolve({
        cards: nextCards,
        activeLane: "in_progress" as const,
        screen: { _tag: "Board" as const },
        searchQuery: "",
        priorityFilter: "all" as const,
        quickTitle: "",
        canUndo: mobileHistory.canUndo(),
        canRedo: mobileHistory.canRedo(),
        statusBanner: "Reset board to default cards."
      })
    },

    DismissedBanner: ($) => $.evolve({ statusBanner: "" }),

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
