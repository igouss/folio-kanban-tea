import { Command } from "@effect/ui"
import { LaneId } from "@folio/kanban-domain/schema"
import { IdGenerator } from "@universal-ui/core"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

export const MintedCardMetaSchema = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  title: Schema.String,
  lane: LaneId,
  tag: Schema.String
})
export type MintedCardMeta = typeof MintedCardMetaSchema.Type

/**
 * Application command that mints a card's identity and creation timestamp
 * using the IdGenerator port and Effect Clock.
 */
export class MintCardMeta extends Command.Service<MintCardMeta>()(
  "folio/MintCardMeta",
  {
    args: {
      title: Schema.String,
      lane: LaneId,
      tag: Schema.String
    },
    success: MintedCardMetaSchema
  }
) {
  static readonly layer: Layer.Layer<MintCardMeta, never, IdGenerator> =
    this.toLayer(
      Effect.gen(function* () {
        const ids = yield* IdGenerator
        return ({ title, lane, tag }) =>
          Effect.gen(function* () {
            const id = yield* ids.nextId(`${tag}-card`)
            const now = yield* Clock.currentTimeMillis
            return {
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
