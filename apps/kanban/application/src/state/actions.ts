import type { SavedBoard } from "@folio/kanban-domain"
import {
  CardDraftSchema,
  CardIdSchema,
  CardTitleSchema,
  LaneId,
  PriorityFilter
} from "@folio/kanban-domain/schema"
import { LifecycleState, ViewportMetricsSchema } from "@universal-ui/core"
import * as Schema from "effect/Schema"
import {
  CardDensity,
  PositiveRequestIdSchema,
  type KanbanState
} from "./state.ts"

/**
 * Single source of truth for all root Kanban actions/messages (pure Effect Schema,
 * zero @effect/ui dependency). `FolioAppMessage` derives its `UiSchema.TaggedEnum`
 * directly from this map.
 */
export const KanbanActionCases = {
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
  FailedMintCard: {
    requestId: PositiveRequestIdSchema,
    error: Schema.String
  },
  CancelledQuickCard: {},
  ClickedMoveCard: { cardId: CardIdSchema, toLane: LaneId },
  ClickedDeleteCard: { cardId: CardIdSchema },
  ClickedOpenEditor: { cardId: CardIdSchema },
  SavedEditedCard: { draft: CardDraftSchema, title: CardTitleSchema },
  CancelledEditCard: {},
  ClickedResetDemo: {},
  DismissedNotice: {},
  ChangedLifecycle: { state: LifecycleState },
  ChangedViewport: { viewport: ViewportMetricsSchema }
} as const satisfies Record<string, Schema.Struct.Fields>

export const KanbanActionSchema = Schema.TaggedUnion(KanbanActionCases)
export type KanbanAction = typeof KanbanActionSchema.Type

/**
 * Pure side-effect descriptors emitted by the reducer.
 * Interpreted by the driving shell (@effect/ui commands, view transitions, etc.).
 */
export type AppEffect =
  | { readonly _tag: "PersistBoard"; readonly board: SavedBoard }
  | {
      readonly _tag: "MintCardMeta"
      readonly requestId: number
      readonly title: typeof CardTitleSchema.Type
      readonly lane: typeof LaneId.Type
      readonly tag: string
    }
  | { readonly _tag: "ViewTransition"; readonly names: ReadonlyArray<string> }

export interface ReduceContext {
  readonly runtimeTag: string
}

export interface ReduceResult {
  readonly state: KanbanState
  readonly effects: ReadonlyArray<AppEffect>
}
