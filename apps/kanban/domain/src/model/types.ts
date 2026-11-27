export const LANE_IDS = ['backlog', 'in_progress', 'review', 'done'] as const
export type LaneId = (typeof LANE_IDS)[number]

export const PRIORITIES = ['high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_FILTERS = ['all', 'high', 'medium', 'low'] as const
export type PriorityFilter = (typeof PRIORITY_FILTERS)[number]

export const THEME_MODES = ['paper', 'graphite'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const
export type StoryPoints = (typeof STORY_POINTS)[number]

export interface PriorityOption {
  readonly value: Priority
  readonly label: string
}

export const PRIORITY_OPTIONS: ReadonlyArray<PriorityOption> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export interface PriorityFilterOption {
  readonly value: PriorityFilter
  readonly label: string
  readonly shortLabel: string
  readonly longLabel: string
}

export const PRIORITY_FILTER_OPTIONS: ReadonlyArray<PriorityFilterOption> = [
  { value: 'all', label: 'All', shortLabel: 'All', longLabel: 'All priorities' },
  { value: 'high', label: 'High', shortLabel: 'High', longLabel: 'High' },
  { value: 'medium', label: 'Medium', shortLabel: 'Med', longLabel: 'Medium' },
  { value: 'low', label: 'Low', shortLabel: 'Low', longLabel: 'Low' },
]

export interface LaneMeta {
  readonly id: LaneId
  readonly code: string
  readonly title: string
  readonly shortTitle: string
  readonly wipLimit: number | null
}

export const LANES: ReadonlyArray<LaneMeta> = [
  { id: 'backlog', code: '01', title: 'Backlog', shortTitle: 'Backlog', wipLimit: null },
  { id: 'in_progress', code: '02', title: 'In Progress', shortTitle: 'Active', wipLimit: 3 },
  { id: 'review', code: '03', title: 'In Review', shortTitle: 'Review', wipLimit: 2 },
  { id: 'done', code: '04', title: 'Done', shortTitle: 'Done', wipLimit: null },
]

export interface KanbanCard {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly notes: string
  readonly lane: LaneId
  readonly priority: Priority
  readonly assignee: string
  readonly points: number
  readonly tags: ReadonlyArray<string>
  readonly createdAt: string
}

export interface NewCardInput {
  readonly title: string
  readonly notes: string
  readonly lane: LaneId
  readonly priority: Priority
  readonly assignee: string
  readonly points: number
  readonly tags: ReadonlyArray<string>
}

export interface CardPatch {
  readonly title?: string
  readonly notes?: string
  readonly lane?: LaneId
  readonly priority?: Priority
  readonly assignee?: string
  readonly points?: number
  readonly tags?: ReadonlyArray<string>
}

export interface CardDraft {
  readonly cardId: string
  readonly code: string
  readonly title: string
  readonly notes: string
  readonly lane: LaneId
  readonly priority: Priority
  readonly assignee: string
  readonly points: number
}

export interface SavedBoard {
  readonly cards: ReadonlyArray<KanbanCard>
  readonly theme: ThemeMode
}

export interface BoardHistoryState {
  readonly past: ReadonlyArray<ReadonlyArray<KanbanCard>>
  readonly future: ReadonlyArray<ReadonlyArray<KanbanCard>>
}

export interface LaneStats {
  readonly lane: LaneMeta
  readonly count: number
  readonly points: number
  readonly overWip: boolean
}

export interface BoardVelocity {
  readonly totalCards: number
  readonly totalPoints: number
  readonly donePoints: number
  readonly percentComplete: number
}
