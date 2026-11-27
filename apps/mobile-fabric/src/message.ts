import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { LaneId, Priority, PriorityFilter } from './domain'

export const Message = defineMessageUnion({
  SelectedLane: { lane: LaneId },
  ChangedSearchQuery: { text: Schema.String },
  SelectedPriorityFilter: { priority: PriorityFilter },
  ChangedQuickTitle: { text: Schema.String },
  SubmittedQuickCard: {},
  PressedMoveCard: { cardId: Schema.String, toLane: LaneId },
  PressedDeleteCard: { cardId: Schema.String },
  PressedOpenCard: { cardId: Schema.String },
  PressedBackToBoard: {},
  ChangedDraftTitle: { text: Schema.String },
  ChangedDraftNotes: { text: Schema.String },
  SelectedDraftLane: { lane: LaneId },
  SelectedDraftPriority: { priority: Priority },
  ChangedDraftAssignee: { text: Schema.String },
  SelectedDraftPoints: { points: Schema.Number },
  PressedSaveDraft: {},
  PressedToggleTheme: {},
  PressedResetDemo: {},
  DismissedBanner: {},
  ChangedAppState: { state: Schema.String },
})
export type Message = typeof Message.Type
