import { DEFAULT_CARDS, emptyHistory } from "@folio/kanban-domain"
import {
  BoardHistorySchema,
  CardDraftSchema,
  CardTitleSchema,
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

export const InspectorVisibility = Schema.Literals(["closed", "open"])
export type InspectorVisibility = typeof InspectorVisibility.Type

export const PositiveRequestIdSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThan(0))
)

export const NonEmptyTextSchema = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isTrimmed()),
  Schema.brand("NonEmptyText")
)
export type NonEmptyText = typeof NonEmptyTextSchema.Type

export const parseNonEmptyText = (raw: string): NonEmptyText | undefined => {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? (trimmed as NonEmptyText) : undefined
}

export const WorkspaceModeSchema = Schema.TaggedUnion({
  Idle: {},
  Composing: {
    lane: LaneId,
    title: Schema.String
  },
  SubmittingCard: {
    requestId: PositiveRequestIdSchema,
    lane: LaneId,
    title: CardTitleSchema
  },
  EditingCard: {
    draft: CardDraftSchema
  }
})
export type WorkspaceMode = typeof WorkspaceModeSchema.Type

export const NoticeTone = Schema.Literals(["info", "error"])
export type NoticeTone = typeof NoticeTone.Type

export const NoticeStateSchema = Schema.TaggedUnion({
  Hidden: {},
  Visible: {
    tone: NoticeTone,
    message: NonEmptyTextSchema,
    announcement: NonEmptyTextSchema
  }
})
export type NoticeState = typeof NoticeStateSchema.Type

/**
 * Total constructor for visible notices. Returns `Hidden` if `message` is blank,
 * making empty visible banners unconstructible at both compile time and runtime.
 */
export const makeVisibleNotice = (
  tone: NoticeTone,
  message: string,
  announcement = message
): NoticeState => {
  const parsedMessage = parseNonEmptyText(message)
  if (parsedMessage === undefined) {
    return { _tag: "Hidden" }
  }
  const parsedAnnouncement = parseNonEmptyText(announcement) ?? parsedMessage
  return {
    _tag: "Visible",
    tone,
    message: parsedMessage,
    announcement: parsedAnnouncement
  }
}

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
  mode: WorkspaceModeSchema,
  nextRequestId: PositiveRequestIdSchema
})
export type WorkspaceSlice = typeof WorkspaceSliceSchema.Type

export const ShellSliceSchema = Schema.Struct({
  viewport: ViewportMetricsSchema,
  lifecycle: LifecycleState,
  backgroundTrips: Schema.Number,
  notice: NoticeStateSchema,
  inspector: InspectorVisibility,
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
      mode: { _tag: "Idle" },
      nextRequestId: 1
    },
    shell: {
      viewport: params.initialViewport,
      lifecycle: "active",
      backgroundTrips: 0,
      notice: { _tag: "Hidden" },
      inspector: "closed",
      dispatchCount: 0
    }
  }
}
