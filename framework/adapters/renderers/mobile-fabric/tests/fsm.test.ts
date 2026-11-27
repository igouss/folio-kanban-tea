import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createActiveTextField,
  initialPressGesture,
  initialRegistrationState,
  pressGrant,
  pressMove,
  pressRelease,
  pressTerminate,
  readTextFieldFallback,
  transitionPressGesture,
  transitionRegistration,
  transitionTextField,
  type PressGestureEvent,
  type PressGestureState,
  type RegistrationEvent,
  type RegistrationState,
  type TextFieldEvent,
  type TextFieldLifecycle
} from "../src/fsm.ts"

describe("@universal-ui/host-fabric FSMs", () => {
  it("enforces complete PressGestureState (state, event) transition matrix", () => {
    const states: Record<PressGestureState["_tag"], PressGestureState> = {
      Idle: initialPressGesture,
      Pressed: { _tag: "Pressed", origin: { x: 10, y: 10 } },
      Cancelled: { _tag: "Cancelled" }
    }

    const events: ReadonlyArray<{
      readonly name: string
      readonly event: PressGestureEvent
      readonly expected: Record<
        PressGestureState["_tag"],
        { readonly next: PressGestureState["_tag"]; readonly emit: boolean }
      >
    }> = [
      {
        name: "Grant",
        event: { _tag: "Grant", origin: { x: 20, y: 20 } },
        expected: {
          Idle: { next: "Pressed", emit: false },
          Pressed: { next: "Pressed", emit: false },
          Cancelled: { next: "Pressed", emit: false }
        }
      },
      {
        name: "Move(within-retention)",
        event: {
          _tag: "Move",
          point: { x: 14, y: 14 },
          size: { width: 40, height: 24 }
        },
        expected: {
          Idle: { next: "Idle", emit: false },
          Pressed: { next: "Pressed", emit: false },
          Cancelled: { next: "Cancelled", emit: false }
        }
      },
      {
        name: "Move(outside-retention)",
        event: {
          _tag: "Move",
          point: { x: 200, y: 200 },
          size: { width: 40, height: 24 }
        },
        expected: {
          Idle: { next: "Idle", emit: false },
          Pressed: { next: "Cancelled", emit: false },
          Cancelled: { next: "Cancelled", emit: false }
        }
      },
      {
        name: "Release",
        event: { _tag: "Release" },
        expected: {
          Idle: { next: "Idle", emit: false },
          Pressed: { next: "Idle", emit: true },
          Cancelled: { next: "Idle", emit: false }
        }
      },
      {
        name: "Terminate",
        event: { _tag: "Terminate" },
        expected: {
          Idle: { next: "Idle", emit: false },
          Pressed: { next: "Idle", emit: false },
          Cancelled: { next: "Idle", emit: false }
        }
      }
    ]

    for (const [stateTag, state] of Object.entries(states) as ReadonlyArray<
      [PressGestureState["_tag"], PressGestureState]
    >) {
      for (const row of events) {
        const res = transitionPressGesture(state, row.event)
        assert.equal(
          res.next._tag,
          row.expected[stateTag].next,
          `State mismatch for (${stateTag}, ${row.name})`
        )
        assert.equal(
          res.shouldEmitPress,
          row.expected[stateTag].emit,
          `Emit mismatch for (${stateTag}, ${row.name})`
        )
      }
    }

    // Convenience wrappers delegate faithfully
    let gesture = pressGrant({ x: 10, y: 10 })
    gesture = pressMove(gesture, { x: 12, y: 12 }, { width: 40, height: 24 })
    assert.equal(pressRelease(gesture).shouldEmitPress, true)
    assert.equal(pressTerminate(gesture)._tag, "Idle")
  })

  it("enforces complete immutable TextFieldLifecycle (state, event) transition matrix", () => {
    const active = createActiveTextField()
    const activeDrifted: TextFieldLifecycle = {
      _tag: "Active",
      desiredValue: "hello",
      lastNativeText: "hellox",
      eventCount: 2,
      writtenEventCount: 1
    }
    const disposed: TextFieldLifecycle = { _tag: "Disposed" }

    assert.equal(readTextFieldFallback(active), "")
    assert.equal(readTextFieldFallback(activeDrifted), "hellox")
    assert.equal(readTextFieldFallback(disposed), "")

    const cases: ReadonlyArray<{
      readonly name: string
      readonly event: TextFieldEvent
      readonly activeNext: TextFieldLifecycle["_tag"]
      readonly activeEffects: ReadonlyArray<string>
    }> = [
      {
        name: "SetDesired",
        event: { _tag: "SetDesired", desired: "world" },
        activeNext: "Active",
        activeEffects: [
          "SetTextProp",
          "SetMostRecentEventCount",
          "SchedulePostCommitReconcile"
        ]
      },
      {
        name: "ReceiveNative",
        event: { _tag: "ReceiveNative", text: "typed", eventCount: 3 },
        activeNext: "Active",
        activeEffects: ["EmitChangeText", "ScheduleFrameReconcile"]
      },
      {
        name: "Reconcile",
        event: { _tag: "Reconcile" },
        activeNext: "Active",
        activeEffects: ["DispatchSetTextAndSelection"]
      },
      {
        name: "Dispose",
        event: { _tag: "Dispose" },
        activeNext: "Disposed",
        activeEffects: []
      }
    ]

    for (const row of cases) {
      const a = transitionTextField(activeDrifted, row.event)
      assert.equal(a.next._tag, row.activeNext, `Active mismatch for ${row.name}`)
      assert.deepEqual(
        a.effects.map((e) => e._tag),
        row.activeEffects,
        `Active effects mismatch for ${row.name}`
      )

      // Disposed is terminal and produces zero effects for every event
      const d = transitionTextField(disposed, row.event)
      assert.equal(d.next._tag, "Disposed", `Disposed mismatch for ${row.name}`)
      assert.equal(d.effects.length, 0, `Disposed effects mismatch for ${row.name}`)
    }
  })

  it("enforces complete RegistrationState (state, event) transition matrix", () => {
    const dispose1 = () => {}
    const dispose2 = () => {}

    const states: Record<RegistrationState["_tag"], RegistrationState> = {
      Stopped: initialRegistrationState,
      Running: { _tag: "Running", surfaceId: 10, dispose: dispose1 }
    }

    const cases: ReadonlyArray<{
      readonly name: string
      readonly event: RegistrationEvent
      readonly expected: Record<
        RegistrationState["_tag"],
        {
          readonly next: RegistrationState["_tag"]
          readonly runsPreviousDispose: boolean
        }
      >
    }> = [
      {
        name: "Start",
        event: { _tag: "Start", surfaceId: 20, dispose: dispose2 },
        expected: {
          Stopped: { next: "Running", runsPreviousDispose: false },
          Running: { next: "Running", runsPreviousDispose: true }
        }
      },
      {
        name: "Stop",
        event: { _tag: "Stop" },
        expected: {
          Stopped: { next: "Stopped", runsPreviousDispose: false },
          Running: { next: "Stopped", runsPreviousDispose: true }
        }
      },
      {
        name: "StopSurface(matching)",
        event: { _tag: "StopSurface", surfaceId: 10 },
        expected: {
          Stopped: { next: "Stopped", runsPreviousDispose: false },
          Running: { next: "Stopped", runsPreviousDispose: true }
        }
      },
      {
        name: "StopSurface(non-matching)",
        event: { _tag: "StopSurface", surfaceId: 99 },
        expected: {
          Stopped: { next: "Stopped", runsPreviousDispose: false },
          Running: { next: "Running", runsPreviousDispose: false }
        }
      }
    ]

    for (const [stateTag, state] of Object.entries(states) as ReadonlyArray<
      [RegistrationState["_tag"], RegistrationState]
    >) {
      for (const row of cases) {
        const res = transitionRegistration(state, row.event)
        assert.equal(
          res.next._tag,
          row.expected[stateTag].next,
          `State mismatch for (${stateTag}, ${row.name})`
        )
        assert.equal(
          res.disposeToRun !== undefined,
          row.expected[stateTag].runsPreviousDispose,
          `Dispose mismatch for (${stateTag}, ${row.name})`
        )
      }
    }
  })
})
