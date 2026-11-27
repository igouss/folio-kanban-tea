import { Fabric } from "@folio/effect-ui-fabric"
import { appStateSubscription } from "@folio/effect-ui-fabric/subscription"
import {
  DEFAULT_CARDS,
  createCard,
  deleteCard,
  laneTitle as laneLabel,
  moveCard,
  nextCardCode as nextCode,
  updateCard
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
    nextId: 1
  }),

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
      return $.evolve({
        cards: created.cards,
        quickTitle: "",
        nextId: (n) => n + 1,
        statusBanner: `Added ${code} to ${laneLabel($.model.activeLane)}.`
      })
    },

    PressedMoveCard: ($, { cardId, toLane }) => {
      const card = $.model.cards.find((c) => c.id === cardId)
      if (!card) return $.model
      return $.evolve({
        cards: moveCard($.model.cards, cardId, toLane),
        statusBanner: `Moved ${card.code} to ${laneLabel(toLane)}.`
      })
    },

    PressedDeleteCard: ($, { cardId }) => {
      const card = $.model.cards.find((c) => c.id === cardId)
      if (!card) return $.model
      return $.evolve({
        cards: deleteCard($.model.cards, cardId),
        screen: { _tag: "Board" as const },
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
      return $.evolve({
        cards: updateCard($.model.cards, draft.cardId, {
          title,
          notes: draft.notes.trim(),
          lane: draft.lane,
          priority: draft.priority,
          assignee: draft.assignee.trim() || "ME",
          points: draft.points
        }),
        activeLane: draft.lane,
        screen: { _tag: "Board" as const },
        statusBanner: `Saved ${draft.code}.`
      })
    },

    PressedToggleTheme: ($) => {
      const next = $.model.theme === "paper" ? ("graphite" as const) : ("paper" as const)
      return $.evolve({
        theme: next,
        statusBanner: `Switched to ${next === "paper" ? "Paper (Light)" : "Graphite (Dark)"} theme.`
      })
    },

    PressedResetDemo: ($) =>
      $.evolve({
        cards: [...DEFAULT_CARDS],
        activeLane: "in_progress" as const,
        screen: { _tag: "Board" as const },
        searchQuery: "",
        priorityFilter: "all" as const,
        quickTitle: "",
        statusBanner: "Reset board to default cards."
      }),

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
