import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cardsInLane } from "@folio/kanban-domain"
import * as Option from "effect/Option"
import {
  initialState,
  reduce,
  selectBackgroundTrips,
  selectBoardScreen,
  selectCanRedo,
  selectCanUndo,
  selectCards,
  selectDocumentTitle,
  selectNotice,
  selectTheme,
  selectWorkspaceMode
} from "../src/state/index.ts"

const ctx = { runtimeTag: "cli" } as const

const boot = (width = 1280, topInset = 0) =>
  initialState({
    initialBoard: Option.none(),
    initialViewport: { width, height: 800, topInset }
  })

describe("@folio/kanban-app pure reducer (zero @effect/ui runtime)", () => {
  it("validates quick-add, enters SubmittingCard to guard double-submit, creates card, and emits PersistBoard", () => {
    let state = boot()
    assert.equal(selectCards(state).length, 8)
    assert.equal(selectCanUndo(state), false)
    assert.deepEqual(selectWorkspaceMode(state), { _tag: "Idle" })
    assert.deepEqual(selectNotice(state), { _tag: "Hidden" })

    // Start composing and submit invalid short title -> error NoticeState
    state = reduce(state, { _tag: "ClickedStartAddCard", lane: "backlog" }, ctx).state
    assert.deepEqual(selectWorkspaceMode(state), {
      _tag: "Composing",
      lane: "backlog",
      title: ""
    })
    state = reduce(state, { _tag: "TypedQuickTitle", text: "A" }, ctx).state
    const invalid = reduce(state, { _tag: "SubmittedQuickCard" }, ctx)
    assert.equal(invalid.effects.length, 0)
    assert.equal(selectWorkspaceMode(invalid.state)._tag, "Composing")
    const invalidNotice = selectNotice(invalid.state)
    assert.equal(invalidNotice._tag, "Visible")
    if (invalidNotice._tag === "Visible") {
      assert.equal(invalidNotice.tone, "error")
      assert.ok(invalidNotice.message.includes("at least"))
    }

    // Valid submission enters SubmittingCard and emits MintCardMeta once
    state = reduce(
      invalid.state,
      { _tag: "TypedQuickTitle", text: "Pure reducer test" },
      ctx
    ).state
    const mintedReq = reduce(state, { _tag: "SubmittedQuickCard" }, ctx)
    assert.deepEqual(selectWorkspaceMode(mintedReq.state), {
      _tag: "SubmittingCard",
      lane: "backlog",
      title: "Pure reducer test"
    })
    assert.deepEqual(selectNotice(mintedReq.state), { _tag: "Hidden" })
    assert.deepEqual(mintedReq.effects, [
      {
        _tag: "MintCardMeta",
        title: "Pure reducer test",
        lane: "backlog",
        tag: "cli"
      }
    ])

    // Double-submit while SubmittingCard is a no-op (prevents duplicate cards)
    const doubleSubmit = reduce(
      mintedReq.state,
      { _tag: "SubmittedQuickCard" },
      ctx
    )
    assert.equal(doubleSubmit.effects.length, 0)
    assert.equal(selectWorkspaceMode(doubleSubmit.state)._tag, "SubmittingCard")

    // Completing mint creates card, returns to Idle, sets info notice, emits PersistBoard
    const created = reduce(
      mintedReq.state,
      {
        _tag: "CompletedMintCard",
        id: "cli-card-1",
        createdAt: "2026-11-27T12:00:00.000Z",
        title: "Pure reducer test",
        lane: "backlog",
        tag: "cli"
      },
      ctx
    )
    assert.equal(selectCards(created.state).length, 9)
    assert.deepEqual(selectWorkspaceMode(created.state), { _tag: "Idle" })
    assert.deepEqual(selectBoardScreen(created.state).workspaceMode, {
      _tag: "Idle"
    })
    const createdNotice = selectNotice(created.state)
    assert.equal(createdNotice._tag, "Visible")
    if (createdNotice._tag === "Visible") {
      assert.equal(createdNotice.tone, "info")
    }
    assert.equal(selectCanUndo(created.state), true)
    assert.equal(created.effects.length, 1)
    assert.equal(created.effects[0]?._tag, "PersistBoard")
    assert.equal(
      selectDocumentTitle(created.state, "CLI"),
      "Folio Kanban · CLI (9 cards)"
    )
  })

  it("enforces mutually exclusive WorkspaceMode transitions and guards stale mint completions", () => {
    let state = boot()

    // Composing -> Opening editor closes composer and enters EditingCard
    state = reduce(state, { _tag: "ClickedStartAddCard", lane: "backlog" }, ctx).state
    state = reduce(state, { _tag: "TypedQuickTitle", text: "Draft title" }, ctx).state
    state = reduce(state, { _tag: "ClickedOpenEditor", cardId: "card-101" }, ctx).state
    assert.equal(selectWorkspaceMode(state)._tag, "EditingCard")

    // Quick-title typing while EditingCard is ignored
    const typedWhileEditing = reduce(
      state,
      { _tag: "TypedQuickTitle", text: "Should be ignored" },
      ctx
    )
    assert.equal(selectWorkspaceMode(typedWhileEditing.state)._tag, "EditingCard")

    // Invalid editor submit produces error notice and stays EditingCard
    state = reduce(state, { _tag: "TypedEditTitle", text: "X" }, ctx).state
    const badEdit = reduce(state, { _tag: "SubmittedEditCard" }, ctx)
    assert.equal(selectWorkspaceMode(badEdit.state)._tag, "EditingCard")
    const editErr = selectNotice(badEdit.state)
    assert.equal(editErr._tag, "Visible")
    if (editErr._tag === "Visible") {
      assert.equal(editErr.tone, "error")
    }

    // Starting quick-add from EditingCard switches cleanly to Composing and hides notice
    state = reduce(
      badEdit.state,
      { _tag: "ClickedStartAddCard", lane: "review" },
      ctx
    ).state
    assert.deepEqual(selectWorkspaceMode(state), {
      _tag: "Composing",
      lane: "review",
      title: ""
    })
    assert.deepEqual(selectNotice(state), { _tag: "Hidden" })

    // Cancelling while SubmittingCard returns to Idle and ignores stale CompletedMintCard
    state = reduce(state, { _tag: "TypedQuickTitle", text: "Cancel mid-flight" }, ctx).state
    state = reduce(state, { _tag: "SubmittedQuickCard" }, ctx).state
    assert.equal(selectWorkspaceMode(state)._tag, "SubmittingCard")
    state = reduce(state, { _tag: "CancelledQuickCard" }, ctx).state
    assert.deepEqual(selectWorkspaceMode(state), { _tag: "Idle" })
    const stale = reduce(
      state,
      {
        _tag: "CompletedMintCard",
        id: "cli-stale-1",
        createdAt: "2026-11-27T12:00:00.000Z",
        title: "Cancel mid-flight",
        lane: "review",
        tag: "cli"
      },
      ctx
    )
    assert.equal(selectCards(stale.state).length, 8)
    assert.equal(stale.effects.length, 0)
  })

  it("handles move transitions, theme toggle, undo/redo, responsive layout, and lifecycle trips", () => {
    let state = boot(1280, 0)
    assert.equal(selectBoardScreen(state).layout, "columns")

    // Move card emits PersistBoard + ViewTransition and sets info notice with transfer announcement
    const moved = reduce(
      state,
      { _tag: "ClickedMoveCard", cardId: "card-101", toLane: "review" },
      ctx
    )
    assert.deepEqual(
      moved.effects.map((e) => e._tag),
      ["PersistBoard", "ViewTransition"]
    )
    assert.equal(cardsInLane(selectCards(moved.state), "review")[0]?.id, "card-101")
    const moveNotice = selectNotice(moved.state)
    assert.equal(moveNotice._tag, "Visible")
    if (moveNotice._tag === "Visible") {
      assert.equal(moveNotice.tone, "info")
      assert.ok(moveNotice.announcement.length > 0)
    }

    // Undo and Redo restore lane cleanly
    const undone = reduce(moved.state, { _tag: "ClickedUndo" }, ctx)
    assert.equal(selectCanRedo(undone.state), true)
    assert.equal(
      cardsInLane(selectCards(undone.state), "in_progress").some(
        (c) => c.id === "card-101"
      ),
      true
    )
    const redone = reduce(undone.state, { _tag: "ClickedRedo" }, ctx)
    assert.equal(cardsInLane(selectCards(redone.state), "review")[0]?.id, "card-101")

    // Toggle theme + resize viewport below breakpoint switches layout selector to tabs
    const themed = reduce(redone.state, { _tag: "ClickedToggleTheme" }, ctx)
    assert.equal(selectTheme(themed.state), "graphite")
    assert.equal(themed.effects[0]?._tag, "PersistBoard")

    const resized = reduce(
      themed.state,
      { _tag: "ChangedViewport", viewport: { width: 390, height: 844, topInset: 56 } },
      ctx
    )
    const screen = selectBoardScreen(resized.state)
    assert.equal(screen.layout, "tabs")
    assert.equal(screen.topInset, 56)

    // Lifecycle transitions only increment backgroundTrips on non-background -> background edge
    let life = reduce(resized.state, { _tag: "ChangedLifecycle", state: "background" }, ctx).state
    life = reduce(life, { _tag: "ChangedLifecycle", state: "background" }, ctx).state
    assert.equal(selectBackgroundTrips(life), 1)
    life = reduce(life, { _tag: "ChangedLifecycle", state: "active" }, ctx).state
    assert.equal(selectBoardScreen(life).lifecycleBadge, "@effect/ui · active (1)")
    life = reduce(life, { _tag: "ChangedLifecycle", state: "background" }, ctx).state
    assert.equal(selectBackgroundTrips(life), 2)
  })
})
