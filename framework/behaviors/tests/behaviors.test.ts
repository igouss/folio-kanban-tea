import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createHistoryStack,
  formatTransferNotice,
  highlightText,
  nextSegmentedValue,
  readProgress,
  readSegmentedControl,
  readTabs
} from "../src/index.ts"

describe("@universal-ui/behaviors", () => {
  it("reads segmentedControl ARIA, checked state, and keyboard navigation", () => {
    const snap = readSegmentedControl({
      id: "density",
      value: "comfortable",
      ariaLabel: "Density",
      items: [
        { value: "comfortable", label: "Detailed" },
        { value: "compact", label: "Compact" },
        { value: "dense", label: "Dense" }
      ]
    })

    assert.equal(snap.rootAttrs.role, "radiogroup")
    assert.equal(snap.rootAttrs["aria-label"], "Density")
    assert.equal(snap.items[0]?.checked, true)
    assert.equal(snap.items[0]?.attrs["aria-checked"], "true")
    assert.equal(nextSegmentedValue(snap.items, "comfortable", "ArrowRight"), "compact")
    assert.equal(nextSegmentedValue(snap.items, "comfortable", "ArrowLeft"), "dense")
    assert.equal(nextSegmentedValue(snap.items, "compact", "Home"), "comfortable")
    assert.equal(nextSegmentedValue(snap.items, "compact", "End"), "dense")
  })

  it("reads tabs ARIA, selection, and panel presence", () => {
    const snap = readTabs({
      id: "sections",
      value: "second",
      ariaLabel: "Sections",
      items: [
        { value: "first", label: "First" },
        { value: "second", label: "Second" }
      ]
    })

    assert.equal(snap.listAttrs.role, "tablist")
    assert.equal(snap.listAttrs["aria-label"], "Sections")
    assert.equal(snap.items[0]?.selected, false)
    assert.equal(snap.items[0]?.panelPresent, false)
    assert.equal(snap.items[1]?.selected, true)
    assert.equal(snap.items[1]?.panelPresent, true)
  })

  it("reads progress ARIA, percent, status, and formatted text", () => {
    const snap = readProgress({
      id: "upload",
      value: 11,
      min: 0,
      max: 25,
      ariaLabel: "Upload progress"
    })
    assert.equal(snap.rootAttrs.role, "progressbar")
    assert.equal(snap.percent, 44)
    assert.equal(snap.status, "progressing")
    assert.equal(snap.text, "44%")
  })

  it("highlights exact substring matches before fuzzy fallback", () => {
    const exact = highlightText("Ship @effect/ui on Fabric", "Fabric")
    assert.deepEqual(exact, [
      { text: "Ship @effect/ui on ", match: false },
      { text: "Fabric", match: true }
    ])

    const fuzzy = highlightText("Implement GPUI Renderer", "igr")
    assert.ok(fuzzy.some((seg) => seg.match))
    assert.equal(fuzzy.map((seg) => seg.text).join(""), "Implement GPUI Renderer")
  })

  it("handles React Native style window globals without permanently mutating window", () => {
    const g = globalThis as { window?: Record<string, unknown> | undefined }
    const hadWindow = "window" in g
    const prevWindow = g.window
    try {
      g.window = {}
      const result = highlightText("Deliver Mobile Fabric", "Fabric")
      assert.deepEqual(result, [
        { text: "Deliver Mobile ", match: false },
        { text: "Fabric", match: true }
      ])
      assert.equal("addEventListener" in g.window, false)
      assert.equal("removeEventListener" in g.window, false)
    } finally {
      if (hadWindow) g.window = prevWindow
      else delete g.window
    }
  })

  it("provides generic undo/redo history and transfer announcements", () => {
    const history = createHistoryStack(["a"])
    assert.equal(history.canUndo(), false)
    history.record(["a", "b"])
    assert.equal(history.canUndo(), true)
    assert.deepEqual(history.undo(), ["a"])
    assert.deepEqual(history.redo(), ["a", "b"])

    const notice = formatTransferNotice({
      type: "drop",
      itemId: "item-1",
      itemLabel: "Build pipeline",
      listLabel: "Active",
      position: 1,
      total: 3
    })
    assert.match(notice, /Build pipeline/)
    assert.match(notice, /Active/)
  })
})
