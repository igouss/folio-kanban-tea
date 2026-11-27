import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  initialPointerState,
  transitionPointer,
  type PointerEvent,
  type PointerState
} from "../src/fsm.ts"
import { uiStyleToCss } from "../src/index.ts"

describe("@universal-ui/host-web", () => {
  it("translates universal flexbox and spacing shorthands to DOM CSS", () => {
    const css = uiStyleToCss("box", {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: "#D8CEBE",
      borderRadius: 8,
      fontWeight: "700"
    })
    assert.equal(css["display"], "flex")
    assert.equal(css["flexDirection"], "column")
    assert.equal(css["flex"], "1 1 0%")
    assert.equal(css["paddingLeft"], "16px")
    assert.equal(css["paddingRight"], "16px")
    assert.equal(css["paddingTop"], "8px")
    assert.equal(css["paddingBottom"], "8px")
    assert.equal(css["borderWidth"], "1px")
    assert.equal(css["borderStyle"], "solid")
    assert.equal(css["fontWeight"], "700")
  })

  it("sets scroll minHeight and avoids redundant button border/padding shorthands", () => {
    const scrollCss = uiStyleToCss("scroll", { flex: 1 })
    assert.equal(scrollCss["overflow"], "auto")
    assert.equal(scrollCss["minHeight"], "0px")

    const plainBtn = uiStyleToCss("button", undefined)
    assert.equal(plainBtn["borderStyle"], "none")
    assert.equal(plainBtn["padding"], "0px")

    const styledBtn = uiStyleToCss("button", {
      borderWidth: 1,
      borderColor: "#111111",
      paddingHorizontal: 10
    })
    assert.equal(styledBtn["borderStyle"], "solid")
    assert.equal(styledBtn["borderWidth"], "1px")
    assert.equal(styledBtn["padding"], undefined)
    assert.equal(styledBtn["paddingLeft"], "10px")
  })

  it("enforces complete PointerState (state, event) transition matrix", () => {
    assert.deepEqual(initialPointerState, { _tag: "Idle" })

    const states: Record<PointerState["_tag"], PointerState> = {
      Idle: { _tag: "Idle" },
      Hovered: { _tag: "Hovered" },
      Pressed: { _tag: "Pressed" },
      Disabled: { _tag: "Disabled" }
    }

    const matrix: Record<
      PointerState["_tag"],
      Record<PointerEvent, PointerState["_tag"]>
    > = {
      Idle: {
        enter: "Hovered",
        leave: "Idle",
        down: "Pressed",
        up: "Idle",
        disable: "Disabled",
        enable: "Idle"
      },
      Hovered: {
        enter: "Hovered",
        leave: "Idle",
        down: "Pressed",
        up: "Hovered",
        disable: "Disabled",
        enable: "Hovered"
      },
      Pressed: {
        enter: "Pressed",
        leave: "Idle",
        down: "Pressed",
        up: "Hovered",
        disable: "Disabled",
        enable: "Pressed"
      },
      Disabled: {
        enter: "Disabled",
        leave: "Disabled",
        down: "Disabled",
        up: "Disabled",
        disable: "Disabled",
        enable: "Idle"
      }
    }

    for (const [stateTag, state] of Object.entries(states) as ReadonlyArray<
      [PointerState["_tag"], PointerState]
    >) {
      for (const [event, expectedTag] of Object.entries(
        matrix[stateTag]
      ) as ReadonlyArray<[PointerEvent, PointerState["_tag"]]>) {
        const next = transitionPointer(state, event)
        assert.equal(
          next._tag,
          expectedTag,
          `Mismatch for (${stateTag}, ${event})`
        )
      }
    }
  })
})
