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
const RESET_IDLE: WorkspaceModeTransition = {
  _tag: "Updated",
  mode: IDLE_WORKSPACE_MODE
}

const updated = (mode: WorkspaceMode): WorkspaceModeTransition => ({
  _tag: "Updated",
  mode
})

export const transitionWorkspaceMode = (
  mode: WorkspaceMode,
  activeLane: LaneId,
  event: WorkspaceModeEvent
): WorkspaceModeTransition => {
  if (event._tag === "Reset") return RESET_IDLE

  switch (mode._tag) {
    case "Idle":
      switch (event._tag) {
        case "StartAddCard":
          return updated({ _tag: "Composing", lane: event.lane, title: "" })
        case "TypeQuickTitle":
          return updated({ _tag: "Composing", lane: activeLane, title: event.text })
        case "SubmitQuickCard": {
          const check = validateCardTitle("")
          return check.ok ? IGNORED : { _tag: "ValidationFailed", error: check.error }
        }
        case "OpenEditor":
          return updated({ _tag: "EditingCard", draft: event.draft })
        default:
          return IGNORED
      }

    case "Composing":
      switch (event._tag) {
        case "SelectedLane":
          return updated({ ...mode, lane: event.lane })
        case "StartAddCard":
          return updated({ _tag: "Composing", lane: event.lane, title: "" })
        case "TypeQuickTitle":
          return updated({ _tag: "Composing", lane: mode.lane, title: event.text })
        case "SubmitQuickCard": {
          const check = validateCardTitle(mode.title)
          if (!check.ok) return { _tag: "ValidationFailed", error: check.error }
          const nextMode: Extract<WorkspaceMode, { readonly _tag: "SubmittingCard" }> = {
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
          return RESET_IDLE
        case "OpenEditor":
          return updated({ _tag: "EditingCard", draft: event.draft })
        default:
          return IGNORED
      }

    case "SubmittingCard":
      switch (event._tag) {
        case "ReceiveMintResult":
          return event.requestId === mode.requestId
            ? {
                _tag: "MintAccepted",
                mode: { _tag: "Idle" },
                requestId: event.requestId,
                lane: event.lane,
                title: event.title
              }
            : IGNORED
        case "FailMintResult":
          return event.requestId === mode.requestId
            ? {
                _tag: "MintFailed",
                mode: { _tag: "Composing", lane: mode.lane, title: mode.title },
                requestId: event.requestId
              }
            : IGNORED
        case "CancelQuickCard":
          return RESET_IDLE
        default:
          return IGNORED
      }

    case "EditingCard":
      switch (event._tag) {
        case "StartAddCard":
          return updated({ _tag: "Composing", lane: event.lane, title: "" })
        case "OpenEditor":
          return updated({ _tag: "EditingCard", draft: event.draft })
        case "CommitEditedCard":
          return event.draft.cardId === mode.draft.cardId
            ? {
                _tag: "CommitEditCard",
                mode: { _tag: "Idle" },
                draft: event.draft,
                title: event.title
              }
            : IGNORED
        case "CancelEditCard":
          return RESET_IDLE
        case "CardDeleted":
          return mode.draft.cardId === event.cardId ? RESET_IDLE : IGNORED
        default:
          return IGNORED
      }

    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}
