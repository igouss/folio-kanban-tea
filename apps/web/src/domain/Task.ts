import {
  LANES,
  PRIORITY_OPTIONS,
  STORY_POINTS,
  adjacentLanes,
  laneTitle,
  priorityLabel
} from "@folio/kanban-core"
import {
  CardNotFound,
  CardSaveError,
  KanbanCardSchema,
  LaneId,
  NewCardInputSchema,
  Priority,
  PriorityFilter
} from "@folio/kanban-core/schema"
import { Query } from "@effect/ui"

export const ColumnId = LaneId
export type ColumnId = LaneId

export const TaskPriority = Priority
export type TaskPriority = Priority

export const Task = KanbanCardSchema
export type Task = KanbanCardSchema

export const NewTaskInput = NewCardInputSchema
export type NewTaskInput = NewCardInputSchema

export const TaskNotFound = CardNotFound
export type TaskNotFound = CardNotFound

export const TaskSaveError = CardSaveError
export type TaskSaveError = CardSaveError

export const TasksTag = Query.Tag("tasks")

export {
  LANES,
  PRIORITY_OPTIONS,
  PriorityFilter,
  STORY_POINTS,
  adjacentLanes as adjacentColumns,
  laneTitle as columnTitle,
  priorityLabel
}
