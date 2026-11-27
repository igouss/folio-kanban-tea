import { Schema } from "effect"

export const TraceKind = Schema.Literals([
  "Update",
  "Command",
  "Query",
  "Lifecycle"
])
export type TraceKind = typeof TraceKind.Type

export const TraceEntry = Schema.Struct({
  seq: Schema.Number,
  kind: TraceKind,
  path: Schema.String,
  label: Schema.String,
  detail: Schema.String,
  time: Schema.String
})
export type TraceEntry = typeof TraceEntry.Type
