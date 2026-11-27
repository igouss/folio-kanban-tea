import { Command, Head, Subscription, UiSchema, type Component } from "@effect/ui"
import { BoardRepository, loadInitialBoard } from "@folio/kanban-domain/ports"
import {
  CardIdSchema,
  CardTitleSchema,
  LaneId,
  Priority,
  PriorityFilter,
  SavedBoardSchema,
  StoryPoints
} from "@folio/kanban-domain/schema"
import {
  Lifecycle,
  LifecycleState,
  Ui,
  Viewport,
  ViewportMetricsSchema
} from "@universal-ui/core"
import { Effect, Schema, Stream } from "effect"
import {
  MintCardMeta,
  PositiveRequestIdSchema,
  SaveBoard
} from "../commands/index.ts"
import {
  CardDensity,
  KanbanStateSchema,
  initialState,
  reduce,
  selectBoardScreen,
  selectDocumentTitle,
  type KanbanAction,
  type KanbanState
} from "../state/index.ts"
import { boardView } from "./views/BoardView.ts"

export const FolioAppProps = Schema.Struct({
  runtimeTag: Schema.String,
  platformLabel: Schema.String,
  initialViewport: ViewportMetricsSchema,
  initialBoard: Schema.OptionFromUndefinedOr(SavedBoardSchema)
})
export type FolioAppProps = typeof FolioAppProps.Type

export interface FolioBootstrapConfig {
  readonly runtimeTag: string
  readonly platformLabel: string
}

/**
 * Loads initial FolioApp props from the platform-wired BoardRepository and Viewport ports.
 */
export const loadFolioProps = (
  config: FolioBootstrapConfig
): Effect.Effect<FolioAppProps, never, BoardRepository | Viewport> =>
  Effect.gen(function* () {
    const initialBoard = yield* loadInitialBoard
    const viewport = yield* Viewport
    const initialViewport = yield* viewport.current
    return {
      runtimeTag: config.runtimeTag,
      platformLabel: config.platformLabel,
      initialViewport,
      initialBoard
    }
  })

export const FolioAppMessage = UiSchema.TaggedEnum({
  SelectedLane: { lane: LaneId },
  TypedSearchQuery: { text: Schema.String },
  SelectedPriorityFilter: { priority: PriorityFilter },
  SelectedDensity: { density: CardDensity },
  ClickedToggleTheme: {},
  ClickedToggleInspector: {},
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedStartAddCard: { lane: LaneId },
  TypedQuickTitle: { text: Schema.String },
  SubmittedQuickCard: {},
  CompletedMintCard: {
    requestId: PositiveRequestIdSchema,
    id: CardIdSchema,
    createdAt: Schema.String,
    title: CardTitleSchema,
    lane: LaneId,
    tag: Schema.String
  },
  CancelledQuickCard: {},
  ClickedMoveCard: { cardId: CardIdSchema, toLane: LaneId },
  ClickedDeleteCard: { cardId: CardIdSchema },
  ClickedOpenEditor: { cardId: CardIdSchema },
  TypedEditTitle: { text: Schema.String },
  TypedEditNotes: { text: Schema.String },
  TypedEditAssignee: { text: Schema.String },
  SelectedEditLane: { lane: LaneId },
  SelectedEditPriority: { priority: Priority },
  SelectedEditPoints: { points: StoryPoints },
  SubmittedEditCard: {},
  CancelledEditCard: {},
  ClickedResetDemo: {},
  DismissedNotice: {},
  ChangedLifecycle: { state: LifecycleState },
  ChangedViewport: { viewport: ViewportMetricsSchema }
})
export type FolioAppMessage = typeof FolioAppMessage.Type

type AppStep = Component.Step<
  KanbanState,
  FolioAppMessage,
  never,
  SaveBoard | MintCardMeta
>

const runReducer = (
  $: Component.Step<KanbanState, FolioAppMessage, never, never> & {
    readonly model: KanbanState
    readonly props: FolioAppProps
  },
  action: KanbanAction
): AppStep => {
  const { state, effects } = reduce($.model, action, {
    runtimeTag: $.props.runtimeTag
  })
  let step: AppStep = $.set(state)
  for (const effect of effects) {
    switch (effect._tag) {
      case "PersistBoard":
        step = step.run(SaveBoard.make(effect.board))
        break
      case "MintCardMeta":
        step = step.run(
          MintCardMeta.make({
            requestId: effect.requestId,
            title: effect.title,
            lane: effect.lane,
            tag: effect.tag
          }).pipe(Command.map((meta) => FolioAppMessage.CompletedMintCard(meta)))
        )
        break
      case "ViewTransition":
        step = step.viewTransition(effect.names)
        break
      default: {
        const _exhaustive: never = effect
        return _exhaustive
      }
    }
  }
  return step
}

/**
 * Thin @effect/ui driving shell over the pure Kanban reducer.
 * Owns zero domain logic and passes only read-only selector projections to views.
 */
export const FolioApp = Ui.component({
  name: "FolioApp",
  props: FolioAppProps,
  model: KanbanStateSchema,
  message: FolioAppMessage
}).make({
  init: ({ props }) =>
    initialState({
      initialBoard: props.initialBoard,
      initialViewport: props.initialViewport
    }),

  head: ({ model, props }) => [
    Head.title(selectDocumentTitle(model, props.platformLabel))
  ],

  subscriptions: () => [
    Subscription.make(
      "app-lifecycle",
      Stream.unwrap(
        Effect.map(Lifecycle, (lifecycle) =>
          lifecycle.changes.pipe(
            Stream.map((state) => FolioAppMessage.ChangedLifecycle({ state }))
          )
        )
      )
    ),
    Subscription.make(
      "viewport",
      Stream.unwrap(
        Effect.map(Viewport, (viewport) =>
          viewport.changes.pipe(
            Stream.map((metrics) =>
              FolioAppMessage.ChangedViewport({ viewport: metrics })
            )
          )
        )
      )
    )
  ],

  update: {
    SelectedLane: runReducer,
    TypedSearchQuery: runReducer,
    SelectedPriorityFilter: runReducer,
    SelectedDensity: runReducer,
    ClickedToggleTheme: runReducer,
    ClickedToggleInspector: runReducer,
    ClickedUndo: runReducer,
    ClickedRedo: runReducer,
    ClickedStartAddCard: runReducer,
    TypedQuickTitle: runReducer,
    SubmittedQuickCard: runReducer,
    CompletedMintCard: runReducer,
    CancelledQuickCard: runReducer,
    ClickedMoveCard: runReducer,
    ClickedDeleteCard: runReducer,
    ClickedOpenEditor: runReducer,
    TypedEditTitle: runReducer,
    TypedEditNotes: runReducer,
    TypedEditAssignee: runReducer,
    SelectedEditLane: runReducer,
    SelectedEditPriority: runReducer,
    SelectedEditPoints: runReducer,
    SubmittedEditCard: runReducer,
    CancelledEditCard: runReducer,
    ClickedResetDemo: runReducer,
    DismissedNotice: runReducer,
    ChangedLifecycle: runReducer,
    ChangedViewport: runReducer
  },

  view: (h, model) => boardView(h, selectBoardScreen(model))
})
