import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  NUDGE,
  completeInputNudge,
  detachInputValue,
  initialInputValueState,
  readSubmittedInputValue,
  receiveNativeInputValue,
  syncDesiredInputValue,
  transitionInputValue,
  type InputValueEvent,
  type InputValueState
} from "../src/fsm.ts"

describe("@universal-ui/host-gpui InputValueState FSM", () => {
  it("transitions Uninitialized -> Synced -> Nudged -> Synced and strips nudge on native echo", () => {
    let state: InputValueState = initialInputValueState

    // Initial controlled write sends directly
    const first = syncDesiredInputValue(state, "abc")
    assert.deepEqual(first.action, { _tag: "Set", value: "abc" })
    state = first.next
    assert.equal(state._tag, "Synced")

    // Identical sync is a no-op
    assert.deepEqual(syncDesiredInputValue(state, "abc").action, { _tag: "Noop" })

    // Native drifts while controlled value stays "abc": triggers two-phase nudge
    state = receiveNativeInputValue(state, "abcd").next
    const nudged = syncDesiredInputValue(state, "abc")
    assert.deepEqual(nudged.action, {
      _tag: "NudgeThenReset",
      nudged: `abc${NUDGE}`,
      desired: "abc"
    })
    state = nudged.next
    assert.equal(state._tag, "Nudged")

    // Submitted value strips trailing nudge character
    assert.equal(readSubmittedInputValue(state, `abc${NUDGE}`), "abc")

    // Completing nudge with mismatched expectedNudged is ignored
    const wrongToken = completeInputNudge(state, `other${NUDGE}`)
    assert.equal(wrongToken.resetValue, undefined)
    assert.equal(wrongToken.next._tag, "Nudged")

    // Completing nudge resets cleanly to Synced
    const done = completeInputNudge(state, `abc${NUDGE}`)
    assert.equal(done.resetValue, "abc")
    assert.equal(done.next._tag, "Synced")

    // Detached is terminal and ignores sync & stale nudge timers
    const detached = detachInputValue(state)
    assert.equal(detached._tag, "Detached")
    assert.deepEqual(syncDesiredInputValue(detached, "x").action, { _tag: "Noop" })
    assert.equal(completeInputNudge(detached, `abc${NUDGE}`).resetValue, undefined)
  })

  it("enforces complete InputValueState (state, event) transition matrix", () => {
    const states: Record<InputValueState["_tag"], InputValueState> = {
      Uninitialized: { _tag: "Uninitialized" },
      Synced: { _tag: "Synced", native: "ab", sent: "abc" },
      Nudged: { _tag: "Nudged", desired: "abc", nudged: `abc${NUDGE}` },
      Detached: { _tag: "Detached" }
    }

    const cases: ReadonlyArray<{
      readonly name: string
      readonly event: InputValueEvent
      readonly expected: Record<
        InputValueState["_tag"],
        { readonly next: InputValueState["_tag"]; readonly effect: string }
      >
    }> = [
      {
        name: "SyncDesired(same-as-sent-drifted)",
        event: { _tag: "SyncDesired", desired: "abc" },
        expected: {
          Uninitialized: { next: "Synced", effect: "Set" },
          Synced: { next: "Nudged", effect: "NudgeThenReset" },
          Nudged: { next: "Synced", effect: "Set" },
          Detached: { next: "Detached", effect: "Noop" }
        }
      },
      {
        name: "SyncDesired(new-value)",
        event: { _tag: "SyncDesired", desired: "xyz" },
        expected: {
          Uninitialized: { next: "Synced", effect: "Set" },
          Synced: { next: "Synced", effect: "Set" },
          Nudged: { next: "Synced", effect: "Set" },
          Detached: { next: "Detached", effect: "Noop" }
        }
      },
      {
        name: "CompleteNudge(matching)",
        event: { _tag: "CompleteNudge", expectedNudged: `abc${NUDGE}` },
        expected: {
          Uninitialized: { next: "Uninitialized", effect: "Noop" },
          Synced: { next: "Synced", effect: "Noop" },
          Nudged: { next: "Synced", effect: "ResetAfterNudge" },
          Detached: { next: "Detached", effect: "Noop" }
        }
      },
      {
        name: "CompleteNudge(stale)",
        event: { _tag: "CompleteNudge", expectedNudged: `stale${NUDGE}` },
        expected: {
          Uninitialized: { next: "Uninitialized", effect: "Noop" },
          Synced: { next: "Synced", effect: "Noop" },
          Nudged: { next: "Nudged", effect: "Noop" },
          Detached: { next: "Detached", effect: "Noop" }
        }
      },
      {
        name: "ReceiveNative",
        event: { _tag: "ReceiveNative", rawValue: `abc${NUDGE}` },
        expected: {
          Uninitialized: { next: "Synced", effect: "EmitNativeChange" },
          Synced: { next: "Synced", effect: "EmitNativeChange" },
          Nudged: { next: "Synced", effect: "EmitNativeChange" },
          Detached: { next: "Detached", effect: "EmitNativeChange" }
        }
      },
      {
        name: "Detach",
        event: { _tag: "Detach" },
        expected: {
          Uninitialized: { next: "Detached", effect: "Noop" },
          Synced: { next: "Detached", effect: "Noop" },
          Nudged: { next: "Detached", effect: "Noop" },
          Detached: { next: "Detached", effect: "Noop" }
        }
      }
    ]

    for (const [stateTag, state] of Object.entries(states) as ReadonlyArray<
      [InputValueState["_tag"], InputValueState]
    >) {
      for (const row of cases) {
        const res = transitionInputValue(state, row.event)
        assert.equal(
          res.next._tag,
          row.expected[stateTag].next,
          `State mismatch for (${stateTag}, ${row.name})`
        )
        assert.equal(
          res.effect._tag,
          row.expected[stateTag].effect,
          `Effect mismatch for (${stateTag}, ${row.name})`
        )
      }
    }
  })
})
