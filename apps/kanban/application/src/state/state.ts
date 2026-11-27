import { DEFAULT_CARDS, emptyHistory } from "@folio/kanban-domain"
import {
  BoardHistorySchema,
  CardDraftSchema,
  KanbanCardSchema,
  LaneId,
  PriorityFilter,
  SavedBoardSchema,
  ThemeMode
} from "@folio/kanban-domain/schema"
import {
  LifecycleState,
  ViewportMetricsSchema,
  type ViewportMetrics
} from "@universal-ui/core"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export const CardDensity = Schema.Literals(["comfortable", "compact"])
export type CardDensity = typeof CardDensity.Type

const WorkspaceIdleSchema = Schema.Struct({
  _tag: Schema.Literal("Idle")
})

const WorkspaceComposingSchema = Schema.Struct({
  _tag: Schema.Literal("Composing"),
  lane: LaneId,
  title: Schema.String
})

const WorkspaceSubmittingCardSchema = Schema.Struct({
  _tag: Schema.Literal("SubmittingCard"),
  lane: LaneId,
  title: Schema.String
})

const WorkspaceEditingCardSchema = Schema.Struct({
  _tag: Schema.Literal("EditingCard"),
  draft: CardDraftSchema
})

export const WorkspaceModeSchema = Schema.Union([
  WorkspaceIdleSchema,
  WorkspaceComposingSchema,
  WorkspaceSubmittingCardSchema,
  WorkspaceEditingCardSchema
])
export type WorkspaceMode = typeof WorkspaceModeSchema.Type

export const NoticeTone = Schema.Literals(["info", "error"])
export type NoticeTone = typeof NoticeTone.Type

const NoticeHiddenSchema = Schema.Struct({
  _tag: Schema.Literal("Hidden")
})

const NoticeVisibleSchema = Schema.Struct({
  _tag: Schema.Literal("Visible"),
  tone: NoticeTone,
  message: Schema.String,
  announcement: Schema.String
})

export const NoticeStateSchema = Schema.Union([
  NoticeHiddenSchema,
  NoticeVisibleSchema
])
export type NoticeState = typeof NoticeStateSchema.Type

export const BoardSliceSchema = Schema.Struct({
  cards: Schema.Array(KanbanCardSchema),
  history: BoardHistorySchema,
  theme: ThemeMode
})
export type BoardSlice = typeof BoardSliceSchema.Type

export const WorkspaceSliceSchema = Schema.Struct({
  activeLane: LaneId,
  searchQuery: Schema.String,
  priorityFilter: PriorityFilter,
  density: CardDensity,
  mode: WorkspaceModeSchema
})
export type WorkspaceSlice = typeof WorkspaceSliceSchema.Type

export const ShellSliceSchema = Schema.Struct({
  viewport: ViewportMetricsSchema,
  lifecycle: LifecycleState,
  backgroundTrips: Schema.Number,
  notice: NoticeStateSchema,
  inspectorOpen: Schema.Boolean,
  traceEntries: Schema.Array(Schema.String),
  dispatchCount: Schema.Number
})
export type ShellSlice = typeof ShellSliceSchema.Type

/**
 * Internal application state organized into cohesive slices.
 * Callers and views should NOT read these fields directly — use selectors
 * and drive all changes through `reduce(state, action, ctx)`.
 */
export const KanbanStateSchema = Schema.Struct({
  board: BoardSliceSchema,
  workspace: WorkspaceSliceSchema,
  shell: ShellSliceSchema
})
export type KanbanState = typeof KanbanStateSchema.Type

export interface InitialStateParams {
  readonly initialBoard: Option.Option<typeof SavedBoardSchema.Type>
  readonly initialViewport: ViewportMetrics
}

export const initialState = (params: InitialStateParams): KanbanState => {
  const saved = Option.getOrUndefined(params.initialBoard)
  return {
    board: {
      cards: saved?.cards ?? [...DEFAULT_CARDS],
      history: emptyHistory(),
      theme: saved?.theme ?? "paper"
    },
    workspace: {
      activeLane: "in_progress",
      searchQuery: "",
      priorityFilter: "all",
      density: "comfortable",
      mode: { _tag: "Idle" }
    },
    shell: {
      viewport: params.initialViewport,
      lifecycle: "active",
      backgroundTrips: 0,
      notice: { _tag: "Hidden" },
      inspectorOpen: false,
      traceEntries: [],
      dispatchCount: 0
    }
  }
}
