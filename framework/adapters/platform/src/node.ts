import { randomUUID } from "node:crypto"
import {
  type IdGenerator,
  staticLifecycleLayer,
  staticViewportLayer
} from "@universal-ui/core"
import type * as Layer from "effect/Layer"
import { makeUuidIdGeneratorLayer } from "./memory.ts"

export { staticLifecycleLayer, staticViewportLayer }

export const nodeIdGeneratorLayer: Layer.Layer<IdGenerator> =
  makeUuidIdGeneratorLayer(randomUUID)
