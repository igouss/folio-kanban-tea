import {
  LANES,
  type BoardVelocity,
  type CardPatch,
  type KanbanCard,
  type LaneId,
  type LaneMeta,
  type LaneStats,
  type NewCardInput,
  type Priority,
  type PriorityFilter,
} from './types.ts'

export const laneMeta = (id: LaneId): LaneMeta =>
  LANES.find((lane) => lane.id === id) ?? LANES[0]!

export const laneTitle = (id: LaneId): string => laneMeta(id).title

export const adjacentLanes = (
  id: LaneId,
): { readonly prev: LaneId | undefined; readonly next: LaneId | undefined } => {
  const index = LANES.findIndex((lane) => lane.id === id)
  return {
    prev: index > 0 ? LANES[index - 1]?.id : undefined,
    next: index >= 0 && index < LANES.length - 1 ? LANES[index + 1]?.id : undefined,
  }
}

export const priorityLabel = (priority: Priority): string => {
  switch (priority) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
  }
}

export const priorityBadge = (priority: Priority): string =>
  priority === 'high' ? 'HIGH' : priority === 'medium' ? 'MED' : 'LOW'

export const nextCardCode = (
  cards: ReadonlyArray<{ readonly code: string }>,
): string => {
  const max = cards.reduce((acc, card) => {
    const match = /(\d+)$/.exec(card.code)
    return Math.max(acc, match ? Number(match[1]) : 100)
  }, 108)
  return `FOL-${max + 1}`
}

export const parseTags = (raw: string): ReadonlyArray<string> =>
  raw
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/^#/, ''))
    .filter((part) => part.length > 0)
    .slice(0, 5)

export const normalizeAssignee = (raw: string): string =>
  raw.trim().toUpperCase().slice(0, 3) || 'ME'

export const matchesCard = (
  card: Pick<KanbanCard, 'code' | 'title' | 'notes' | 'priority' | 'assignee' | 'tags'>,
  query: string,
  priorityFilter: PriorityFilter,
): boolean => {
  if (priorityFilter !== 'all' && card.priority !== priorityFilter) {
    return false
  }
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return true
  const haystack = [card.code, card.title, card.notes, card.assignee, ...card.tags]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export const filterCards = <
  T extends Pick<KanbanCard, 'code' | 'title' | 'notes' | 'priority' | 'assignee' | 'tags'>,
>(
  cards: ReadonlyArray<T>,
  query: string,
  priorityFilter: PriorityFilter,
): ReadonlyArray<T> => cards.filter((card) => matchesCard(card, query, priorityFilter))

export const laneStats = (
  cards: ReadonlyArray<Pick<KanbanCard, 'lane' | 'points'>>,
  laneId: LaneId,
): LaneStats => {
  const meta = laneMeta(laneId)
  const inLane = cards.filter((card) => card.lane === laneId)
  const points = inLane.reduce((sum, card) => sum + card.points, 0)
  return {
    lane: meta,
    count: inLane.length,
    points,
    overWip: meta.wipLimit !== null && inLane.length > meta.wipLimit,
  }
}

export const boardVelocity = (
  cards: ReadonlyArray<Pick<KanbanCard, 'lane' | 'points'>>,
): BoardVelocity => {
  const totalPoints = cards.reduce((sum, card) => sum + card.points, 0)
  const donePoints = cards
    .filter((card) => card.lane === 'done')
    .reduce((sum, card) => sum + card.points, 0)
  return {
    totalCards: cards.length,
    totalPoints,
    donePoints,
    percentComplete:
      totalPoints === 0 ? 0 : Math.round((donePoints / totalPoints) * 100),
  }
}

export const createCard = (
  cards: ReadonlyArray<KanbanCard>,
  input: NewCardInput,
  options: { readonly id: string; readonly createdAt: string },
): { readonly card: KanbanCard; readonly cards: ReadonlyArray<KanbanCard> } => {
  const card: KanbanCard = {
    id: options.id,
    code: nextCardCode(cards),
    title: input.title.trim(),
    notes: input.notes.trim(),
    lane: input.lane,
    priority: input.priority,
    assignee: normalizeAssignee(input.assignee),
    points: input.points,
    tags: input.tags,
    createdAt: options.createdAt,
  }
  return { card, cards: [card, ...cards] }
}

export const moveCard = (
  cards: ReadonlyArray<KanbanCard>,
  cardId: string,
  toLane: LaneId,
): ReadonlyArray<KanbanCard> => {
  const existing = cards.find((card) => card.id === cardId)
  if (existing === undefined) return cards
  const updated: KanbanCard = { ...existing, lane: toLane }
  return [updated, ...cards.filter((card) => card.id !== cardId)]
}

export const updateCard = (
  cards: ReadonlyArray<KanbanCard>,
  cardId: string,
  patch: CardPatch,
): ReadonlyArray<KanbanCard> =>
  cards.map((card) =>
    card.id !== cardId
      ? card
      : {
          ...card,
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
          ...(patch.lane !== undefined ? { lane: patch.lane } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.assignee !== undefined
            ? { assignee: normalizeAssignee(patch.assignee) }
            : {}),
          ...(patch.points !== undefined ? { points: patch.points } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        },
  )

export const deleteCard = (
  cards: ReadonlyArray<KanbanCard>,
  cardId: string,
): ReadonlyArray<KanbanCard> => cards.filter((card) => card.id !== cardId)
