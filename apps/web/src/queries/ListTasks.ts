import { Task, TasksTag } from "#domain/Task"
import { TaskStore } from "#services/TaskStore"
import { Query } from "@effect/ui"
import { Effect, Schema } from "effect"

export class ListTasks extends Query.Service<ListTasks>()("folio/ListTasks", {
  success: Schema.Array(Task),
  staleTime: "30 seconds",
  tags: [TasksTag]
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return () => store.list
    })
  )
}
