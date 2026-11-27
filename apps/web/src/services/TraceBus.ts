import type { TraceEntry } from "#domain/Telemetry"
import { MessageLog } from "@effect/ui"
import { Context, Effect, Layer, Queue, Stream } from "effect"

type Listener = (entry: TraceEntry) => void

const formatTime = (ms: number): string => {
  const date = new Date(ms)
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

const tagOf = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value !== null && typeof value === "object" && "_tag" in value) {
    const tag = (value as { readonly _tag?: unknown })._tag
    if (typeof tag === "string") return tag
  }
  return "Message"
}

const summarizeMessage = (value: unknown): string => {
  if (value === null || typeof value !== "object") return String(value)
  const keys = Object.keys(value as Record<string, unknown>).filter(
    (k) => k !== "_tag"
  )
  if (keys.length === 0) return "—"
  return keys
    .slice(0, 3)
    .map((key) => {
      const raw = (value as Record<string, unknown>)[key]
      if (typeof raw === "string") {
        const clipped = raw.length > 22 ? `${raw.slice(0, 22)}…` : raw
        return `${key}="${clipped}"`
      }
      if (typeof raw === "number" || typeof raw === "boolean") {
        return `${key}=${String(raw)}`
      }
      if (raw !== null && typeof raw === "object" && "_tag" in raw) {
        return `${key}=${tagOf(raw)}`
      }
      return key
    })
    .join(" ")
}

const toTraceEntry = (entry: MessageLog.Entry): TraceEntry | undefined => {
  if ("path" in entry && entry.path.includes("InspectorDrawer")) {
    return undefined
  }

  switch (entry._tag) {
    case "Update": {
      const msgTag = tagOf(entry.message)
      const cmds =
        entry.commands.length > 0
          ? ` → ${entry.commands.length} cmd`
          : ""
      const detail = `${entry.source._tag} · ${summarizeMessage(entry.message)}${cmds}`
      return {
        seq: entry.seq,
        kind: "Update",
        path: entry.path,
        label: msgTag,
        detail,
        time: formatTime(entry.at)
      }
    }
    case "CommandStarted":
      return {
        seq: entry.seq,
        kind: "Command",
        path: entry.path,
        label: `▶ ${entry.name}`,
        detail: "Command started",
        time: formatTime(entry.at)
      }
    case "CommandEnded":
      return {
        seq: entry.seq,
        kind: "Command",
        path: entry.path,
        label: `✓ ${entry.name}`,
        detail: entry.silent ? "Completed (silent)" : "Completed → message",
        time: formatTime(entry.at)
      }
    case "QueryChanged":
      return {
        seq: entry.seq,
        kind: "Query",
        path: entry.path,
        label: `query:${entry.name}`,
        detail: `State → ${tagOf(entry.result)}`,
        time: formatTime(entry.at)
      }
    case "Mounted":
      return {
        seq: entry.seq,
        kind: "Lifecycle",
        path: entry.path,
        label: "Mounted",
        detail: entry.component.definition.name,
        time: formatTime(entry.at)
      }
    case "Unmounted":
      return {
        seq: entry.seq,
        kind: "Lifecycle",
        path: entry.path,
        label: "Unmounted",
        detail: entry.component.definition.name,
        time: formatTime(entry.at)
      }
    default:
      return undefined
  }
}

export class TraceBus extends Context.Service<TraceBus, {
  readonly snapshot: Effect.Effect<ReadonlyArray<TraceEntry>>
  readonly stream: Stream.Stream<TraceEntry>
  readonly clear: Effect.Effect<void>
}>()("folio/TraceBus") {
  static readonly makeLive = (): {
    readonly busLayer: Layer.Layer<TraceBus>
    readonly messageLogLayer: Layer.Layer<never>
  } => {
    const buffer: Array<TraceEntry> = []
    const listeners = new Set<Listener>()
    const maxEntries = 80

    const push = (trace: TraceEntry) => {
      buffer.unshift(trace)
      if (buffer.length > maxEntries) buffer.pop()
      for (const listener of listeners) {
        listener(trace)
      }
    }

    const log: MessageLog.MessageLog = {
      enabled: true,
      record: (entry) => {
        const trace = toTraceEntry(entry)
        if (trace !== undefined) {
          // Defer notification to a microtask so dispatching to InspectorDrawer
          // never happens re-entrantly inside another component's flush.
          queueMicrotask(() => push(trace))
        }
      }
    }

    const bus = TraceBus.of({
      snapshot: Effect.sync(() => [...buffer]),
      stream: Stream.callback<TraceEntry>((queue) =>
        Effect.gen(function*() {
          const onEntry: Listener = (entry) => {
            Queue.offerUnsafe(queue, entry)
          }
          listeners.add(onEntry)
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              listeners.delete(onEntry)
            })
          )
        })
      ),
      clear: Effect.sync(() => {
        buffer.length = 0
      })
    })

    return {
      busLayer: Layer.succeed(TraceBus, bus),
      messageLogLayer: Layer.succeed(MessageLog.MessageLog, log)
    }
  }

  static readonly layerEmpty = Layer.succeed(
    TraceBus,
    TraceBus.of({
      snapshot: Effect.succeed([]),
      stream: Stream.empty,
      clear: Effect.void
    })
  )
}
