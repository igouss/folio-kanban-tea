import { createMemoryAppState, type MemoryAppState } from "./memoryAppState.ts"

export const defaultAppState: MemoryAppState = createMemoryAppState("active")
