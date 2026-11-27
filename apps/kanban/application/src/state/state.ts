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

const ComposerClosedSchema = Schema.Struct({
  _tag: Schema.Literal("Closed")
})

const ComposerOpenSchema = Schema.Struct({
  _tag: Schema.Literal("Open"),
  lane: LaneId,
  title: Schema.String
})

export const ComposerStateSchema = Schema.Union([
  ComposerClosedSchema,
  ComposerOpenSchema
])
export type ComposerState = typeof ComposerStateSchema.Type

const EditorClosedSchema = Schema.Struct({
  _tag: Schema.Literal("Closed")
})

const EditorOpenSchema = Schema.Struct({
  _tag: Schema.Literal("Open"),
  draft: CardDraftSchema
})

export const EditorStateSchema = Schema.Union([
  EditorClosedSchema,
  EditorOpenSchema
])
export type EditorState = typeof EditorStateSchema.Type

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
  composer: ComposerStateSchema,
  editor: EditorStateSchema
})
export type WorkspaceSlice = typeof WorkspaceSliceSchema.Type

export const ShellSliceSchema = Schema.Struct({
  viewport: ViewportMetricsSchema,
  lifecycle: LifecycleState,
  isBackgrounded: Schema.Boolean,
  backgroundTrips: Schema.Number,
  notice: Schema.String,
  statusAnnouncement: Schema.String,
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
      composer: { _tag: "Closed" },
      editor: { _tag: "Closed" }
    },
    shell: {
      viewport: params.initialViewport,
      lifecycle: "active",
      isBackgrounded: false,
      backgroundTrips: 0,
      notice: "",
      statusAnnouncement: "",
      inspectorOpen: false,
      traceEntries: [],
      dispatchCount: 0
    }
  }
}
