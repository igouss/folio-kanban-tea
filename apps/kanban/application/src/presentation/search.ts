import type { Priority, PriorityFilter } from "@folio/kanban-domain"
import { fuzzyScore, matchRanges } from "@universal-ui/behaviors"

export interface SearchableCard {
  readonly code?: string
  readonly key?: string
  readonly title: string
  readonly notes: string
  readonly priority: Priority
  readonly assignee: string
  readonly tags: ReadonlyArray<string>
}

export const scoreCard = (card: SearchableCard, query: string): number => {
  const trimmed = query.trim()
  if (trimmed.length === 0) return 1

  const identifier = card.code ?? card.key ?? ""
  const titleScore = fuzzyScore(card.title, trimmed)
  const idScore =
    identifier.length > 0 ? fuzzyScore(identifier, trimmed) * 0.95 : 0
  const tagScore = card.tags.reduce(
    (best, tag) => Math.max(best, fuzzyScore(tag, trimmed) * 0.88),
    0
  )
  const assigneeScore = fuzzyScore(card.assignee, trimmed) * 0.82
  const notesScore =
    matchRanges(card.notes, trimmed, "contains").length > 0 ? 0.72 : 0

  const best = Math.max(
    titleScore,
    idScore,
    tagScore,
    assigneeScore,
    notesScore
  )
  return best >= 0.2 ? best : 0
}

export const filterAndRankCards = <T extends SearchableCard>(
  cards: ReadonlyArray<T>,
  query: string,
  priorityFilter: PriorityFilter
): ReadonlyArray<T> => {
  const byPriority =
    priorityFilter === "all"
      ? cards
      : cards.filter((card) => card.priority === priorityFilter)

  const trimmed = query.trim()
  if (trimmed.length === 0) return byPriority

  return byPriority
    .map((card, index) => ({ card, index, score: scoreCard(card, trimmed) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.card)
}
