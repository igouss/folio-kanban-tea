export { createFakeFabric, type FakeFabric, type FakeFabricNode } from "./fakeFabric.ts"
export {
  createMemoryAppState as createFakeAppState,
  type MemoryAppState as FakeAppState
} from "../subscription/memoryAppState.ts"
export { defaultAppState as fakeAppState } from "../subscription/appStateSource.ts"

export const manualFrames = () => {
  const pending: Array<() => void> = []
  return {
    requestAnimationFrame: (callback: () => void) => {
      pending.push(callback)
    },
    flush: () => {
      pending.splice(0).forEach((callback) => callback())
    }
  }
}
