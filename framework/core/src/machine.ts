import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Queue from "effect/Queue"
import type * as Scope from "effect/Scope"
import type * as Stream from "effect/Stream"
import * as SubscriptionRef from "effect/SubscriptionRef"

/**
 * Running handle to a scoped Effect state machine actor.
 * Mirrors the `Scoped Layer -> Send Command -> Subscription Stream` bridge pattern:
 * - `snapshot` reads the latest state synchronously inside Effect
 * - `changes` streams initial + subsequent state updates for `@effect/ui` Subscriptions
 * - `send` dispatches an event into the actor's mailbox (used by an `@effect/ui` Command)
 */
export interface ScopedMachineHandle<State, Event> {
  readonly snapshot: Effect.Effect<State>
  readonly changes: Stream.Stream<State>
  readonly send: (event: Event) => Effect.Effect<void>
}

export type ScopedMachineMode = "queue" | "switch"

export interface ScopedMachineDefinition<State, Event, R = never> {
  readonly initial: State
  readonly mode?: ScopedMachineMode | undefined
  readonly handle: (ctx: {
    readonly state: State
    readonly event: Event
    readonly setState: (next: State) => Effect.Effect<void>
    readonly send: (event: Event) => Effect.Effect<void>
  }) => Effect.Effect<void, never, R>
}

/**
 * Starts an effectful state machine actor bound to the enclosing `Scope`.
 * Intended to be wrapped in `Layer.effect(MyActorRef, startScopedMachine(...))`
 * and scoped to a component instance via `Component.provide(..., { local: true })`.
 */
export const startScopedMachine = <State, Event, R = never>(
  definition: ScopedMachineDefinition<State, Event, R>
): Effect.Effect<ScopedMachineHandle<State, Event>, never, R | Scope.Scope> =>
  Effect.gen(function* () {
    const mode = definition.mode ?? "queue"
    const stateRef = yield* SubscriptionRef.make(definition.initial)
    const mailbox = yield* Queue.unbounded<Event>()
    let activeTask: Fiber.Fiber<void, never> | undefined

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        if (activeTask !== undefined) {
          yield* Fiber.interrupt(activeTask)
          activeTask = undefined
        }
        yield* Queue.shutdown(mailbox)
      })
    )

    const setState = (next: State): Effect.Effect<void> =>
      SubscriptionRef.set(stateRef, next)

    const send = (event: Event): Effect.Effect<void> =>
      Queue.offer(mailbox, event).pipe(Effect.asVoid)

    const processEvent = (event: Event): Effect.Effect<void, never, R> =>
      Effect.gen(function* () {
        const state = yield* SubscriptionRef.get(stateRef)
        yield* definition.handle({ state, event, setState, send })
      })

    const worker = Effect.forever(
      Effect.gen(function* () {
        const event = yield* Queue.take(mailbox)
        if (mode === "switch") {
          if (activeTask !== undefined) {
            yield* Fiber.interrupt(activeTask)
          }
          activeTask = yield* Effect.forkScoped(processEvent(event))
        } else {
          yield* processEvent(event)
        }
      })
    )

    yield* Effect.forkScoped(worker)

    return {
      snapshot: SubscriptionRef.get(stateRef),
      changes: SubscriptionRef.changes(stateRef),
      send
    }
  })
