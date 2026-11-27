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

let fallbackCounter = 0

export const cryptoIdGeneratorLayer: Layer.Layer<IdGenerator> = Layer.succeed(
  IdGenerator,
  {
    nextId: (prefix) =>
      Effect.sync(() => {
        const suffix =
          typeof globalThis.crypto?.randomUUID === "function"
            ? globalThis.crypto.randomUUID().slice(0, 8)
            : `${Date.now().toString(36)}-${++fallbackCounter}`
        return prefix !== undefined && prefix.length > 0
          ? `${prefix}-${suffix}`
          : suffix
      })
  }
)
