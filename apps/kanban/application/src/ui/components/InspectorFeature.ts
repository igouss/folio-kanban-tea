import { Feature, MessageLog, Subscription, UiSchema } from "@effect/ui"
import { ThemeMode } from "@folio/kanban-domain/schema"
import { Ui } from "@universal-ui/core"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { paletteFor } from "../theme.ts"
import { secondaryButtonStyle } from "../views/controls.ts"

const MAX_TRACE_ENTRIES = 24
const INSPECTOR_COMPONENT_NAME = "InspectorPanel"

export const InspectorProps = Schema.Struct({
  theme: ThemeMode,
  dispatchCount: Schema.Number,
  undoDepth: Schema.Number,
  redoDepth: Schema.Number
})
export type InspectorProps = typeof InspectorProps.Type

export const InspectorEvents = UiSchema.TaggedEnum({
  Closed: {}
})
export type InspectorEvents = typeof InspectorEvents.Type

/**
 * Swappable @effect/ui Feature service for the MVU Trace Inspector drawer.
 * Desktop & Web wire `liveInspectorLayer` (backed by @effect/ui MessageLog),
 * while Mobile or production builds can wire `noopInspectorLayer`.
 */
export class InspectorFeature extends Feature.Service<InspectorFeature>()(
  "folio/Inspector",
  {
    props: InspectorProps,
    events: InspectorEvents
  }
) {}

/**
 * Read-only stream of formatted @effect/ui MessageLog trace lines.
 */
export class TraceFeed extends Context.Service<
  TraceFeed,
  {
    readonly snapshot: Effect.Effect<ReadonlyArray<string>>
    readonly changes: Stream.Stream<ReadonlyArray<string>>
  }
>()("@folio/kanban-app/TraceFeed") {}

const formatMessageLogEntry = (entry: MessageLog.Entry): string | undefined => {
  if ("component" in entry) {
    const componentName = entry.component.definition.name
    if (componentName === INSPECTOR_COMPONENT_NAME) {
      return undefined
    }
    switch (entry._tag) {
      case "Update": {
        const msg = entry.message as { readonly _tag?: string } | undefined
        const tag =
          typeof msg?._tag === "string" ? msg._tag : String(entry.message)
        return `#${entry.seq} ${componentName} · ${tag}`
      }
      case "CommandStarted":
        return `#${entry.seq} ${componentName} · cmd:${entry.name}`
      case "CommandEnded":
        return `#${entry.seq} ${componentName} · done:${entry.name}`
      case "Mounted":
        return `#${entry.seq} ${componentName} · Mounted`
      case "Unmounted":
        return `#${entry.seq} ${componentName} · Unmounted`
      default:
        return undefined
    }
  }
  return undefined
}

/**
 * Provides both @effect/ui's `MessageLog.MessageLog` reference and a reactive
 * `TraceFeed` backed by `MessageLog.makeMemory`.
 */
export const makeMessageLogTraceLayer = (options?: {
  readonly memorySize?: number | undefined
  readonly maxEntries?: number | undefined
}): Layer.Layer<TraceFeed> => {
  const memorySize = options?.memorySize ?? 128
  const maxEntries = options?.maxEntries ?? MAX_TRACE_ENTRIES

  return Layer.effectContext(
    Effect.sync(() => {
      const memory = MessageLog.makeMemory({ size: memorySize })
      let recent: ReadonlyArray<string> = []
      const listeners = new Set<(entries: ReadonlyArray<string>) => void>()

      const log: MessageLog.MessageLog = {
        enabled: true,
        record: (entry) => {
          memory.record(entry)
          const formatted = formatMessageLogEntry(entry)
          if (formatted === undefined) return
          recent = [formatted, ...recent.slice(0, maxEntries - 1)]
          for (const listener of listeners) {
            listener(recent)
          }
        }
      }

      const feed: Context.Service.Shape<typeof TraceFeed> = {
        snapshot: Effect.sync(() => recent),
        changes: Stream.callback<ReadonlyArray<string>>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              Queue.offerUnsafe(queue, recent)
              const listener = (entries: ReadonlyArray<string>) => {
                Queue.offerUnsafe(queue, entries)
              }
              listeners.add(listener)
              return () => {
                listeners.delete(listener)
              }
            }),
            (cleanup) => Effect.sync(cleanup)
          )
        )
      }

      return Context.make(TraceFeed, feed).pipe(
        Context.add(MessageLog.MessageLog, log)
      )
    })
  )
}

const LiveInspectorModel = Schema.Struct({
  entries: Schema.Array(Schema.String)
})

const LiveInspectorMessage = UiSchema.TaggedEnum({
  EntriesUpdated: { entries: Schema.Array(Schema.String) },
  ClickedClose: {}
})

/**
 * Live MVU Trace Inspector component subscribing to @effect/ui's MessageLog
 * via `TraceFeed`.
 */
export const LiveInspector = Ui.component({
  name: INSPECTOR_COMPONENT_NAME,
  props: InspectorProps,
  model: LiveInspectorModel,
  message: LiveInspectorMessage,
  events: InspectorEvents
}).make({
  init: () => ({ entries: [] }),

  subscriptions: () => [
    Subscription.make(
      "message-log-trace",
      Stream.unwrap(
        Effect.map(TraceFeed, (feed) =>
          feed.changes.pipe(
            Stream.map((entries) =>
              LiveInspectorMessage.EntriesUpdated({ entries: [...entries] })
            )
          )
        )
      )
    )
  ],

  update: ($, message) =>
    LiveInspectorMessage.match(message, {
      EntriesUpdated: ({ entries }) => $.set({ entries }),
      ClickedClose: () => $.emit(InspectorEvents.Closed())
    }),

  view: (h, model) => {
    const p = paletteFor(h.props.theme)
    return h.box
      .testId("inspector.panel")
      .role("complementary")
      .ariaLabel("MVU Runtime Trace")
      .style({
        width: 280,
        minWidth: 260,
        height: "100%",
        flexDirection: "column",
        backgroundColor: p.topbar,
        borderLeftWidth: 1,
        borderColor: p.rule
      })
      .children(
        h.box
          .style({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderColor: p.rule
          })
          .children(
            h.text
              .style({ fontSize: 12.5, fontWeight: "700", color: p.ink })
              .children(`MVU Trace (${h.props.dispatchCount})`),
            h.button
              .testId("inspector.close")
              .ariaLabel("Close MVU trace")
              .style(secondaryButtonStyle(p, 8))
              .on("press", LiveInspectorMessage.ClickedClose())
              .children(
                h.text
                  .style({ fontSize: 11, fontWeight: "600", color: p.inkSoft })
                  .children("Close")
              )
          ),
        h.box
          .style({
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderColor: p.rule,
            backgroundColor: p.surfaceAlt
          })
          .children(
            h.text
              .style({ fontSize: 11, fontWeight: "600", color: p.inkSoft })
              .children(`Undo stack: ${h.props.undoDepth}`),
            h.text
              .style({ fontSize: 11, fontWeight: "600", color: p.inkSoft })
              .children(`Redo stack: ${h.props.redoDepth}`)
          ),
        h.scroll
          .style({
            flex: 1,
            padding: 12
          })
          .children(
            h.box
              .collapsable(false)
              .style({ flexDirection: "column", gap: 6 })
              .children(
                model.entries.length === 0
                  ? h.text
                      .style({ fontSize: 11.5, color: p.inkMuted })
                      .children(
                        "Interact with the board to stream @effect/ui MessageLog entries."
                      )
                  : model.entries.map((entry, idx) =>
                      h.box
                        .key(`trace-${idx}`)
                        .style({
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: p.rule,
                          backgroundColor: p.card
                        })
                        .children(
                          h.text
                            .style({ fontSize: 11, color: p.inkSoft })
                            .children(entry)
                        )
                    )
              )
          )
      )
  }
})

/**
 * Lightweight no-op implementation of `InspectorFeature` for platforms or
 * production builds that don't include the runtime trace drawer.
 */
export const NoopInspector = Ui.component({
  name: "NoopInspector",
  props: InspectorProps,
  model: Schema.Struct({}),
  message: Schema.Never,
  events: InspectorEvents
}).make({
  init: () => ({}),
  update: ($) => $.model,
  view: (h) => h.box.style({ display: "none" })
})

export const liveInspectorLayer: Layer.Layer<InspectorFeature | TraceFeed> =
  Layer.provideMerge(
    InspectorFeature.toLayer(LiveInspector),
    makeMessageLogTraceLayer()
  )

export const noopInspectorLayer: Layer.Layer<InspectorFeature> =
  InspectorFeature.toLayer(NoopInspector)
