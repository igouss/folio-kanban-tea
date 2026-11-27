export const LANE_IDS = ['backlog', 'in_progress', 'review', 'done'] as const
export type LaneId = (typeof LANE_IDS)[number]

export const PRIORITIES = ['high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_FILTERS = ['all', 'high', 'medium', 'low'] as const
export type PriorityFilter = (typeof PRIORITY_FILTERS)[number]

export const THEME_MODES = ['paper', 'graphite'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

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
