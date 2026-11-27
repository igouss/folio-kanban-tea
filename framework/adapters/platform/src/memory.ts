import {
  IdGenerator,
  makeLifecycleLayer,
  makeSequenceIdGeneratorLayer,
  staticLifecycleLayer,
  staticViewportLayer
} from "@universal-ui/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export {
  makeLifecycleLayer,
  makeSequenceIdGeneratorLayer,
  staticLifecycleLayer,
  staticViewportLayer
}

export const makeUuidIdGeneratorLayer = (
  generateUuid?: () => string
): Layer.Layer<IdGenerator> =>
  Layer.sync(IdGenerator, () => {
    let fallbackCounter = 0
    return {
      nextId: (prefix) =>
        Effect.sync(() => {
          const uuid =
            generateUuid !== undefined
              ? generateUuid()
              : typeof globalThis.crypto?.randomUUID === "function"
                ? globalThis.crypto.randomUUID()
                : undefined
          if (prefix !== undefined && prefix.length > 0) {
            const suffix =
              uuid !== undefined
                ? uuid.slice(0, 8)
                : `${Date.now().toString(36)}-${++fallbackCounter}`
            return `${prefix}-${suffix}`
          }
          return uuid ?? `${Date.now().toString(36)}-${++fallbackCounter}`
        })
    }
  })

export const cryptoIdGeneratorLayer: Layer.Layer<IdGenerator> =
  makeUuidIdGeneratorLayer()
