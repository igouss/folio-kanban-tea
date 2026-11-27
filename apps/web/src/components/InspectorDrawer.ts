import { CloseIcon, TrashIcon } from "#components/Icons"
import { TraceEntry, TraceKind } from "#domain/Telemetry"
import { TraceBus } from "#services/TraceBus"
import { Command, Subscription, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { Effect, Schema, Stream } from "effect"

const TraceFilter = Schema.Literals([
  "All",
  "Update",
  "Command",
  "Query",
  "Lifecycle"
])
type TraceFilter = typeof TraceFilter.Type

export const InspectorDrawerMessage = UiSchema.TaggedEnum({
  LoadedSnapshot: { entries: Schema.Array(TraceEntry) },
  RecordedTrace: { entry: TraceEntry },
  ClickedFilter: { filter: TraceFilter },
  ClickedClear: {},
  ClickedClose: {}
})

export const InspectorDrawerEvents = UiSchema.TaggedEnum({
  RequestedClose: {}
})

export class LoadTraceSnapshot extends Command.Service<LoadTraceSnapshot>()(
  "folio/LoadTraceSnapshot",
  {
    success: InspectorDrawerMessage
  }
) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const bus = yield* TraceBus
      return () =>
        bus.snapshot.pipe(
          Effect.map((entries) =>
            InspectorDrawerMessage.LoadedSnapshot({ entries })
          )
        )
    })
  )
}

export class ClearTraces extends Command.Service<ClearTraces>()(
  "folio/ClearTraces",
  {}
) {
  static readonly layer = this.toLayer(
    Effect.gen(function*() {
      const bus = yield* TraceBus
      return () => bus.clear
    })
  )
}

const filters: ReadonlyArray<TraceFilter> = [
  "All",
  "Update",
  "Command",
  "Query",
  "Lifecycle"
]

const kindBadgeClass = (kind: TraceKind): string => {
  switch (kind) {
    case "Update":
      return "trace-kind-update"
    case "Command":
      return "trace-kind-command"
    case "Query":
      return "trace-kind-query"
    case "Lifecycle":
      return "trace-kind-lifecycle"
  }
}

export const InspectorDrawer = Html.component({
  name: "InspectorDrawer",
  model: Schema.Struct({
    entries: Schema.Array(TraceEntry),
    filter: TraceFilter
  }),
  message: InspectorDrawerMessage,
  events: InspectorDrawerEvents,
  restore: false
}).make({
  init: ($) =>
    $.set({ entries: [], filter: "All" as const }).run(LoadTraceSnapshot.make()),
  update: {
    LoadedSnapshot: ($, { entries }) => $.evolve({ entries }),
    RecordedTrace: ($, { entry }) =>
      $.evolve({
        entries: (current) => {
          if (current.some((item) => item.seq === entry.seq)) return current
          return [entry, ...current].slice(0, 80)
        }
      }),
    ClickedFilter: ($, { filter }) => $.evolve({ filter }),
    ClickedClear: ($) => $.evolve({ entries: [] }).run(ClearTraces.make()),
    ClickedClose: ($) => $.emit(InspectorDrawerEvents.RequestedClose())
  },
  subscriptions: () => [
    Subscription.make(
      "trace-stream",
      Stream.unwrap(
        Effect.map(TraceBus, (bus) =>
          bus.stream.pipe(
            Stream.map((entry) =>
              InspectorDrawerMessage.RecordedTrace({ entry })
            )
          )
        )
      )
    )
  ],
  view: (h, model) => {
    const visible =
      model.filter === "All"
        ? model.entries
        : model.entries.filter((entry) => entry.kind === model.filter)

    return h.aside
      .class("inspector-drawer")
      .attr("aria-label", "Live Elm Architecture Message Log")
      .children(
        h.div.class("inspector-header").children(
          h.div.class("inspector-title-block").children(
            h.span.class("inspector-eyebrow").children("@effect/ui MessageLog"),
            h.h2.class("inspector-title").children("MVU Runtime Trace")
          ),
          h.div.class("inspector-header-actions").children(
            h.button
              .class("icon-btn")
              .attrs({
                type: "button",
                title: "Clear log",
                "aria-label": "Clear message log"
              })
              .on("click", InspectorDrawerMessage.ClickedClear())
              .children(TrashIcon(h, 14)),
            h.button
              .class("icon-btn")
              .attrs({
                type: "button",
                title: "Close inspector (I)",
                "aria-label": "Close inspector"
              })
              .on("click", InspectorDrawerMessage.ClickedClose())
              .children(CloseIcon(h, 15))
          )
        ),
        h.p.class("inspector-subtitle").children(
          "Live stream from the runtime MessageLog service — every message, Command, and Query transition."
        ),
        h.div.class("inspector-filters").children(
          filters.map((filter) =>
            h.button
              .key(filter)
              .class("filter-pill", model.filter === filter && "is-active")
              .attr("type", "button")
              .on("click", InspectorDrawerMessage.ClickedFilter({ filter }))
              .children(filter)
          )
        ),
        h.div.class("inspector-list").children(
          visible.length === 0
            ? h.p
                .class("inspector-empty")
                .children("Interact with the board to see Elm messages flow.")
            : visible.map((entry) =>
                h.div.key(String(entry.seq)).class("trace-row").children(
                  h.div.class("trace-row-top").children(
                    h.span
                      .class("trace-kind", kindBadgeClass(entry.kind))
                      .children(entry.kind),
                    h.span.class("trace-label").children(entry.label),
                    h.span.class("trace-time").children(`#${entry.seq} · ${entry.time}`)
                  ),
                  h.div.class("trace-row-bottom").children(
                    h.span.class("trace-path").children(entry.path),
                    h.span.class("trace-detail").children(entry.detail)
                  )
                )
              )
        )
      )
  }
})
