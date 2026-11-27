import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createActiveTextField,
  initialPressGesture,
  pressGrant,
  pressMove,
  pressRelease,
  pressTerminate
} from "../src/fsm.ts"

describe("@universal-ui/host-fabric FSMs", () => {
  it("drives PressGestureState: Idle -> Pressed -> emit or Cancelled", () => {
    let gesture = initialPressGesture
    assert.equal(pressRelease(gesture).shouldEmitPress, false)

    // Press and release within retention emits press
    gesture = pressGrant({ x: 10, y: 10 })
    assert.equal(gesture._tag, "Pressed")
    gesture = pressMove(gesture, { x: 14, y: 14 }, { width: 40, height: 24 })
    assert.equal(gesture._tag, "Pressed")
    const emitted = pressRelease(gesture)
    assert.equal(emitted.shouldEmitPress, true)
    assert.equal(emitted.next._tag, "Idle")

    // Dragging outside retention cancels the gesture
    gesture = pressGrant({ x: 10, y: 10 })
    gesture = pressMove(gesture, { x: 200, y: 200 }, { width: 40, height: 24 })
    assert.equal(gesture._tag, "Cancelled")
    assert.equal(pressRelease(gesture).shouldEmitPress, false)

    // Terminate returns to Idle without emitting
    gesture = pressGrant({ x: 10, y: 10 })
    gesture = pressTerminate()
    assert.equal(gesture._tag, "Idle")
    assert.equal(pressRelease(gesture).shouldEmitPress, false)
  })

  it("initializes TextFieldLifecycle in Active state", () => {
    const field = createActiveTextField()
    assert.equal(field._tag, "Active")
    assert.equal(field.eventCount, 0)
  })
})
