import { UiSchema } from "@effect/ui"
import {
  BoardHistorySchema,
  CardDraftSchema as EditDraft,
  KanbanCardSchema as Card,
  LaneId,
  Priority,
  PriorityFilter,
  ThemeMode
} from "@folio/kanban-core/schema"
import { Schema } from "effect"

export { Card, EditDraft, LaneId, Priority, PriorityFilter, ThemeMode }

export const Screen = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Board") }),
  Schema.Struct({ _tag: Schema.Literal("Detail"), draft: EditDraft })
])
export type Screen = typeof Screen.Type

export const KanbanMobileModel = Schema.Struct({
  cards: Schema.Array(Card),
  history: BoardHistorySchema,
  activeLane: LaneId,
  screen: Screen,
  searchQuery: Schema.String,
  priorityFilter: PriorityFilter,
  quickTitle: Schema.String,
  theme: ThemeMode,
  appState: Schema.String,
  isBackgrounded: Schema.Boolean,
  backgroundTrips: Schema.Number,
  statusBanner: Schema.String,
  statusAnnouncement: Schema.String,
  nextId: Schema.Number
})
export type KanbanMobileModel = typeof KanbanMobileModel.Type

export const KanbanMobileMessage = UiSchema.TaggedEnum({
  SelectedLane: { lane: LaneId },
  TypedSearchQuery: { text: Schema.String },
  SelectedPriorityFilter: { priority: PriorityFilter },
  TypedQuickTitle: { text: Schema.String },
  SubmittedQuickCard: {},
  PressedMoveCard: { cardId: Schema.String, toLane: LaneId },
  PressedDeleteCard: { cardId: Schema.String },
  PressedOpenCard: { cardId: Schema.String },
  PressedBackToBoard: {},
  TypedDraftTitle: { text: Schema.String },
  TypedDraftNotes: { text: Schema.String },
  TypedDraftAssignee: { text: Schema.String },
  SelectedDraftLane: { lane: LaneId },
  SelectedDraftPriority: { priority: Priority },
  SelectedDraftPoints: { points: Schema.Number },
  PressedSaveDraft: {},
  PressedUndo: {},
  PressedRedo: {},
  PressedToggleTheme: {},
  PressedResetDemo: {},
  DismissedBanner: {},
  ChangedAppState: { state: Schema.String }
})
export type KanbanMobileMessage = typeof KanbanMobileMessage.Type
