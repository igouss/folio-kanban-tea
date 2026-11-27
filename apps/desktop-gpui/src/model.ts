import { Schema } from 'effect'
import { DragAndDrop } from '@foldkit/ui'
import { Column, Priority, PriorityFilter, ThemeMode } from './domain.ts'

export const EditDraft = Schema.Struct({
  cardId: Schema.String,
  columnId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  priority: Priority,
  assignee: Schema.String,
  points: Schema.Number,
})
export type EditDraft = typeof EditDraft.Type

export const Model = Schema.Struct({
  columns: Schema.Array(Column),
  dragAndDrop: DragAndDrop.Model,
  theme: ThemeMode,
  searchQuery: Schema.String,
  priorityFilter: PriorityFilter,
  maybeNewCardColumnId: Schema.Option(Schema.String),
  newCardTitle: Schema.String,
  maybeEditDraft: Schema.Option(EditDraft),
  notice: Schema.String,
  announcement: Schema.String,
  dispatchCount: Schema.Number,
})
export type Model = typeof Model.Type
