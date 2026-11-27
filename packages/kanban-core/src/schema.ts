import { Schema } from "effect"
import { LANE_IDS, PRIORITIES, PRIORITY_FILTERS, THEME_MODES } from "./types.ts"

export const LaneId = Schema.Literals(LANE_IDS)
export type LaneId = typeof LaneId.Type

export const Priority = Schema.Literals(PRIORITIES)
export type Priority = typeof Priority.Type

export const PriorityFilter = Schema.Literals(PRIORITY_FILTERS)
export type PriorityFilter = typeof PriorityFilter.Type

export const ThemeMode = Schema.Literals(THEME_MODES)
export type ThemeMode = typeof ThemeMode.Type

export const KanbanCardSchema = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  lane: LaneId,
  priority: Priority,
  assignee: Schema.String,
  points: Schema.Number,
  tags: Schema.Array(Schema.String),
  createdAt: Schema.String
})
export type KanbanCardSchema = typeof KanbanCardSchema.Type
