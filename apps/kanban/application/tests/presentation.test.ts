import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_CARDS } from "@folio/kanban-domain"
import {
  deriveBoardView,
  deriveCardEditorControls,
  filterAndRankCards,
  scoreCard,
  type SearchableCard
} from "../src/presentation/index.ts"

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

describe("@folio/kanban-app presentation (search & view-model)", () => {
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

  it("derives board, lane ARIA attributes, and editor control snapshots", () => {
    const view = deriveBoardView({
      idPrefix: "test",
      cards: DEFAULT_CARDS,
      searchQuery: "TEA",
      priorityFilter: "high",
      priorityLabelStyle: "short",
      activeLane: "in_progress"
    })
    assert.equal(view.velocity.totalCards, DEFAULT_CARDS.length)
    assert.equal(view.board.rootAttrs.role, "region")
    assert.equal(view.board.rootAttrs["aria-label"], "Folio Kanban board")
    assert.equal(view.progress.rootAttrs.role, "progressbar")
    assert.equal(view.priorityControl.rootAttrs.role, "radiogroup")
    assert.equal(view.lanes.length, 4)
    assert.equal(view.lanes[0]?.laneAttrs.role, "list")
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
