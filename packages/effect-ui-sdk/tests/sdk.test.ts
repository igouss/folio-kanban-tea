import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { agentTools } from "@ui-sdk/core/agent"
import { attrs, partState, press } from "@ui-sdk/core/renderer"
import {
  createBoardHistory,
  filterAndRankCards,
  formatTransferNotice,
  highlightText,
  kanbanBoard,
  nextSegmentedValue,
  readProgress,
  readSegmentedControl,
  readTabs,
  scoreCard,
  type SearchableCard
} from "../src/index.ts"

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

globalThis.__UI_SDK_STRICT__ = true

const SAMPLE_CARDS: ReadonlyArray<SearchableCard & { readonly id: string }> = [
  {
    id: "c1",
    code: "FOL-101",
    title: "Implement GPUI Renderer Host",
    notes: "Drive Zed GPUI natively from @effect/ui",
    priority: "high",
    assignee: "AR",
    tags: ["gpui", "native"]
  },
  {
    id: "c2",
    code: "FOL-102",
    title: "Wire Fabric Touch Events",
    notes: "Android Hermes touch bridge",
    priority: "medium",
    assignee: "MC",
    tags: ["fabric", "android"]
  },
  {
    id: "c3",
    code: "FOL-103",
    title: "Audit Keyboard Focus Ring",
    notes: "WAI-ARIA roving tabindex checks",
    priority: "low",
    assignee: "JK",
    tags: ["a11y", "web"]
  }
]

describe("@folio/effect-ui-sdk bridge", () => {
  it("reads segmentedControl ARIA and checked state", () => {
    const snap = readSegmentedControl({
      id: "priority-filter",
      value: "high",
      ariaLabel: "Filter by priority",
      items: [
        { value: "all", label: "All" },
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" }
      ]
    })

    assert.equal(snap.rootAttrs.role, "radiogroup")
    assert.equal(snap.rootAttrs["aria-label"], "Filter by priority")
    assert.equal(snap.rootAttrs["data-slot"], "segmented-control")
    assert.equal(snap.items.length, 4)

    const high = snap.items.find((i) => i.value === "high")
    const all = snap.items.find((i) => i.value === "all")
    assert.equal(high?.checked, true)
    assert.equal(high?.attrs.role, "radio")
    assert.equal(high?.attrs["aria-checked"], "true")
    assert.equal(all?.checked, false)
    assert.equal(all?.attrs["aria-checked"], "false")

    assert.equal(nextSegmentedValue(snap.items, "high", "ArrowRight"), "medium")
    assert.equal(nextSegmentedValue(snap.items, "all", "ArrowLeft"), "low")
    assert.equal(nextSegmentedValue(snap.items, "high", "End"), "low")
    assert.equal(nextSegmentedValue(snap.items, "high", "Home"), "all")
  })

  it("reads tabs ARIA, selected tab, and panel presence", () => {
    const snap = readTabs({
      id: "mobile-lanes",
      value: "review",
      ariaLabel: "Board lanes",
      items: [
        { value: "backlog", label: "Backlog" },
        { value: "in_progress", label: "Active" },
        { value: "review", label: "Review" },
        { value: "done", label: "Done" }
      ]
    })

    assert.equal(snap.listAttrs.role, "tablist")
    assert.equal(snap.listAttrs["aria-label"], "Board lanes")
    const review = snap.items.find((i) => i.value === "review")
    const backlog = snap.items.find((i) => i.value === "backlog")
    assert.equal(review?.selected, true)
    assert.equal(review?.tabAttrs.role, "tab")
    assert.equal(review?.tabAttrs["aria-selected"], "true")
    assert.equal(review?.panelPresent, true)
    assert.equal(backlog?.selected, false)
    assert.equal(backlog?.panelPresent, false)
  })

  it("reads progress ARIA, percent, status, and formatted text", () => {
    const snap = readProgress({
      id: "board-velocity",
      value: 11,
      min: 0,
      max: 25,
      ariaLabel: "Sprint velocity"
    })

    assert.equal(snap.rootAttrs.role, "progressbar")
    assert.equal(snap.rootAttrs["aria-label"], "Sprint velocity")
    assert.equal(snap.rootAttrs["aria-valuenow"], "11")
    assert.equal(snap.rootAttrs["aria-valuemax"], "25")
    assert.equal(snap.percent, 44)
    assert.equal(snap.status, "progressing")
    assert.equal(snap.text, "44%")

    const complete = readProgress({
      id: "done-velocity",
      value: 25,
      min: 0,
      max: 25
    })
    assert.equal(complete.status, "complete")
    assert.equal(complete.percent, 100)
  })
})

describe("@folio/effect-ui-sdk text-match", () => {
  it("fuzzy filters, ranks, and highlights card matches", () => {
    const filtered = filterAndRankCards(SAMPLE_CARDS, "gpui", "all")
    assert.equal(filtered.length, 1)
    assert.equal(filtered[0]?.id, "c1")
    assert.ok(scoreCard(SAMPLE_CARDS[0]!, "gpui") > 0)

    const fuzzySubsequence = filterAndRankCards(SAMPLE_CARDS, "fabtc", "all")
    assert.equal(fuzzySubsequence.length, 1)
    assert.equal(fuzzySubsequence[0]?.id, "c2")

    const priorityOnly = filterAndRankCards(SAMPLE_CARDS, "", "low")
    assert.equal(priorityOnly.length, 1)
    assert.equal(priorityOnly[0]?.id, "c3")

    const segments = highlightText("Implement GPUI Renderer Host", "gpui")
    assert.ok(segments.some((s) => s.match && s.text.toLowerCase() === "gpui"))
    assert.equal(
      segments.map((s) => s.text).join(""),
      "Implement GPUI Renderer Host"
    )
  })
})

describe("@folio/effect-ui-sdk kanbanBoard primitive & history", () => {
  it("transfers cards across lanes with WIP limits, selection, and announcements", () => {
    let lastTransfer: { key: string; from: string; to: string } | undefined
    const board = kanbanBoard({
      id: "folio-board",
      label: "Folio Kanban",
      defaultLists: {
        backlog: ["c1", "c2"],
        in_progress: ["c3"],
        review: ["c4", "c5"],
        done: []
      },
      order: ["backlog", "in_progress", "review", "done"],
      wipLimits: { backlog: null, in_progress: 3, review: 2, done: null },
      cardLabel: (id) => `Card ${id}`,
      laneLabel: (lane) => lane.replace("_", " "),
      onListsChange: (_lists, details) => {
        lastTransfer = { key: details.key, from: details.from, to: details.to }
      }
    })

    const rootPart = board.part("root")
    assert.equal(attrs(rootPart).role, "region")
    assert.equal(attrs(rootPart)["aria-label"], "Folio Kanban")

    // Review lane is at WIP limit (2/2), so moving c1 there is rejected
    assert.equal(board.api.moveCard("c1", "review", 0), false)
    assert.deepEqual(board.api.getLists().backlog, ["c1", "c2"])

    // Moving c1 to in_progress succeeds and updates announcement
    assert.equal(board.api.moveCard("c1", "in_progress", 0), true)
    assert.deepEqual(board.api.getLists().backlog, ["c2"])
    assert.deepEqual(board.api.getLists().in_progress, ["c1", "c3"])
    assert.deepEqual(lastTransfer, {
      key: "c1",
      from: "backlog",
      to: "in_progress"
    })
    assert.match(board.api.getAnnouncement(), /Card c1/)

    // Card press selects via createSelection
    const cardPart = board.part("card", { value: "c1", lane: "in_progress" })
    const activate = press(cardPart)
    assert.ok(activate)
    activate()
    assert.deepEqual(board.api.getSelected(), ["c1"])
    assert.equal((partState(cardPart) as { selected: boolean }).selected, true)

    board.destroy()
  })

  it("exposes agent tool schemas and controlled sync on kanbanBoard", () => {
    assert.deepEqual(
      agentTools.map((tool) => tool.name),
      ["act", "query", "snapshot"]
    )

    const board = kanbanBoard({
      id: "agent-board",
      label: "Sprint Board",
      defaultLists: {
        backlog: ["c1"],
        done: []
      },
      order: ["backlog", "done"]
    })

    const lanePart = board.part("lane", { value: "backlog", label: "Backlog" })
    assert.equal(attrs(lanePart).role, "list")
    assert.equal(attrs(lanePart)["data-count"], "1")

    assert.equal(board.api.moveCard("c1", "done", 0), true)
    assert.deepEqual(board.api.getLists().done, ["c1"])
    assert.equal(attrs(lanePart)["data-count"], "0")

    board.api.selectCard("c1")
    assert.deepEqual(board.api.getSelected(), ["c1"])
    board.api.clearSelection()
    assert.deepEqual(board.api.getSelected(), [])

    board.destroy()
  })

  it("tracks board undo/redo history and formats transfer notices", () => {
    const history = createBoardHistory(["a", "b"])
    assert.equal(history.canUndo(), false)
    assert.equal(history.canRedo(), false)

    history.record(["a", "b", "c"])
    history.record(["a", "c"])
    assert.equal(history.canUndo(), true)

    assert.deepEqual(history.undo(), ["a", "b", "c"])
    assert.equal(history.canRedo(), true)
    assert.deepEqual(history.undo(), ["a", "b"])
    assert.equal(history.canUndo(), false)
    assert.deepEqual(history.redo(), ["a", "b", "c"])

    const msg = formatTransferNotice({
      type: "drop",
      cardId: "c1",
      cardTitle: "GPUI Host",
      laneTitle: "In Review",
      position: 1,
      total: 3
    })
    assert.match(msg, /GPUI Host/)
    assert.match(msg, /In Review/)
  })
})
