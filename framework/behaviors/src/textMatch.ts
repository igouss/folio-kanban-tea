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
 * `@ui-sdk/core/text-match` registers a `"languagechange"` listener once on first
 * use whenever `typeof window !== "undefined"`, so temporarily supply a scoped
 * no-op during the synchronous call and restore `window` afterwards without
 * polluting global feature detection.
 */
interface WindowListenerLike {
  addEventListener?: unknown
  removeEventListener?: unknown
}

const withWindowListenerFallback = <A>(run: () => A): A => {
  const g = globalThis as {
    window?: WindowListenerLike | undefined
  }
  const win = g.window
  if (win === undefined || typeof win.addEventListener === "function") {
    return run()
  }

  const prevAddDescriptor = Object.getOwnPropertyDescriptor(
    win,
    "addEventListener"
  )
  const prevRemoveDescriptor = Object.getOwnPropertyDescriptor(
    win,
    "removeEventListener"
  )
  const needsRemove = typeof win.removeEventListener !== "function"

  win.addEventListener = () => {}
  if (needsRemove) {
    win.removeEventListener = () => {}
  }

  try {
    return run()
  } finally {
    if (prevAddDescriptor !== undefined) {
      Object.defineProperty(win, "addEventListener", prevAddDescriptor)
    } else {
      delete win.addEventListener
    }
    if (needsRemove) {
      if (prevRemoveDescriptor !== undefined) {
        Object.defineProperty(win, "removeEventListener", prevRemoveDescriptor)
      } else {
        delete win.removeEventListener
      }
    }
  }
}

export const fuzzyScore = (text: string, query: string): number =>
  withWindowListenerFallback(() => sdkFuzzyScore(text, query))

export const matchRanges: typeof sdkMatchRanges = (text, query, mode) =>
  withWindowListenerFallback(() => sdkMatchRanges(text, query, mode))

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
