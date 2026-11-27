import { Command, Component, Head, Subscription, UiSchema } from "@effect/ui"
import { BoardRepository, loadInitialBoard } from "@folio/kanban-domain/ports"
import { SavedBoardSchema } from "@folio/kanban-domain/schema"
import {
  Lifecycle,
  Ui,
  Viewport,
  ViewportMetricsSchema
} from "@universal-ui/core"
import { Effect, Schema, Stream } from "effect"
import {
  MintCardMeta,
  SaveBoard,
  kanbanCommandsLayer
} from "../commands/index.ts"
import {
  KanbanActionCases,
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

export const FolioAppMessage = UiSchema.TaggedEnum(KanbanActionCases)
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
          }).pipe(
            Command.match({
              onSuccess: (meta) => FolioAppMessage.CompletedMintCard(meta),
              onFailure: (error) =>
                FolioAppMessage.FailedMintCard({
                  requestId: effect.requestId,
                  error
                })
            })
          )
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
 * Unwired @effect/ui root shell whose command requirements (`SaveBoard | MintCardMeta`)
 * stay open for `Story.make` unit tests.
 */
export const FolioAppBase = Ui.component({
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

  update: ($, message) => runReducer($, message),

  view: (h, model) => boardView(h, selectBoardScreen(model))
})

/**
 * Production @effect/ui shell with internal application commands (`kanbanCommandsLayer`)
 * already provided via `Component.provide`. Delivery targets only wire true platform
 * ports (`BoardRepository`, `IdGenerator`, `Lifecycle`, `Viewport`, `InspectorFeature`).
 */
export const FolioApp = FolioAppBase.pipe(
  Component.provide(kanbanCommandsLayer)
)
