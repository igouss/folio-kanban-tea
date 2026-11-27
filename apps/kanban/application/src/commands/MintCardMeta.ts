import { Command } from "@effect/ui"
import {
  CardIdSchema,
  CardTitleSchema,
  LaneId
} from "@folio/kanban-domain/schema"
import { IdGenerator } from "@universal-ui/core"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { PositiveRequestIdSchema } from "../state/index.ts"

export { PositiveRequestIdSchema }

export const MintedCardMetaSchema = Schema.Struct({
  requestId: PositiveRequestIdSchema,
  id: CardIdSchema,
  createdAt: Schema.String,
  title: CardTitleSchema,
  lane: LaneId,
  tag: Schema.String
})
export type MintedCardMeta = typeof MintedCardMetaSchema.Type

/**
 * Application command that mints a card's identity and creation timestamp
 * using the IdGenerator port and Effect Clock, carrying the caller's
 * correlation `requestId` so stale async completions are ignored.
 * Runs in `"switch"` mode so newer submissions interrupt stale in-flight mints,
 * and surfaces invalid IDs on the typed error channel rather than as defects.
 */
export class MintCardMeta extends Command.Service<MintCardMeta>()(
  "folio/MintCardMeta",
  {
    args: {
      requestId: PositiveRequestIdSchema,
      title: CardTitleSchema,
      lane: LaneId,
      tag: Schema.String
    },
    success: MintedCardMetaSchema,
    error: Schema.String,
    mode: "switch"
  }
) {
  static readonly layer: Layer.Layer<MintCardMeta, never, IdGenerator> =
    this.toLayer(
      Effect.gen(function* () {
        const ids = yield* IdGenerator
        return ({ requestId, title, lane, tag }) =>
          Effect.gen(function* () {
            const rawId = yield* ids.nextId(`${tag}-card`)
            const id = yield* Schema.decodeUnknownEffect(CardIdSchema)(
              rawId.trim()
            ).pipe(Effect.mapError((error) => error.message))
            const now = yield* Clock.currentTimeMillis
            return {
              requestId,
              id,
              createdAt: new Date(now).toISOString(),
              title,
              lane,
              tag
            }
          })
      })
    )
}
