import type {
  LaneId,
  Priority,
  PriorityFilter,
  SavedBoard
} from "@folio/kanban-domain"
import type { LifecycleState, ViewportMetrics } from "@universal-ui/core"
import type { CardDensity, KanbanState } from "./state.ts"

export type KanbanAction =
  | { readonly _tag: "SelectedLane"; readonly lane: LaneId }
  | { readonly _tag: "TypedSearchQuery"; readonly text: string }
  | { readonly _tag: "SelectedPriorityFilter"; readonly priority: PriorityFilter }
  | { readonly _tag: "SelectedDensity"; readonly density: CardDensity }
  | { readonly _tag: "ClickedToggleTheme" }
  | { readonly _tag: "ClickedToggleInspector" }
  | { readonly _tag: "ClickedUndo" }
  | { readonly _tag: "ClickedRedo" }
  | { readonly _tag: "ClickedStartAddCard"; readonly lane: LaneId }
  | { readonly _tag: "TypedQuickTitle"; readonly text: string }
  | { readonly _tag: "SubmittedQuickCard" }
  | {
      readonly _tag: "CompletedMintCard"
      readonly id: string
      readonly createdAt: string
      readonly title: string
      readonly lane: LaneId
      readonly tag: string
    }
  | { readonly _tag: "CancelledQuickCard" }
  | { readonly _tag: "ClickedMoveCard"; readonly cardId: string; readonly toLane: LaneId }
  | { readonly _tag: "ClickedDeleteCard"; readonly cardId: string }
  | { readonly _tag: "ClickedOpenEditor"; readonly cardId: string }
  | { readonly _tag: "TypedEditTitle"; readonly text: string }
  | { readonly _tag: "TypedEditNotes"; readonly text: string }
  | { readonly _tag: "TypedEditAssignee"; readonly text: string }
  | { readonly _tag: "SelectedEditLane"; readonly lane: LaneId }
  | { readonly _tag: "SelectedEditPriority"; readonly priority: Priority }
  | { readonly _tag: "SelectedEditPoints"; readonly points: number }
  | { readonly _tag: "SubmittedEditCard" }
  | { readonly _tag: "CancelledEditCard" }
  | { readonly _tag: "ClickedResetDemo" }
  | { readonly _tag: "DismissedNotice" }
  | { readonly _tag: "ChangedLifecycle"; readonly state: LifecycleState }
  | { readonly _tag: "ChangedViewport"; readonly viewport: ViewportMetrics }

/**
 * Pure side-effect descriptors emitted by the reducer.
 * Interpreted by the driving shell (@effect/ui commands, view transitions, etc.).
 */
export type AppEffect =
  | { readonly _tag: "PersistBoard"; readonly board: SavedBoard }
  | {
      readonly _tag: "MintCardMeta"
      readonly title: string
      readonly lane: LaneId
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
