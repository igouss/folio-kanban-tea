import { randomUUID } from "node:crypto"
import {
  IdGenerator,
  staticLifecycleLayer,
  staticViewportLayer
} from "@universal-ui/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export { staticLifecycleLayer, staticViewportLayer }

export const nodeIdGeneratorLayer: Layer.Layer<IdGenerator> = Layer.succeed(
  IdGenerator,
  {
    nextId: (prefix) =>
      Effect.sync(() =>
        prefix !== undefined && prefix.length > 0
          ? `${prefix}-${randomUUID().slice(0, 8)}`
          : randomUUID()
      )
  }
)
