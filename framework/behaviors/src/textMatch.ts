import {
  fuzzyScore,
  matchRanges,
  matchSegments,
  type MatchRange,
  type MatchSegment
} from "@ui-sdk/core/text-match"

export { fuzzyScore, matchRanges, matchSegments, type MatchRange, type MatchSegment }

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
