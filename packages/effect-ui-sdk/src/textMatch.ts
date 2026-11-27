import {
  fuzzyScore,
  matchRanges,
  matchSegments,
  type MatchRange,
  type MatchSegment
} from "@ui-sdk/core/text-match"

export type { MatchRange, MatchSegment }

export type CardPriorityFilter = "all" | "high" | "medium" | "low"

export interface SearchableCard {
  readonly code?: string
  readonly key?: string
  readonly title: string
  readonly notes: string
  readonly priority: "high" | "medium" | "low"
  readonly assignee: string
  readonly tags: ReadonlyArray<string>
}

export const scoreCard = (card: SearchableCard, query: string): number => {
  const trimmed = query.trim()
  if (trimmed.length === 0) return 1

  const identifier = card.code ?? card.key ?? ""
  const titleScore = fuzzyScore(card.title, trimmed)
  const idScore = identifier.length > 0 ? fuzzyScore(identifier, trimmed) * 0.95 : 0
  const tagScore = card.tags.reduce(
    (best, tag) => Math.max(best, fuzzyScore(tag, trimmed) * 0.88),
    0
  )
  const assigneeScore = fuzzyScore(card.assignee, trimmed) * 0.82
  // Notes are prose paragraphs: require a locale-aware substring match to avoid
  // scattered single-letter fuzzy false positives across long descriptions.
  const notesScore =
    matchRanges(card.notes, trimmed, "contains").length > 0 ? 0.72 : 0

  const best = Math.max(titleScore, idScore, tagScore, assigneeScore, notesScore)
  return best >= 0.2 ? best : 0
}

export const filterAndRankCards = <T extends SearchableCard>(
  cards: ReadonlyArray<T>,
  query: string,
  priorityFilter: CardPriorityFilter
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

export const highlightText = (
  text: string,
  query: string
): ReadonlyArray<MatchSegment> => {
  const trimmed = query.trim()
  if (trimmed.length === 0 || text.length === 0) {
    return [{ text, match: false }]
  }
  const contains = matchRanges(text, trimmed, "contains")
  const ranges =
    contains.length > 0 ? contains : matchRanges(text, trimmed, "fuzzy")
  if (ranges.length === 0) {
    return [{ text, match: false }]
  }
  return matchSegments(text, ranges)
}
