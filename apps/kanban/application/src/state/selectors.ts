import {
  canRedoHistory,
  canUndoHistory,
  type CardDraft,
  type KanbanCard,
  type LaneId,
  type PriorityFilter,
  type ThemeMode
} from "@folio/kanban-domain"
import type { LifecycleState, ViewportMetrics } from "@universal-ui/core"
import type { CardDensity, KanbanState } from "./state.ts"

export const COMPACT_BREAKPOINT_PX = 820

export type ScreenLayout = "columns" | "tabs"

export interface BoardScreenSnapshot {
  readonly layout: ScreenLayout
  readonly topInset: number
  readonly theme: ThemeMode
  readonly density: CardDensity
  readonly cards: ReadonlyArray<KanbanCard>
  readonly activeLane: LaneId
  readonly searchQuery: string
  readonly priorityFilter: PriorityFilter
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly undoDepth: number
  readonly redoDepth: number
  readonly composingLane: LaneId | undefined
  readonly quickTitle: string
  readonly editorDraft: CardDraft | undefined
  readonly notice: string
  readonly statusAnnouncement: string
  readonly lifecycleBadge: string
  readonly inspectorOpen: boolean
  readonly traceEntries: ReadonlyArray<string>
  readonly dispatchCount: number
}

export const selectCards = (state: KanbanState): ReadonlyArray<KanbanCard> =>
  state.board.cards

export const selectTheme = (state: KanbanState): ThemeMode =>
  state.board.theme

export const selectDensity = (state: KanbanState): CardDensity =>
  state.workspace.density

export const selectActiveLane = (state: KanbanState): LaneId =>
  state.workspace.activeLane

export const selectViewport = (state: KanbanState): ViewportMetrics =>
  state.shell.viewport

export const selectCanUndo = (state: KanbanState): boolean =>
  canUndoHistory(state.board.history)

export const selectCanRedo = (state: KanbanState): boolean =>
  canRedoHistory(state.board.history)

export const selectDispatchCount = (state: KanbanState): number =>
  state.shell.dispatchCount

export const selectInspectorOpen = (state: KanbanState): boolean =>
  state.shell.inspectorOpen

export const selectLifecycle = (state: KanbanState): LifecycleState =>
  state.shell.lifecycle

export const selectBackgroundTrips = (state: KanbanState): number =>
  state.shell.backgroundTrips

export const selectNotice = (state: KanbanState): string =>
  state.shell.notice

export const selectDocumentTitle = (
  state: KanbanState,
  platformLabel: string
): string =>
  `Folio Kanban · ${platformLabel} (${state.board.cards.length} cards)`

export const selectBoardScreen = (state: KanbanState): BoardScreenSnapshot => {
  const { board, workspace, shell } = state
  const layout: ScreenLayout =
    shell.viewport.width < COMPACT_BREAKPOINT_PX ? "tabs" : "columns"

  return {
    layout,
    topInset: shell.viewport.topInset,
    theme: board.theme,
    density: workspace.density,
    cards: board.cards,
    activeLane: workspace.activeLane,
    searchQuery: workspace.searchQuery,
    priorityFilter: workspace.priorityFilter,
    canUndo: canUndoHistory(board.history),
    canRedo: canRedoHistory(board.history),
    undoDepth: board.history.past.length,
    redoDepth: board.history.future.length,
    composingLane:
      workspace.composer._tag === "Open" ? workspace.composer.lane : undefined,
    quickTitle:
      workspace.composer._tag === "Open" ? workspace.composer.title : "",
    editorDraft:
      workspace.editor._tag === "Open" ? workspace.editor.draft : undefined,
    notice: shell.notice,
    statusAnnouncement: shell.statusAnnouncement,
    lifecycleBadge:
      shell.backgroundTrips > 0
        ? `@effect/ui · ${shell.lifecycle} (${shell.backgroundTrips})`
        : `@effect/ui · ${shell.lifecycle}`,
    inspectorOpen: shell.inspectorOpen,
    traceEntries: shell.traceEntries,
    dispatchCount: shell.dispatchCount
  }
}
