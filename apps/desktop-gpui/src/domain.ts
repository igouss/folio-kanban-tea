import {
  DEFAULT_CARDS,
  LANES,
  PRIORITIES,
  PRIORITY_FILTERS,
  THEME_MODES,
  matchesCard,
  nextCardCode as coreNextCardCode
} from "@folio/kanban-core"
import { Array, Option, Schema, pipe } from "effect"
import { generateKeyBetween } from "fractional-indexing"

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
  sortKey: Schema.String
})
export type Card = typeof Card.Type

export const Column = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  wipLimit: Schema.NullOr(Schema.Number),
  cards: Schema.Array(Card)
})
export type Column = typeof Column.Type

export const SavedBoard = Schema.Struct({
  columns: Schema.Array(Column),
  theme: ThemeMode
})
export type SavedBoard = typeof SavedBoard.Type

export const SavedBoardJson = Schema.fromJsonString(SavedBoard)

export const EditDraft = Schema.Struct({
  cardId: Schema.String,
  columnId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  notes: Schema.String,
  priority: Priority,
  assignee: Schema.String,
  points: Schema.Number
})
export type EditDraft = typeof EditDraft.Type

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
      sortKey: keys[index]!
    }))
  }
})

const generateSortKeyAtIndex = (
  cards: ReadonlyArray<Card>,
  targetIndex: number
): string => {
  const before = cards[targetIndex - 1]?.sortKey ?? null
  const after = cards[targetIndex]?.sortKey ?? null
  return generateKeyBetween(before, after)
}

export const removeCard = (
  column: Column,
  cardId: string
): { readonly column: Column; readonly maybeCard: Option.Option<Card> } => {
  const maybeCard = Array.findFirst(column.cards, ({ id }) => id === cardId)
  return {
    column: {
      ...column,
      cards: column.cards.filter(({ id }) => id !== cardId)
    },
    maybeCard
  }
}

export const insertCard = (
  column: Column,
  card: Card,
  targetIndex: number
): Column => {
  const clamped = Math.max(0, Math.min(targetIndex, column.cards.length))
  const sortKey = generateSortKeyAtIndex(column.cards, clamped)
  const updatedCard: Card = { ...card, sortKey }
  return {
    ...column,
    cards: pipe(
      column.cards,
      Array.insertAt(clamped, updatedCard),
      Option.getOrElse(() => [...column.cards, updatedCard])
    )
  }
}

export const appendCard = (column: Column, card: Card): Column => {
  const sortKey = generateSortKeyAtIndex(column.cards, column.cards.length)
  return {
    ...column,
    cards: [...column.cards, { ...card, sortKey }]
  }
}

export const findCardWithColumn = (
  columns: ReadonlyArray<Column>,
  cardId: string
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
  fromColumnId: string,
  toColumnId: string,
  toIndex: number
): ReadonlyArray<Column> => {
  if (fromColumnId === toColumnId) {
    return columns.map((column) => {
      if (column.id !== fromColumnId) return column
      const { column: withoutCard, maybeCard } = removeCard(column, itemId)
      return Option.match(maybeCard, {
        onNone: () => column,
        onSome: (card) => insertCard(withoutCard, card, toIndex)
      })
    })
  }

  const found = findCardWithColumn(columns, itemId)
  return Option.match(found, {
    onNone: () => columns,
    onSome: ({ card }) =>
      columns.map((column) => {
        if (column.id === fromColumnId) return removeCard(column, itemId).column
        if (column.id === toColumnId) return insertCard(column, card, toIndex)
        return column
      })
  })
}

export const nextCardCode = (columns: ReadonlyArray<Column>): string =>
  coreNextCardCode(columns.flatMap((column) => column.cards))

export const matchesFilter = (
  card: Card,
  searchQuery: string,
  priorityFilter: PriorityFilter
): boolean => matchesCard(card, searchQuery, priorityFilter)
