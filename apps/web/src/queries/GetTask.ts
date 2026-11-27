import { Task, TaskNotFound, TasksTag } from "#domain/Task"
import { TaskStore } from "#services/TaskStore"
import { Query } from "@effect/ui"
import { Effect, Schema } from "effect"

export class GetTask extends Query.Service<GetTask>()("folio/GetTask", {
  args: { id: Schema.String },
  success: Task,
  error: TaskNotFound,
  staleTime: "30 seconds",
  tags: [TasksTag]
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return ({ id }) => store.get(id)
    })
  )
}
