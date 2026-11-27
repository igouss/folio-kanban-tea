import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  NUDGE,
  completeInputNudge,
  initialInputValueState,
  readSubmittedInputValue,
  receiveNativeInputValue,
  syncDesiredInputValue,
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

    // Completing nudge resets cleanly to Synced
    const done = completeInputNudge(state, `abc${NUDGE}`)
    assert.equal(done.resetValue, "abc")
    assert.equal(done.next._tag, "Synced")

    // Detached is terminal and ignores sync & stale nudge timers
    const detached: InputValueState = { _tag: "Detached" }
    assert.deepEqual(syncDesiredInputValue(detached, "x").action, { _tag: "Noop" })
    assert.equal(completeInputNudge(detached, `abc${NUDGE}`).resetValue, undefined)
  })
})
