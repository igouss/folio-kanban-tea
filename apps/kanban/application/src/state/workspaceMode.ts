import {
  validateCardTitle,
  type CardDraft,
  type CardId,
  type CardTitle,
  type LaneId
} from "@folio/kanban-domain"
import type { WorkspaceMode } from "./state.ts"

export const IDLE_WORKSPACE_MODE: WorkspaceMode = { _tag: "Idle" }

export type WorkspaceModeEvent =
  | { readonly _tag: "SelectedLane"; readonly lane: LaneId }
  | { readonly _tag: "StartAddCard"; readonly lane: LaneId }
  | { readonly _tag: "TypeQuickTitle"; readonly text: string }
  | { readonly _tag: "SubmitQuickCard"; readonly nextRequestId: number }
  | {
      readonly _tag: "ReceiveMintResult"
      readonly requestId: number
      readonly lane: LaneId
      readonly title: CardTitle
    }
  | { readonly _tag: "FailMintResult"; readonly requestId: number }
  | { readonly _tag: "CancelQuickCard" }
  | { readonly _tag: "OpenEditor"; readonly draft: CardDraft }
  | {
      readonly _tag: "CommitEditedCard"
      readonly draft: CardDraft
      readonly title: CardTitle
    }
  | { readonly _tag: "CancelEditCard" }
  | { readonly _tag: "CardDeleted"; readonly cardId: CardId }
  | { readonly _tag: "Reset" }

export type WorkspaceModeTransition =
  | { readonly _tag: "Ignored" }
  | { readonly _tag: "Updated"; readonly mode: WorkspaceMode }
  | { readonly _tag: "ValidationFailed"; readonly error: string }
  | {
      readonly _tag: "StartMint"
      readonly mode: Extract<WorkspaceMode, { readonly _tag: "SubmittingCard" }>
      readonly requestId: number
      readonly lane: LaneId
      readonly title: CardTitle
    }
  | {
      readonly _tag: "MintAccepted"
      readonly mode: Extract<WorkspaceMode, { readonly _tag: "Idle" }>
      readonly requestId: number
      readonly lane: LaneId
      readonly title: CardTitle
    }
  | {
      readonly _tag: "MintFailed"
      readonly mode: Extract<WorkspaceMode, { readonly _tag: "Composing" }>
      readonly requestId: number
    }
  | {
      readonly _tag: "CommitEditCard"
      readonly mode: Extract<WorkspaceMode, { readonly _tag: "Idle" }>
      readonly draft: CardDraft
      readonly title: CardTitle
    }

const IGNORED: WorkspaceModeTransition = { _tag: "Ignored" }

const exhaustiveEvent = (event: never): WorkspaceModeTransition => event

/**
 * State-first finite state machine for `WorkspaceMode`.
 * Switching on `mode._tag` first and exhaustively matching `event._tag` inside
 * every state ensures that adding a mode or event requires an explicit decision
 * for every cell of the `(mode, event)` transition matrix.
 */
export const transitionWorkspaceMode = (
  mode: WorkspaceMode,
  activeLane: LaneId,
  event: WorkspaceModeEvent
): WorkspaceModeTransition => {
  switch (mode._tag) {
    case "Idle":
      switch (event._tag) {
        case "StartAddCard":
          return {
            _tag: "Updated",
            mode: { _tag: "Composing", lane: event.lane, title: "" }
          }
        case "TypeQuickTitle":
          return {
            _tag: "Updated",
            mode: { _tag: "Composing", lane: activeLane, title: event.text }
          }
        case "SubmitQuickCard": {
          const check = validateCardTitle("")
          return check.ok
            ? IGNORED
            : { _tag: "ValidationFailed", error: check.error }
        }
        case "OpenEditor":
          return {
            _tag: "Updated",
            mode: { _tag: "EditingCard", draft: event.draft }
          }
        case "Reset":
          return { _tag: "Updated", mode: IDLE_WORKSPACE_MODE }
        case "SelectedLane":
        case "ReceiveMintResult":
        case "FailMintResult":
        case "CancelQuickCard":
        case "CommitEditedCard":
        case "CancelEditCard":
        case "CardDeleted":
          return IGNORED
        default:
          return exhaustiveEvent(event)
      }

    case "Composing":
      switch (event._tag) {
        case "SelectedLane":
          return {
            _tag: "Updated",
            mode: { ...mode, lane: event.lane }
          }
        case "StartAddCard":
          return {
            _tag: "Updated",
            mode: { _tag: "Composing", lane: event.lane, title: "" }
          }
        case "TypeQuickTitle":
          return {
            _tag: "Updated",
            mode: { _tag: "Composing", lane: mode.lane, title: event.text }
          }
        case "SubmitQuickCard": {
          const check = validateCardTitle(mode.title)
          if (!check.ok) {
            return { _tag: "ValidationFailed", error: check.error }
          }
          const nextMode: Extract<WorkspaceMode, { readonly _tag: "SubmittingCard" }> =
            {
              _tag: "SubmittingCard",
              requestId: event.nextRequestId,
              lane: mode.lane,
              title: check.title
            }
          return {
            _tag: "StartMint",
            mode: nextMode,
            requestId: event.nextRequestId,
            lane: mode.lane,
            title: check.title
          }
        }
        case "CancelQuickCard":
          return { _tag: "Updated", mode: IDLE_WORKSPACE_MODE }
        case "OpenEditor":
          return {
            _tag: "Updated",
            mode: { _tag: "EditingCard", draft: event.draft }
          }
        case "Reset":
          return { _tag: "Updated", mode: IDLE_WORKSPACE_MODE }
        case "ReceiveMintResult":
        case "FailMintResult":
        case "CommitEditedCard":
        case "CancelEditCard":
        case "CardDeleted":
          return IGNORED
        default:
          return exhaustiveEvent(event)
      }

    case "SubmittingCard":
      switch (event._tag) {
        case "ReceiveMintResult":
          if (event.requestId !== mode.requestId) {
            return IGNORED
          }
          return {
            _tag: "MintAccepted",
            mode: { _tag: "Idle" },
            requestId: event.requestId,
            lane: event.lane,
            title: event.title
          }
        case "FailMintResult":
          if (event.requestId !== mode.requestId) {
            return IGNORED
          }
          return {
            _tag: "MintFailed",
            mode: {
              _tag: "Composing",
              lane: mode.lane,
              title: mode.title
            },
            requestId: event.requestId
          }
        case "CancelQuickCard":
          return { _tag: "Updated", mode: IDLE_WORKSPACE_MODE }
        case "Reset":
          return { _tag: "Updated", mode: IDLE_WORKSPACE_MODE }
        case "SelectedLane":
        case "StartAddCard":
        case "TypeQuickTitle":
        case "SubmitQuickCard":
        case "OpenEditor":
        case "CommitEditedCard":
        case "CancelEditCard":
        case "CardDeleted":
          return IGNORED
        default:
          return exhaustiveEvent(event)
      }

    case "EditingCard":
      switch (event._tag) {
        case "StartAddCard":
          return {
            _tag: "Updated",
            mode: { _tag: "Composing", lane: event.lane, title: "" }
          }
        case "OpenEditor":
          return {
            _tag: "Updated",
            mode: { _tag: "EditingCard", draft: event.draft }
          }
        case "CommitEditedCard":
          if (event.draft.cardId !== mode.draft.cardId) {
            return IGNORED
          }
          return {
            _tag: "CommitEditCard",
            mode: { _tag: "Idle" },
            draft: event.draft,
            title: event.title
          }
        case "CancelEditCard":
        case "Reset":
          return { _tag: "Updated", mode: IDLE_WORKSPACE_MODE }
        case "CardDeleted":
          return mode.draft.cardId === event.cardId
            ? { _tag: "Updated", mode: IDLE_WORKSPACE_MODE }
            : IGNORED
        case "SelectedLane":
        case "TypeQuickTitle":
        case "SubmitQuickCard":
        case "ReceiveMintResult":
        case "FailMintResult":
        case "CancelQuickCard":
          return IGNORED
        default:
          return exhaustiveEvent(event)
      }

    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}
