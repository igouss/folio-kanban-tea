import type { BoardRepository } from "@folio/kanban-domain/ports"
import type { IdGenerator } from "@universal-ui/core"
import * as Layer from "effect/Layer"
import {
  MintCardMeta,
  MintedCardMetaSchema,
  PositiveRequestIdSchema,
  type MintedCardMeta
} from "./MintCardMeta.ts"
import { SaveBoard } from "./SaveBoard.ts"

export {
  MintCardMeta,
  MintedCardMetaSchema,
  PositiveRequestIdSchema,
  SaveBoard,
  type MintedCardMeta
}

/**
 * Pure application command layer.
 * Requires ONLY the domain BoardRepository port and framework IdGenerator port —
 * completely unbraided from KeyValueStore or any storage implementation.
 */
export const kanbanCommandsLayer: Layer.Layer<
  SaveBoard | MintCardMeta,
  never,
  BoardRepository | IdGenerator
> = Layer.mergeAll(SaveBoard.layer, MintCardMeta.layer)
