import { ColumnId } from "#domain/Task"
import { Route } from "@effect/ui"
import { Effect, Schema } from "effect"

export const PriorityFilter = Schema.Literals(["all", "high", "medium", "low"])
export type PriorityFilter = typeof PriorityFilter.Type

export const BoardDensity = Schema.Literals(["comfortable", "compact"])
export type BoardDensity = typeof BoardDensity.Type

export const AppRoute = Route.union({
  Board: Route.make("/", {
    search: {
      priority: PriorityFilter.pipe(
        Schema.withDecodingDefaultKey(Effect.succeed("all" as const))
      ),
      density: BoardDensity.pipe(
        Schema.withDecodingDefaultKey(Effect.succeed("comfortable" as const))
      ),
      q: Schema.optional(Schema.String)
    }
  }),
  NewTask: Route.make("/new", {
    search: {
      column: ColumnId.pipe(
        Schema.withDecodingDefaultKey(Effect.succeed("backlog" as const))
      )
    }
  }),
  TaskDetail: Route.make("/cards/:id", {
    params: { id: Schema.String }
  }),
  NotFound: Route.make("/*")
})
export type AppRoute = typeof AppRoute.Type
