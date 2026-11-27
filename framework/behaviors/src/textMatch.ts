import {
  fuzzyScore as sdkFuzzyScore,
  matchRanges as sdkMatchRanges,
  matchSegments,
  type MatchRange,
  type MatchSegment
} from "@ui-sdk/core/text-match"

/**
 * React Native aliases `window = globalThis` without implementing
 * `EventTarget` methods (`addEventListener`/`removeEventListener`).
 * `@ui-sdk/core/text-match` registers a `"languagechange"` listener whenever
 * `typeof window !== "undefined"`, so ensure a safe no-op exists on non-DOM
 * `window` objects before delegating.
 */
const ensureWindowListenerTarget = (): void => {
  const g = globalThis as {
    window?: {
      addEventListener?: unknown
      removeEventListener?: unknown
    }
  }
  if (g.window !== undefined && typeof g.window.addEventListener !== "function") {
    g.window.addEventListener = () => {}
    if (typeof g.window.removeEventListener !== "function") {
      g.window.removeEventListener = () => {}
    }
  }
}

export const fuzzyScore = (text: string, query: string): number => {
  ensureWindowListenerTarget()
  return sdkFuzzyScore(text, query)
}

export const matchRanges: typeof sdkMatchRanges = (text, query, mode) => {
  ensureWindowListenerTarget()
  return sdkMatchRanges(text, query, mode)
}

export { matchSegments, type MatchRange, type MatchSegment }

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
