import {
  DEFAULT_CARDS,
  LANES,
  PRIORITIES,
  PRIORITY_FILTERS,
  THEME_MODES,
  matchesCard,
  nextCardCode as coreNextCardCode,
} from '@folio/kanban-core'
import { Array, Match, Option, Schema, pipe } from 'effect'
import { modifyFields } from 'foldkit/struct'
import { generateKeyBetween } from 'fractional-indexing'

export const Priority = Schema.Literals(PRIORITIES)
export type Priority = typeof Priority.Type

export const PriorityFilter = Schema.Literals(PRIORITY_FILTERS)
export type PriorityFilter = typeof PriorityFilter.Type

export const ThemeMode = Schema.Literals(THEME_MODES)
export type ThemeMode = typeof ThemeMode.Type

export const Card = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  priority: Priority,
  assignee: Schema.String,
  points: Schema.Number,
  tags: Schema.Array(Schema.String),
  sortKey: Schema.String,
})
export type Card = typeof Card.Type

export const Column = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  wipLimit: Schema.NullOr(Schema.Number),
  cards: Schema.Array(Card),
})
export type Column = typeof Column.Type

export const SavedBoard = Schema.Struct({
  columns: Schema.Array(Column),
  theme: ThemeMode,
})
export type SavedBoard = typeof SavedBoard.Type

export const SavedBoardJsonString = Schema.fromJsonString(
  Schema.toCodecJson(SavedBoard),
)

export const STORAGE_KEY = 'folio.kanban.native.v2'
export const ADD_CARD_INPUT_ID = 'folio-add-card-input'
export const SEARCH_INPUT_ID = 'folio-search-input'

const makeSortKeys = (count: number): ReadonlyArray<string> => {
  const keys: Array<string> = []
  let prev: string | null = null
  for (let i = 0; i < count; i++) {
    const next = generateKeyBetween(prev, null)
    keys.push(next)
    prev = next
  }
  return keys
}

export const DEFAULT_COLUMNS: ReadonlyArray<Column> = LANES.map((lane) => {
  const laneCards = DEFAULT_CARDS.filter((card) => card.lane === lane.id)
  const keys = makeSortKeys(laneCards.length)
  return {
    id: lane.id,
    code: lane.code,
    name: lane.title,
    wipLimit: lane.wipLimit,
    cards: laneCards.map((card, index) => ({
      id: card.id,
      code: card.code,
      title: card.title,
      notes: card.notes,
      priority: card.priority,
      assignee: card.assignee,
      points: card.points,
      tags: card.tags,
      sortKey: keys[index]!,
    })),
  }
})

const generateSortKeyAtIndex = (
  cards: ReadonlyArray<Card>,
  targetIndex: number,
): string => {
  const maybeBefore = Array.get(cards, targetIndex - 1)
  const maybeAfter = Array.get(cards, targetIndex)
  return generateKeyBetween(
    Option.match(maybeBefore, {
      onNone: () => null,
      onSome: ({ sortKey }) => sortKey,
    }),
    Option.match(maybeAfter, {
      onNone: () => null,
      onSome: ({ sortKey }) => sortKey,
    }),
  )
}

export const removeCard = (
  column: Column,
  cardId: string,
): { readonly column: Column; readonly maybeCard: Option.Option<Card> } => {
  const maybeCard = Array.findFirst(column.cards, ({ id }) => id === cardId)
  return {
    column: modifyFields(column, {
      cards: () => Array.filter(column.cards, ({ id }) => id !== cardId),
    }),
    maybeCard,
  }
}

export const insertCard = (
  column: Column,
  card: Card,
  targetIndex: number,
): Column => {
  const clamped = Math.max(0, Math.min(targetIndex, column.cards.length))
  const sortKey = generateSortKeyAtIndex(column.cards, clamped)
  const updatedCard = modifyFields(card, { sortKey: () => sortKey })
  return modifyFields(column, {
    cards: () =>
      pipe(
        column.cards,
        Array.insertAt(clamped, updatedCard),
        Option.getOrElse(() => [...column.cards, updatedCard]),
      ),
  })
}

export const appendCard = (column: Column, card: Card): Column => {
  const sortKey = generateSortKeyAtIndex(column.cards, column.cards.length)
  return modifyFields(column, {
    cards: () => [
      ...column.cards,
      modifyFields(card, { sortKey: () => sortKey }),
    ],
  })
}

export const findCardWithColumn = (
  columns: ReadonlyArray<Column>,
  cardId: string,
): Option.Option<{ readonly column: Column; readonly card: Card }> => {
  for (const column of columns) {
    const found = column.cards.find((card) => card.id === cardId)
    if (found !== undefined) {
      return Option.some({ column, card: found })
    }
  }
  return Option.none()
}

export const reorder = (
  columns: ReadonlyArray<Column>,
  itemId: string,
  fromContainerId: string,
  toContainerId: string,
  toIndex: number,
): ReadonlyArray<Column> => {
  if (fromContainerId === toContainerId) {
    return Array.map(columns, (column) => {
      if (column.id !== fromContainerId) return column
      const { column: withoutCard, maybeCard } = removeCard(column, itemId)
      return Option.match(maybeCard, {
        onNone: () => column,
        onSome: (card) => insertCard(withoutCard, card, toIndex),
      })
    })
  }

  const maybeCard = pipe(
    columns,
    Array.findFirst(({ id }) => id === fromContainerId),
    Option.flatMap(({ cards }) =>
      Array.findFirst(cards, ({ id }) => id === itemId),
    ),
  )

  return Option.match(maybeCard, {
    onNone: () => columns,
    onSome: (card) =>
      Array.map(columns, (column) =>
        Match.value(column.id).pipe(
          Match.when(fromContainerId, () => removeCard(column, itemId).column),
          Match.when(toContainerId, () => insertCard(column, card, toIndex)),
          Match.orElse(() => column),
        ),
      ),
  })
}

export const nextCardCode = (columns: ReadonlyArray<Column>): string =>
  coreNextCardCode(columns.flatMap((column) => column.cards))

export const matchesFilter = (
  card: Card,
  searchQuery: string,
  priorityFilter: PriorityFilter,
): boolean => matchesCard(card, searchQuery, priorityFilter)
