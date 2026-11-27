import { Command, Component, Subscription, UiSchema } from "@effect/ui"
import { BoardRepository } from "@folio/kanban-domain/ports"
import { SavedBoardSchema, ThemeMode } from "@folio/kanban-domain/schema"
import {
  Ui,
  startScopedMachine,
  type ScopedMachineHandle
} from "@universal-ui/core"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { paletteFor } from "../theme.ts"
import { secondaryButtonStyle } from "../views/controls.ts"

export const SyncSnapshotSchema = Schema.TaggedUnion({
  Idle: {},
  Syncing: {},
  Synced: {
    savedAt: Schema.String,
    cardCount: Schema.Number
  },
  Failed: {
    reason: Schema.String
  }
})
export type SyncSnapshot = typeof SyncSnapshotSchema.Type

export const SyncEventSchema = UiSchema.TaggedEnum({
  SyncRequested: { board: SavedBoardSchema },
  Reset: {}
})
export type SyncEvent = typeof SyncEventSchema.Type

/**
 * 1. Scoped Effect Layer running the board sync state machine on its own fiber.
 */
export class SyncActorRef extends Context.Service<
  SyncActorRef,
  ScopedMachineHandle<SyncSnapshot, SyncEvent>
>()("@folio/kanban-app/SyncActorRef") {
  static readonly live: Layer.Layer<SyncActorRef, never, BoardRepository> =
    Layer.effect(
      SyncActorRef,
      Effect.gen(function* () {
        const repo = yield* BoardRepository
        return yield* startScopedMachine<SyncSnapshot, SyncEvent>({
          initial: { _tag: "Idle" },
          mode: "switch",
          handle: ({ event, setState }) =>
            SyncEventSchema.match(event, {
              Reset: () => setState({ _tag: "Idle" }),
              SyncRequested: ({ board }) =>
                Effect.gen(function* () {
                  yield* setState({ _tag: "Syncing" })
                  yield* repo.save(board)
                  const now = yield* Clock.currentTimeMillis
                  yield* setState({
                    _tag: "Synced",
                    savedAt: new Date(now).toISOString(),
                    cardCount: board.cards.length
                  })
                }).pipe(
                  Effect.catchCause((cause) =>
                    setState({
                      _tag: "Failed",
                      reason: String(cause)
                    })
                  )
                )
            })
        })
      })
    )
}

/**
 * 2. Dispatch machine events through an @effect/ui Command (keeps `update` pure).
 */
export class SendSyncEvent extends Command.Service<SendSyncEvent>()(
  "folio/SendSyncEvent",
  {
    args: { event: SyncEventSchema },
    success: Schema.Void
  }
) {
  static readonly layer: Layer.Layer<SendSyncEvent, never, SyncActorRef> =
    this.toLayer(
      Effect.map(SyncActorRef, (ref) => ({ event }) => ref.send(event))
    )
}

export const SyncStatusProps = Schema.Struct({
  board: SavedBoardSchema,
  theme: ThemeMode
})
export type SyncStatusProps = typeof SyncStatusProps.Type

export const SyncStatusMessage = UiSchema.TaggedEnum({
  Send: { event: SyncEventSchema },
  Synced: { state: SyncSnapshotSchema }
})
export type SyncStatusMessage = typeof SyncStatusMessage.Type

/**
 * 3. Thin @effect/ui projection component over the scoped sync actor.
 * Exported unwrapped for unit `Story` tests where `SendSyncEvent` is asserted directly.
 */
export const SyncStatusBase = Ui.component({
  name: "SyncStatus",
  props: SyncStatusProps,
  model: SyncSnapshotSchema,
  message: SyncStatusMessage
}).make({
  init: () => ({ _tag: "Idle" }),

  update: ($, message) =>
    SyncStatusMessage.match(message, {
      Send: ({ event }) => $.run(SendSyncEvent.make({ event }).pipe(Command.asNoop)),
      Synced: ({ state }) => $.set(state)
    }),

  subscriptions: () => [
    Subscription.make(
      "sync-machine",
      Stream.unwrap(Effect.map(SyncActorRef, (ref) => ref.changes)).pipe(
        Stream.map((state) => SyncStatusMessage.Synced({ state }))
      )
    )
  ],

  view: (h, state) => {
    const p = paletteFor(h.props.theme)
    const isSyncing = SyncSnapshotSchema.guards.Syncing(state)
    const statusLabel = SyncSnapshotSchema.match(state, {
      Idle: () => "Local sync ready",
      Syncing: () => "Syncing...",
      Synced: ({ cardCount }) => `Synced · ${cardCount} cards`,
      Failed: () => "Sync failed"
    })
    const statusColor = SyncSnapshotSchema.match(state, {
      Idle: () => p.inkMuted,
      Syncing: () => p.inkSoft,
      Synced: () => p.pine,
      Failed: () => p.accent
    })

    return h.box
      .style({
        flexDirection: "row",
        alignItems: "center",
        gap: 8
      })
      .children(
        h.text
          .testId("sync.status")
          .style({ fontSize: 11.5, fontWeight: "600", color: statusColor })
          .children(statusLabel),
        h.button
          .testId("sync.trigger")
          .ariaLabel("Sync board now")
          .disabled(isSyncing)
          .style(secondaryButtonStyle(p, 8))
          .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
          .on(
            "press",
            SyncStatusMessage.Send({
              event: SyncEventSchema.SyncRequested({ board: h.props.board })
            })
          )
          .children(
            h.text
              .style({ fontSize: 11, fontWeight: "600", color: p.ink })
              .children(
                SyncSnapshotSchema.guards.Failed(state) ? "Retry sync" : "Sync"
              )
          )
      )
  }
})

/**
 * 4. Bind the sync actor & command layer directly to this component instance's Scope
 * so mounting creates an isolated actor and unmounting cleans up its fiber automatically.
 */
export const SyncStatus = SyncStatusBase.pipe(
  Component.provide(
    Layer.provideMerge(SendSyncEvent.layer, SyncActorRef.live),
    { local: true }
  )
)
