import { UiSchema } from "@effect/ui"
import {
  KanbanCardSchema as Card,
  LaneId,
  Priority,
  PriorityFilter,
  ThemeMode
} from "@folio/kanban-core/schema"
import { Schema } from "effect"

export { Card, LaneId, Priority, PriorityFilter, ThemeMode }

export const EditDraft = Schema.Struct({
  cardId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  lane: LaneId,
  priority: Priority,
  assignee: Schema.String,
  points: Schema.Number
})
export type EditDraft = typeof EditDraft.Type

export const Screen = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Board") }),
  Schema.Struct({ _tag: Schema.Literal("Detail"), draft: EditDraft })
])
export type Screen = typeof Screen.Type

export const KanbanMobileModel = Schema.Struct({
  cards: Schema.Array(Card),
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
  canUndo: Schema.Boolean,
  canRedo: Schema.Boolean,
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
