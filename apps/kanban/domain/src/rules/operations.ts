import {
  CARD_TITLE_MIN_LENGTH,
  LANE_IDS,
  LANES,
  STORY_POINTS,
  type BoardVelocity,
  type CardDraft,
  type CardId,
  type CardPatch,
  type CardTitle,
  type KanbanCard,
  type LaneId,
  type LaneMeta,
  type LaneStats,
  type NewCardInput,
  type Priority,
  type PriorityFilter,
  type StoryPoints,
  type StoryPointsLabel,
  type ThemeMode,
} from '../model/types.ts'

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

export const toggleTheme = (theme: ThemeMode): ThemeMode =>
  theme === 'paper' ? 'graphite' : 'paper'

export const themeLabel = (theme: ThemeMode): string =>
  theme === 'paper' ? 'Paper (Light)' : 'Graphite (Dark)'

export const formatWipCount = (count: number, wipLimit: number | null): string =>
  wipLimit !== null ? `${count}/${wipLimit}` : `${count}`

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

export const normalizeDraftAssignee = (raw: string): string =>
  raw.toUpperCase().slice(0, 3)

export const parseStoryPoints = (raw: number | string): StoryPoints | undefined => {
  const num = typeof raw === 'number' ? raw : Number(raw)
  return STORY_POINTS.find((pt) => pt === num)
}

export const storyPointsFromLabel = (label: StoryPointsLabel): StoryPoints => {
  switch (label) {
    case '1':
      return 1
    case '2':
      return 2
    case '3':
      return 3
    case '5':
      return 5
    case '8':
      return 8
    case '13':
      return 13
  }
}

export const parseCardId = (raw: string): CardId | undefined => {
  const trimmed = raw.trim()
  return trimmed.length > 0 && trimmed === raw ? (trimmed as CardId) : undefined
}

export const parseLaneId = (raw: string): LaneId | undefined =>
  LANE_IDS.find((lane) => lane === raw)

export const parseCardTitle = (
  raw: string,
  minLength = CARD_TITLE_MIN_LENGTH,
): CardTitle | undefined => {
  const title = raw.trim()
  return title.length >= minLength ? (title as CardTitle) : undefined
}

export const validateCardTitle = (
  raw: string,
  minLength = CARD_TITLE_MIN_LENGTH,
): { readonly ok: true; readonly title: CardTitle } | { readonly ok: false; readonly error: string } => {
  const title = parseCardTitle(raw, minLength)
  if (title === undefined) {
    return {
      ok: false,
      error: `Title must be at least ${minLength} characters.`,
    }
  }
  return { ok: true, title }
}

export const findCard = <T extends { readonly id: CardId }>(
  cards: ReadonlyArray<T>,
  cardId: CardId,
): T | undefined => cards.find((card) => card.id === cardId)

export const cardsInLane = <T extends { readonly lane: LaneId }>(
  cards: ReadonlyArray<T>,
  laneId: LaneId,
): ReadonlyArray<T> => cards.filter((card) => card.lane === laneId)

export const groupCardIdsByLane = (
  cards: ReadonlyArray<Pick<KanbanCard, 'id' | 'lane'>>,
): Record<LaneId, Array<CardId>> => {
  const lists: Record<LaneId, Array<CardId>> = {
    backlog: [],
    in_progress: [],
    review: [],
    done: [],
  }
  for (const card of cards) {
    lists[card.lane].push(card.id)
  }
  return lists
}

export const wipLimitsByLane = (): Record<LaneId, number | null> => ({
  backlog: laneMeta('backlog').wipLimit,
  in_progress: laneMeta('in_progress').wipLimit,
  review: laneMeta('review').wipLimit,
  done: laneMeta('done').wipLimit,
})

export const cardToDraft = (card: KanbanCard): CardDraft => ({
  cardId: card.id,
  code: card.code,
  title: card.title,
  notes: card.notes,
  lane: card.lane,
  priority: card.priority,
  assignee: card.assignee,
  points: card.points,
})

export const draftToPatch = (draft: CardDraft, title: CardTitle): CardPatch => ({
  title,
  notes: draft.notes,
  lane: draft.lane,
  priority: draft.priority,
  assignee: draft.assignee,
  points: draft.points,
})

export const isCardDirty = (
  draft: {
    readonly title: string
    readonly notes: string
    readonly lane: LaneId
    readonly priority: Priority
    readonly assignee: string
    readonly points: StoryPoints
  },
  saved: {
    readonly title: string
    readonly notes: string
    readonly lane: LaneId
    readonly priority: Priority
    readonly assignee: string
    readonly points: StoryPoints
  },
): boolean =>
  draft.title !== saved.title ||
  draft.notes !== saved.notes ||
  draft.lane !== saved.lane ||
  draft.priority !== saved.priority ||
  draft.assignee !== saved.assignee ||
  draft.points !== saved.points

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
  options: { readonly id: CardId; readonly createdAt: string },
): { readonly card: KanbanCard; readonly cards: ReadonlyArray<KanbanCard> } => {
  const card: KanbanCard = {
    id: options.id,
    code: nextCardCode(cards),
    title: input.title,
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
  cardId: CardId,
  toLane: LaneId,
): ReadonlyArray<KanbanCard> => {
  const existing = cards.find((card) => card.id === cardId)
  if (existing === undefined) return cards
  const updated: KanbanCard = { ...existing, lane: toLane }
  return [updated, ...cards.filter((card) => card.id !== cardId)]
}

export const updateCard = (
  cards: ReadonlyArray<KanbanCard>,
  cardId: CardId,
  patch: CardPatch,
): ReadonlyArray<KanbanCard> =>
  cards.map((card) =>
    card.id !== cardId
      ? card
      : {
          ...card,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
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

export const saveCard = (
  cards: ReadonlyArray<KanbanCard>,
  cardId: CardId,
  patch: CardPatch,
): ReadonlyArray<KanbanCard> => {
  const existing = cards.find((card) => card.id === cardId)
  if (existing === undefined) return cards
  const updatedList = updateCard(cards, cardId, patch)
  if (patch.lane === undefined || patch.lane === existing.lane) {
    return updatedList
  }
  const updated = updatedList.find((card) => card.id === cardId)
  if (updated === undefined) return updatedList
  return [updated, ...updatedList.filter((card) => card.id !== cardId)]
}

export const deleteCard = (
  cards: ReadonlyArray<KanbanCard>,
  cardId: CardId,
): ReadonlyArray<KanbanCard> => cards.filter((card) => card.id !== cardId)
