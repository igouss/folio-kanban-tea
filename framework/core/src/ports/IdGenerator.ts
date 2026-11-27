import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/**
 * Outbound port for generating unique entity identifiers.
 */
export class IdGenerator extends Context.Service<IdGenerator, {
  readonly nextId: (prefix?: string) => Effect.Effect<string>
}>()("@universal-ui/core/IdGenerator") {}

export const makeSequenceIdGeneratorLayer = (
  defaultPrefix = "id"
): Layer.Layer<IdGenerator> => {
  let counter = 0
  return Layer.succeed(IdGenerator, {
    nextId: (prefix) =>
      Effect.sync(() => {
        counter += 1
        return `${prefix ?? defaultPrefix}-${counter}`
      })
  })
}
