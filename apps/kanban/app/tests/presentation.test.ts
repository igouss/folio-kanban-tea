import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { agentTools } from "@ui-sdk/core/agent"
import { attrs, partState, press } from "@ui-sdk/core/renderer"
import { DEFAULT_CARDS } from "@folio/kanban-domain"
import {
  deriveBoardView,
  deriveCardEditorControls,
  filterAndRankCards,
  kanbanBoard,
  readKanbanBoard,
  scoreCard,
  type SearchableCard
} from "../src/presentation/index.ts"

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

describe("@folio/kanban-app presentation (search, kanbanBoard primitive, view-model)", () => {
  it("fuzzy filters and ranks kanban cards by title, tag, and priority", () => {
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
  })

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

    assert.equal(board.api.moveCard("c1", "review", 0), false)
    assert.deepEqual(board.api.getLists().backlog, ["c1", "c2"])

    assert.equal(board.api.moveCard("c1", "in_progress", 0), true)
    assert.deepEqual(board.api.getLists().backlog, ["c2"])
    assert.deepEqual(board.api.getLists().in_progress, ["c1", "c3"])
    assert.deepEqual(lastTransfer, {
      key: "c1",
      from: "backlog",
      to: "in_progress"
    })
    assert.match(board.api.getAnnouncement(), /Card c1/)

    const cardPart = board.part("card", { value: "c1", lane: "in_progress" })
    const activate = press(cardPart)
    assert.ok(activate)
    activate()
    assert.deepEqual(board.api.getSelected(), ["c1"])
    assert.equal((partState(cardPart) as { selected: boolean }).selected, true)

    board.destroy()
  })

  it("exposes agent tool schemas and derives board & editor snapshots", () => {
    assert.deepEqual(
      agentTools.map((tool) => tool.name),
      ["act", "query", "snapshot"]
    )

    const boardSnap = readKanbanBoard({
      id: "snap-board",
      label: "Folio Kanban",
      lists: { backlog: ["card-105"], done: ["card-102"] },
      lanes: [
        { id: "backlog", label: "Backlog column" },
        { id: "done", label: "Done column" }
      ],
      cards: [{ id: "card-105", lane: "backlog" }],
      wipLimits: { backlog: null, done: null }
    })
    assert.equal(boardSnap.rootAttrs.role, "region")
    assert.equal(boardSnap.lanes["backlog"]?.attrs.role, "list")
    assert.equal(boardSnap.cards["card-105"]?.attrs.role, "listitem")

    const view = deriveBoardView({
      idPrefix: "test",
      cards: DEFAULT_CARDS,
      searchQuery: "TEA",
      priorityFilter: "high",
      priorityLabelStyle: "short",
      activeLane: "in_progress"
    })
    assert.equal(view.velocity.totalCards, DEFAULT_CARDS.length)
    assert.equal(view.progress.rootAttrs.role, "progressbar")
    assert.equal(view.priorityControl.rootAttrs.role, "radiogroup")
    assert.equal(view.lanes.length, 4)
    assert.equal(view.laneTabs?.listAttrs.role, "tablist")
    assert.equal(view.activeLane.lane.id, "in_progress")

    const editor = deriveCardEditorControls({
      idPrefix: "test",
      lane: "review",
      priority: "high",
      points: 5
    })
    assert.equal(editor.laneControl.value, "review")
    assert.equal(editor.priorityControl.value, "high")
    assert.equal(editor.pointsControl.value, "5")
    assert.equal(editor.pointsControl.items.length, 6)
  })
})
