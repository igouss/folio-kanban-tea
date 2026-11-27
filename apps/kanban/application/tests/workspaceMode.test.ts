import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_CARDS,
  cardToDraft,
  parseCardId,
  parseCardTitle,
  type CardId,
  type CardTitle
} from "@folio/kanban-domain"
import {
  IDLE_WORKSPACE_MODE,
  transitionWorkspaceMode,
  type NoticeState,
  type WorkspaceMode,
  type WorkspaceModeEvent
} from "../src/state/index.ts"

const mustCardId = (raw: string): CardId => {
  const parsed = parseCardId(raw)
  assert.ok(parsed !== undefined)
  return parsed
}

const mustCardTitle = (raw: string): CardTitle => {
  const parsed = parseCardTitle(raw)
  assert.ok(parsed !== undefined)
  return parsed
}

const sampleDraft = cardToDraft(DEFAULT_CARDS[0]!)
const otherCardId = mustCardId("card-999")
const validTitle = mustCardTitle("Correlated card")

describe("@folio/kanban-app WorkspaceMode FSM transition matrix", () => {
  it("handles every (state, event) pair across Idle, Composing, SubmittingCard, and EditingCard", () => {
    const activeLane = "in_progress" as const

    const states: Record<WorkspaceMode["_tag"], WorkspaceMode> = {
      Idle: IDLE_WORKSPACE_MODE,
      Composing: { _tag: "Composing", lane: "backlog", title: "Valid draft" },
      SubmittingCard: {
        _tag: "SubmittingCard",
        requestId: 7,
        lane: "backlog",
        title: validTitle
      },
      EditingCard: { _tag: "EditingCard", draft: sampleDraft }
    }

    const events: ReadonlyArray<{
      readonly name: string
      readonly event: WorkspaceModeEvent
      readonly expected: Record<WorkspaceMode["_tag"], string>
    }> = [
      {
        name: "SelectedLane",
        event: { _tag: "SelectedLane", lane: "review" },
        expected: {
          Idle: "Ignored",
          Composing: "Updated",
          SubmittingCard: "Ignored",
          EditingCard: "Ignored"
        }
      },
      {
        name: "StartAddCard",
        event: { _tag: "StartAddCard", lane: "done" },
        expected: {
          Idle: "Updated",
          Composing: "Updated",
          SubmittingCard: "Ignored",
          EditingCard: "Updated"
        }
      },
      {
        name: "TypeQuickTitle",
        event: { _tag: "TypeQuickTitle", text: "Hello" },
        expected: {
          Idle: "Updated",
          Composing: "Updated",
          SubmittingCard: "Ignored",
          EditingCard: "Ignored"
        }
      },
      {
        name: "SubmitQuickCard",
        event: { _tag: "SubmitQuickCard", nextRequestId: 8 },
        expected: {
          Idle: "ValidationFailed",
          Composing: "StartMint",
          SubmittingCard: "Ignored",
          EditingCard: "Ignored"
        }
      },
      {
        name: "ReceiveMintResult(matching)",
        event: {
          _tag: "ReceiveMintResult",
          requestId: 7,
          lane: "backlog",
          title: validTitle
        },
        expected: {
          Idle: "Ignored",
          Composing: "Ignored",
          SubmittingCard: "MintAccepted",
          EditingCard: "Ignored"
        }
      },
      {
        name: "ReceiveMintResult(stale)",
        event: {
          _tag: "ReceiveMintResult",
          requestId: 6,
          lane: "backlog",
          title: validTitle
        },
        expected: {
          Idle: "Ignored",
          Composing: "Ignored",
          SubmittingCard: "Ignored",
          EditingCard: "Ignored"
        }
      },
      {
        name: "CancelQuickCard",
        event: { _tag: "CancelQuickCard" },
        expected: {
          Idle: "Ignored",
          Composing: "Updated",
          SubmittingCard: "Updated",
          EditingCard: "Ignored"
        }
      },
      {
        name: "OpenEditor",
        event: { _tag: "OpenEditor", draft: sampleDraft },
        expected: {
          Idle: "Updated",
          Composing: "Updated",
          SubmittingCard: "Ignored",
          EditingCard: "Updated"
        }
      },
      {
        name: "UpdateDraft",
        event: {
          _tag: "UpdateDraft",
          update: (d) => ({ ...d, notes: "updated" })
        },
        expected: {
          Idle: "Ignored",
          Composing: "Ignored",
          SubmittingCard: "Ignored",
          EditingCard: "Updated"
        }
      },
      {
        name: "SubmitEditCard",
        event: { _tag: "SubmitEditCard" },
        expected: {
          Idle: "Ignored",
          Composing: "Ignored",
          SubmittingCard: "Ignored",
          EditingCard: "CommitEditCard"
        }
      },
      {
        name: "CancelEditCard",
        event: { _tag: "CancelEditCard" },
        expected: {
          Idle: "Ignored",
          Composing: "Ignored",
          SubmittingCard: "Ignored",
          EditingCard: "Updated"
        }
      },
      {
        name: "CardDeleted(editing-card)",
        event: { _tag: "CardDeleted", cardId: sampleDraft.cardId },
        expected: {
          Idle: "Ignored",
          Composing: "Ignored",
          SubmittingCard: "Ignored",
          EditingCard: "Updated"
        }
      },
      {
        name: "CardDeleted(other-card)",
        event: { _tag: "CardDeleted", cardId: otherCardId },
        expected: {
          Idle: "Ignored",
          Composing: "Ignored",
          SubmittingCard: "Ignored",
          EditingCard: "Ignored"
        }
      },
      {
        name: "Reset",
        event: { _tag: "Reset" },
        expected: {
          Idle: "Updated",
          Composing: "Updated",
          SubmittingCard: "Updated",
          EditingCard: "Updated"
        }
      }
    ]

    for (const [modeTag, mode] of Object.entries(states) as ReadonlyArray<
      [WorkspaceMode["_tag"], WorkspaceMode]
    >) {
      for (const row of events) {
        const result = transitionWorkspaceMode(mode, activeLane, row.event)
        assert.equal(
          result._tag,
          row.expected[modeTag],
          `Mismatch for (${modeTag}, ${row.name})`
        )
      }
    }
  })

  it("correlates async mint completions by requestId so attempt #1 cannot complete attempt #2", () => {
    const title1 = mustCardTitle("First attempt")
    const title2 = mustCardTitle("Second attempt")

    // Attempt #1 starts
    const t1 = transitionWorkspaceMode(
      { _tag: "Composing", lane: "backlog", title: "  First attempt  " },
      "in_progress",
      { _tag: "SubmitQuickCard", nextRequestId: 1 }
    )
    assert.equal(t1._tag, "StartMint")
    if (t1._tag !== "StartMint") return
    assert.equal(t1.requestId, 1)
    assert.equal(t1.title, title1)

    // User cancels attempt #1 and starts attempt #2
    const cancelled = transitionWorkspaceMode(t1.mode, "in_progress", {
      _tag: "CancelQuickCard"
    })
    assert.deepEqual(cancelled, { _tag: "Updated", mode: IDLE_WORKSPACE_MODE })

    const t2 = transitionWorkspaceMode(
      { _tag: "Composing", lane: "review", title: "Second attempt" },
      "in_progress",
      { _tag: "SubmitQuickCard", nextRequestId: 2 }
    )
    assert.equal(t2._tag, "StartMint")
    if (t2._tag !== "StartMint") return

    // Stale completion from attempt #1 is ignored while attempt #2 is in-flight
    const stale = transitionWorkspaceMode(t2.mode, "in_progress", {
      _tag: "ReceiveMintResult",
      requestId: 1,
      lane: "backlog",
      title: title1
    })
    assert.deepEqual(stale, { _tag: "Ignored" })

    // Matching completion from attempt #2 is accepted and returns Idle
    const accepted = transitionWorkspaceMode(t2.mode, "in_progress", {
      _tag: "ReceiveMintResult",
      requestId: 2,
      lane: "review",
      title: title2
    })
    assert.deepEqual(accepted, {
      _tag: "MintAccepted",
      mode: IDLE_WORKSPACE_MODE,
      requestId: 2,
      lane: "review",
      title: title2
    })
  })

  it("enforces compile-time unconstructibility of unvalidated SubmittingCard titles and blank NoticeState", () => {
    const _compileChecks = () => {
      const _badSubmitting: WorkspaceMode = {
        _tag: "SubmittingCard",
        requestId: 1,
        lane: "backlog",
        // @ts-expect-error raw string cannot construct SubmittingCard.title
        title: "unvalidated"
      }
      const _badNotice: NoticeState = {
        _tag: "Visible",
        tone: "info",
        // @ts-expect-error empty string cannot construct Visible.message
        message: "",
        // @ts-expect-error empty string cannot construct Visible.announcement
        announcement: ""
      }
      return [_badSubmitting, _badNotice]
    }
    assert.equal(typeof _compileChecks, "function")
  })
})
