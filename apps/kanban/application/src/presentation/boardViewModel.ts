import {
  LANES,
  PRIORITY_FILTER_OPTIONS,
  PRIORITY_OPTIONS,
  STORY_POINTS,
  boardVelocity,
  formatWipCount,
  groupCardIdsByLane,
  laneStats,
  wipLimitsByLane,
  type BoardVelocity,
  type KanbanCard,
  type LaneId,
  type LaneMeta,
  type LaneStats,
  type Priority,
  type PriorityFilter,
  type StoryPoints,
  type StoryPointsLabel
} from "@folio/kanban-domain"
import {
  readProgress,
  readSegmentedControl,
  readTabs,
  type ProgressSnapshot,
  type SegmentedControlSnapshot,
  type StringAttrs,
  type TabsSnapshot
} from "@universal-ui/behaviors"
import {
  readKanbanBoard,
  type KanbanBoardSnapshot
} from "./boardPrimitive.ts"
import { filterAndRankCards } from "./search.ts"

export type PriorityFilterLabelStyle = "default" | "short" | "long"

export interface DeriveBoardViewOptions<T extends KanbanCard = KanbanCard> {
  readonly idPrefix: string
  readonly cards: ReadonlyArray<T>
  readonly searchQuery: string
  readonly priorityFilter: PriorityFilter
  readonly priorityLabelStyle?: PriorityFilterLabelStyle
  readonly activeLane?: LaneId
  readonly boardLabel?: string
  readonly selectedCardIds?: ReadonlyArray<string>
}

export interface LaneViewSnapshot<T extends KanbanCard = KanbanCard> {
  readonly lane: LaneMeta
  readonly stats: LaneStats
  readonly visibleCards: ReadonlyArray<T>
  readonly visiblePoints: number
  readonly wipText: string
  readonly visibleWipText: string
  readonly laneAttrs: StringAttrs
}

export interface BoardViewSnapshot<T extends KanbanCard = KanbanCard> {
  readonly velocity: BoardVelocity
  readonly progress: ProgressSnapshot
  readonly priorityControl: SegmentedControlSnapshot<PriorityFilter>
  readonly board: KanbanBoardSnapshot
  readonly visibleCards: ReadonlyArray<T>
  readonly lanes: ReadonlyArray<LaneViewSnapshot<T>>
  readonly laneTabs: TabsSnapshot<LaneId> | undefined
  readonly activeLane: LaneViewSnapshot<T>
}

const pickPriorityFilterLabel = (
  opt: (typeof PRIORITY_FILTER_OPTIONS)[number],
  style: PriorityFilterLabelStyle
): string => {
  switch (style) {
    case "short":
      return opt.shortLabel
    case "long":
      return opt.longLabel
    case "default":
      return opt.label
  }
}

export const deriveBoardView = <T extends KanbanCard>(
  options: DeriveBoardViewOptions<T>
): BoardViewSnapshot<T> => {
  const {
    idPrefix,
    cards,
    searchQuery,
    priorityFilter,
    priorityLabelStyle = "default",
    activeLane: activeLaneId,
    boardLabel = "Folio Kanban board",
    selectedCardIds
  } = options

  const velocity = boardVelocity(cards)
  const progress = readProgress({
    id: `${idPrefix}-board-velocity`,
    value: velocity.donePoints,
    min: 0,
    max: velocity.totalPoints,
    ariaLabel: "Sprint velocity"
  })

  const priorityControl = readSegmentedControl({
    id: `${idPrefix}-priority-filter`,
    value: priorityFilter,
    ariaLabel: "Filter by priority",
    items: PRIORITY_FILTER_OPTIONS.map((opt) => ({
      value: opt.value,
      label: pickPriorityFilterLabel(opt, priorityLabelStyle)
    }))
  })

  const visibleCards = filterAndRankCards(cards, searchQuery, priorityFilter)

  const board = readKanbanBoard({
    id: `${idPrefix}-kanban-board`,
    label: boardLabel,
    lists: groupCardIdsByLane(cards),
    lanes: LANES.map((lane) => ({ id: lane.id, label: `${lane.title} column` })),
    cards: visibleCards.map((card) => ({ id: card.id, lane: card.lane })),
    wipLimits: wipLimitsByLane(),
    ...(selectedCardIds !== undefined ? { selected: selectedCardIds } : {})
  })

  const lanes: ReadonlyArray<LaneViewSnapshot<T>> = LANES.map((lane) => {
    const stats = laneStats(cards, lane.id)
    const laneVisible = visibleCards.filter((card) => card.lane === lane.id)
    const visiblePoints = laneVisible.reduce((sum, card) => sum + card.points, 0)
    const lanePart = board.lanes[lane.id]
    return {
      lane,
      stats,
      visibleCards: laneVisible,
      visiblePoints,
      wipText: formatWipCount(stats.count, lane.wipLimit),
      visibleWipText: formatWipCount(laneVisible.length, lane.wipLimit),
      laneAttrs: lanePart?.attrs ?? {
        role: "list",
        "aria-label": `${lane.title} column`,
        "data-lane": lane.id
      }
    }
  })

  const laneTabs =
    activeLaneId !== undefined
      ? readTabs({
          id: `${idPrefix}-lane-tabs`,
          value: activeLaneId,
          ariaLabel: "Kanban lanes",
          items: LANES.map((lane) => ({
            value: lane.id,
            label: lane.shortTitle
          }))
        })
      : undefined

  const activeLane =
    lanes.find((entry) => entry.lane.id === (activeLaneId ?? "in_progress")) ??
    lanes[0]!

  return {
    velocity,
    progress,
    priorityControl,
    board,
    visibleCards,
    lanes,
    laneTabs,
    activeLane
  }
}

export interface DeriveCardEditorControlsOptions {
  readonly idPrefix: string
  readonly lane: LaneId
  readonly priority: Priority
  readonly points: StoryPoints
  readonly useShortLaneLabels?: boolean
  readonly pointsSuffix?: string
}

export interface CardEditorControlsSnapshot {
  readonly laneControl: SegmentedControlSnapshot<LaneId>
  readonly priorityControl: SegmentedControlSnapshot<Priority>
  readonly pointsControl: SegmentedControlSnapshot<StoryPointsLabel>
}

export const deriveCardEditorControls = (
  options: DeriveCardEditorControlsOptions
): CardEditorControlsSnapshot => {
  const {
    idPrefix,
    lane,
    priority,
    points,
    useShortLaneLabels = false,
    pointsSuffix = "pt"
  } = options

  return {
    laneControl: readSegmentedControl({
      id: `${idPrefix}-editor-lane`,
      value: lane,
      ariaLabel: "Lane",
      items: LANES.map((entry) => ({
        value: entry.id,
        label: useShortLaneLabels ? entry.shortTitle : entry.title
      }))
    }),
    priorityControl: readSegmentedControl({
      id: `${idPrefix}-editor-priority`,
      value: priority,
      ariaLabel: "Priority",
      items: PRIORITY_OPTIONS
    }),
    pointsControl: readSegmentedControl<StoryPointsLabel>({
      id: `${idPrefix}-editor-points`,
      value: `${points}`,
      ariaLabel: "Story points",
      items: STORY_POINTS.map((pt) => ({
        value: `${pt}`,
        label: `${pt}${pointsSuffix}`
      }))
    })
  }
}
