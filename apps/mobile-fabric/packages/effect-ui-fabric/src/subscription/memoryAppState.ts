import type { AppStateSource, AppStateStatus } from "./source.ts"

export type MemoryAppState = AppStateSource &
  Readonly<{
    set: (state: AppStateStatus) => void
    listenerCount: () => number
  }>

export const createMemoryAppState = (
  initial: AppStateStatus = "active"
): MemoryAppState => {
  const listeners = new Set<(state: AppStateStatus) => void>()
  const appState = {
    currentState: initial,
    addEventListener: (
      _type: "change",
      listener: (state: AppStateStatus) => void
    ) => {
      const entry = (state: AppStateStatus) => listener(state)
      listeners.add(entry)
      return { remove: () => void listeners.delete(entry) }
    },
    set: (state: AppStateStatus) => {
      appState.currentState = state
      ;[...listeners].forEach((listener) => listener(state))
    },
    listenerCount: () => listeners.size
  }
  return appState
}
