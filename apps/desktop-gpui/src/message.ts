import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { DragAndDrop } from '@foldkit/ui'
import { Priority, PriorityFilter } from './domain.ts'

export const Message = defineMessageUnion({
  GotDragAndDropMessage: { message: DragAndDrop.Message },
  ChangedSearchQuery: { value: Schema.String },
  SelectedPriorityFilter: { priority: PriorityFilter },
  ClickedToggleTheme: {},
  AppliedTheme: {},
  ClickedAddCard: { columnId: Schema.String },
  ChangedNewCardTitle: { value: Schema.String },
  SubmittedNewCard: {},
  CancelledNewCard: {},
  CompletedGenerateCardId: {
    cardId: Schema.String,
    columnId: Schema.String,
    title: Schema.String,
  },
  ClickedMoveCard: {
    cardId: Schema.String,
    fromColumnId: Schema.String,
    toColumnId: Schema.String,
  },
  ClickedDeleteCard: {
    cardId: Schema.String,
    columnId: Schema.String,
  },
  ClickedOpenEditor: { cardId: Schema.String },
  ChangedEditTitle: { value: Schema.String },
  ChangedEditNotes: { value: Schema.String },
  ChangedEditPriority: { priority: Priority },
  ChangedEditColumn: { columnId: Schema.String },
  ChangedEditAssignee: { value: Schema.String },
  ChangedEditPoints: { points: Schema.Number },
  SubmittedEditCard: {},
  CancelledEditCard: {},
  ClickedResetDemo: {},
  DismissedNotice: {},
  CompletedSaveBoard: {},
  CompletedFocusAddCardInput: {},
})
export type Message = typeof Message.Type
