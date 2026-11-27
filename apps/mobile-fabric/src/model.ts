import { Schema } from 'effect'
import { Card, LaneId, Priority, PriorityFilter, ThemeMode } from './domain'

export const EditDraft = Schema.Struct({
  cardId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  lane: LaneId,
  priority: Priority,
  assignee: Schema.String,
  points: Schema.Number,
})
export type EditDraft = typeof EditDraft.Type

export const Screen = Schema.Union([
  Schema.TaggedStruct('Board', {}),
  Schema.TaggedStruct('Detail', { draft: EditDraft }),
])
export type Screen = typeof Screen.Type

export const Model = Schema.Struct({
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
  nextId: Schema.Number,
})
export type Model = typeof Model.Type
