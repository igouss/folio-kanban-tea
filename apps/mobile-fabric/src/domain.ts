import {
  DEFAULT_CARDS as CORE_DEFAULT_CARDS,
  LANE_IDS,
  LANES as CORE_LANES,
  PRIORITIES,
  PRIORITY_FILTERS,
  THEME_MODES,
  adjacentLanes,
  boardVelocity,
  createCard,
  deleteCard,
  laneStats,
  laneTitle,
  matchesCard,
  moveCard,
  nextCardCode,
  updateCard,
} from '@folio/kanban-core'
import { Schema } from 'effect'

export const LaneId = Schema.Literals(LANE_IDS)
export type LaneId = typeof LaneId.Type

export const Priority = Schema.Literals(PRIORITIES)
export type Priority = typeof Priority.Type

export const PriorityFilter = Schema.Literals(PRIORITY_FILTERS)
export type PriorityFilter = typeof PriorityFilter.Type

export const ThemeMode = Schema.Literals(THEME_MODES)
export type ThemeMode = typeof ThemeMode.Type

export const Card = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  lane: LaneId,
  priority: Priority,
  assignee: Schema.String,
  points: Schema.Number,
  tags: Schema.Array(Schema.String),
  createdAt: Schema.String,
})
export type Card = typeof Card.Type

export const LANES = CORE_LANES.map((lane) => ({
  id: lane.id,
  label: lane.title,
  shortLabel: lane.shortTitle,
  wipLimit: lane.wipLimit,
}))

export const DEFAULT_CARDS: ReadonlyArray<Card> = CORE_DEFAULT_CARDS

export const laneLabel = laneTitle
export const nextCode = nextCardCode
export {
  adjacentLanes,
  boardVelocity,
  createCard,
  deleteCard,
  laneStats,
  matchesCard,
  moveCard,
  updateCard,
}
