import {
  LANE_IDS,
  LANES,
  PRIORITIES,
  adjacentLanes,
  laneTitle,
  priorityLabel,
} from "@folio/kanban-core"
import { Query } from "@effect/ui"
import { Schema } from "effect"

export const ColumnId = Schema.Literals(LANE_IDS)
export type ColumnId = typeof ColumnId.Type

export const COLUMNS = LANES.map((lane) => ({
  id: lane.id,
  title: lane.title,
  code: lane.code,
  ...(lane.wipLimit !== null ? { wipLimit: lane.wipLimit } : {})
}))

export const TaskPriority = Schema.Literals(PRIORITIES)
export type TaskPriority = typeof TaskPriority.Type

export const Task = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  column: ColumnId,
  priority: TaskPriority,
  assignee: Schema.String,
  points: Schema.Number,
  tags: Schema.Array(Schema.String),
  createdAt: Schema.String
})
export type Task = typeof Task.Type

export const NewTaskInput = Schema.Struct({
  title: Schema.String,
  notes: Schema.String,
  column: ColumnId,
  priority: TaskPriority,
  assignee: Schema.String,
  points: Schema.Number,
  tags: Schema.Array(Schema.String)
})
export type NewTaskInput = typeof NewTaskInput.Type

export class TaskNotFound
  extends Schema.TaggedError<TaskNotFound>()("TaskNotFound", {
    id: Schema.String
  })
{}

export class TaskSaveError
  extends Schema.TaggedError<TaskSaveError>()("TaskSaveError", {
    reason: Schema.String
  })
{}

export const TasksTag = Query.Tag("tasks")

export const columnTitle = laneTitle
export const adjacentColumns = adjacentLanes
export { priorityLabel }
