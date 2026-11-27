import { ColumnId, TasksTag } from "#domain/Task"
import { TaskStore } from "#services/TaskStore"
import { Command, UiSchema } from "@effect/ui"
import { Effect, Schema } from "effect"
import { BoardDensity, PriorityFilter } from "../routes.ts"

export const BoardPageMessage = UiSchema.TaggedEnum({
  TypedSearch: { text: Schema.String },
  SelectedPriority: { priority: PriorityFilter },
  SelectedDensity: { density: BoardDensity },
  DraggedIntoColumn: { column: ColumnId },
  DraggedOutOfColumn: { column: ColumnId },
  DroppedCardInColumn: { id: Schema.String, column: ColumnId },
  RequestedMoveCard: { id: Schema.String, column: ColumnId },
  RequestedDeleteCard: { id: Schema.String },
  ClickedOpenComposer: { column: ColumnId },
  TypedComposerTitle: { text: Schema.String },
  SubmittedComposer: {},
  ClickedCancelComposer: {},
  ClickedResetBoard: {},
  SucceededMoveCard: { id: Schema.String, column: ColumnId },
  FailedMoveCard: { reason: Schema.String },
  SucceededQuickCreate: { title: Schema.String, column: ColumnId },
  FailedQuickCreate: { reason: Schema.String },
  SucceededDeleteCard: { id: Schema.String },
  FailedDeleteCard: { reason: Schema.String },
  SucceededResetBoard: {},
  DismissedNotice: {}
})

export class MoveCard extends Command.Service<MoveCard>()("folio/MoveCard", {
  args: { id: Schema.String, column: ColumnId },
  success: BoardPageMessage,
  mode: "queue",
  invalidates: () => [TasksTag]
}) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return ({ column, id }) =>
        store.move(id, column).pipe(
          Effect.match({
            onSuccess: (task) =>
              BoardPageMessage.SucceededMoveCard({
                id: task.id,
                column: task.lane
              }),
            onFailure: (error) =>
              BoardPageMessage.FailedMoveCard({
                reason: `Could not find card ${error.id}.`
              })
          })
        )
    })
  )
}

export class QuickCreateCard extends Command.Service<QuickCreateCard>()(
  "folio/QuickCreateCard",
  {
    args: { title: Schema.String, column: ColumnId },
    success: BoardPageMessage,
    mode: "queue",
    invalidates: () => [TasksTag]
  }
) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return ({ column, title }) =>
        store
          .create({
            title,
            notes: "",
            lane: column,
            priority: "medium",
            assignee: "ME",
            points: 2,
            tags: ["quick"]
          })
          .pipe(
            Effect.match({
              onSuccess: (task) =>
                BoardPageMessage.SucceededQuickCreate({
                  title: task.title,
                  column: task.lane
                }),
              onFailure: (error) =>
                BoardPageMessage.FailedQuickCreate({ reason: error.reason })
            })
          )
    })
  )
}

export class DeleteCard extends Command.Service<DeleteCard>()(
  "folio/DeleteCard",
  {
    args: { id: Schema.String },
    success: BoardPageMessage,
    mode: "queue",
    invalidates: () => [TasksTag]
  }
) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return ({ id }) =>
        store.remove(id).pipe(
          Effect.match({
            onSuccess: () => BoardPageMessage.SucceededDeleteCard({ id }),
            onFailure: (error) =>
              BoardPageMessage.FailedDeleteCard({
                reason: `Card ${error.id} was already removed.`
              })
          })
        )
    })
  )
}

export class ResetBoard extends Command.Service<ResetBoard>()(
  "folio/ResetBoard",
  {
    success: BoardPageMessage,
    invalidates: () => [TasksTag]
  }
) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const store = yield* TaskStore
      return () =>
        store.resetSeed.pipe(
          Effect.as(BoardPageMessage.SucceededResetBoard())
        )
    })
  )
}
