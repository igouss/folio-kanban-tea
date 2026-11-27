import { DEFAULT_CARDS } from './seed.ts'
import {
  cardsInLane,
  createCard,
  deleteCard,
  draftToPatch,
  findCard,
  laneTitle,
  moveCard,
  saveCard,
  validateCardTitle,
} from './operations.ts'
import type {
  BoardHistoryState,
  CardDraft,
  KanbanCard,
  LaneId,
} from './types.ts'

export const DEFAULT_HISTORY_LIMIT = 50

export const emptyHistory = (): BoardHistoryState => ({
  past: [],
  future: [],
})

export const canUndoHistory = (history: BoardHistoryState): boolean =>
  history.past.length > 0

export const canRedoHistory = (history: BoardHistoryState): boolean =>
  history.future.length > 0

export const recordHistory = (
  history: BoardHistoryState,
  previousCards: ReadonlyArray<KanbanCard>,
  limit = DEFAULT_HISTORY_LIMIT,
): BoardHistoryState => {
  const past = [...history.past, previousCards]
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    future: [],
  }
}

export const undoHistory = (
  history: BoardHistoryState,
  currentCards: ReadonlyArray<KanbanCard>,
  limit = DEFAULT_HISTORY_LIMIT,
): { readonly cards: ReadonlyArray<KanbanCard>; readonly history: BoardHistoryState } | undefined => {
  if (history.past.length === 0) return undefined
  const previous = history.past[history.past.length - 1]!
  const future = [currentCards, ...history.future]
  return {
    cards: previous,
    history: {
      past: history.past.slice(0, -1),
      future: future.length > limit ? future.slice(0, limit) : future,
    },
  }
}

export const redoHistory = (
  history: BoardHistoryState,
  currentCards: ReadonlyArray<KanbanCard>,
  limit = DEFAULT_HISTORY_LIMIT,
): { readonly cards: ReadonlyArray<KanbanCard>; readonly history: BoardHistoryState } | undefined => {
  if (history.future.length === 0) return undefined
  const next = history.future[0]!
  const past = [...history.past, currentCards]
  return {
    cards: next,
    history: {
      past: past.length > limit ? past.slice(past.length - limit) : past,
      future: history.future.slice(1),
    },
  }
}

export interface BoardSessionSlice {
  readonly cards: ReadonlyArray<KanbanCard>
  readonly history: BoardHistoryState
}

export const applyQuickCreate = (
  session: BoardSessionSlice,
  params: {
    readonly title: string
    readonly lane: LaneId
    readonly id: string
    readonly tag: string
    readonly createdAt?: string
    readonly minTitleLength?: number
  },
):
  | {
      readonly ok: true
      readonly card: KanbanCard
      readonly cards: ReadonlyArray<KanbanCard>
      readonly history: BoardHistoryState
      readonly laneName: string
    }
  | { readonly ok: false; readonly error: string } => {
  const check = validateCardTitle(params.title, params.minTitleLength ?? 2)
  if (!check.ok) return check

  const created = createCard(
    session.cards,
    {
      title: check.title,
      notes: '',
      lane: params.lane,
      priority: 'medium',
      assignee: 'ME',
      points: 2,
      tags: [params.tag],
    },
    {
      id: params.id,
      createdAt: params.createdAt ?? '2026-11-26T00:00:00.000Z',
    },
  )

  return {
    ok: true,
    card: created.card,
    cards: created.cards,
    history: recordHistory(session.history, session.cards),
    laneName: laneTitle(params.lane),
  }
}

export const applyMoveCard = (
  session: BoardSessionSlice,
  cardId: string,
  toLane: LaneId,
):
  | {
      readonly card: KanbanCard
      readonly cards: ReadonlyArray<KanbanCard>
      readonly history: BoardHistoryState
      readonly laneName: string
      readonly totalInTargetLane: number
    }
  | undefined => {
  const existing = findCard(session.cards, cardId)
  if (existing === undefined) return undefined
  const nextCards = moveCard(session.cards, cardId, toLane)
  const moved = findCard(nextCards, cardId) ?? { ...existing, lane: toLane }
  return {
    card: moved,
    cards: nextCards,
    history: recordHistory(session.history, session.cards),
    laneName: laneTitle(toLane),
    totalInTargetLane: cardsInLane(nextCards, toLane).length,
  }
}

export const applyDeleteCard = (
  session: BoardSessionSlice,
  cardId: string,
):
  | {
      readonly card: KanbanCard
      readonly cards: ReadonlyArray<KanbanCard>
      readonly history: BoardHistoryState
    }
  | undefined => {
  const existing = findCard(session.cards, cardId)
  if (existing === undefined) return undefined
  return {
    card: existing,
    cards: deleteCard(session.cards, cardId),
    history: recordHistory(session.history, session.cards),
  }
}

export const applySaveDraft = (
  session: BoardSessionSlice,
  draft: CardDraft,
  minTitleLength = 2,
):
  | {
      readonly ok: true
      readonly card: KanbanCard
      readonly cards: ReadonlyArray<KanbanCard>
      readonly history: BoardHistoryState
    }
  | { readonly ok: false; readonly error: string } => {
  const check = validateCardTitle(draft.title, minTitleLength)
  if (!check.ok) return check

  const existing = findCard(session.cards, draft.cardId)
  if (existing === undefined) {
    return { ok: false, error: `Card ${draft.code} no longer exists.` }
  }

  const nextCards = saveCard(session.cards, draft.cardId, draftToPatch(draft))
  const saved = findCard(nextCards, draft.cardId) ?? existing
  return {
    ok: true,
    card: saved,
    cards: nextCards,
    history: recordHistory(session.history, session.cards),
  }
}

export const applyResetBoard = (
  session: BoardSessionSlice,
): {
  readonly cards: ReadonlyArray<KanbanCard>
  readonly history: BoardHistoryState
} => ({
  cards: [...DEFAULT_CARDS],
  history: recordHistory(session.history, session.cards),
})
