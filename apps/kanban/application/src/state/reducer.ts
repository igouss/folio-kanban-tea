import {
  applyCreateValidatedCard,
  applyDeleteCard,
  applyMoveCard,
  applyResetBoard,
  applySaveValidatedDraft,
  cardToDraft,
  findCard,
  redoHistory,
  themeLabel,
  toggleTheme,
  undoHistory,
  type Priority
} from "@folio/kanban-domain"
import { formatTransferNotice } from "@universal-ui/behaviors"
import { scoreCard } from "../presentation/search.ts"
import type {
  AppEffect,
  KanbanAction,
  ReduceContext,
  ReduceResult
} from "./actions.ts"
import {
  makeVisibleNotice,
  type InspectorVisibility,
  type KanbanState,
  type NoticeState,
  type ShellSlice
} from "./state.ts"
import {
  IDLE_WORKSPACE_MODE,
  transitionWorkspaceMode
} from "./workspaceMode.ts"

const NO_EFFECTS: ReadonlyArray<AppEffect> = []
const HIDDEN_NOTICE: NoticeState = { _tag: "Hidden" }

const toggleInspector = (
  inspector: InspectorVisibility
): InspectorVisibility => {
  switch (inspector) {
    case "closed":
      return "open"
    case "open":
      return "closed"
    default: {
      const _exhaustive: never = inspector
      return _exhaustive
    }
  }
}

const infoNotice = (message: string, announcement = message): NoticeState =>
  makeVisibleNotice("info", message, announcement)

const errorNotice = (message: string, announcement = message): NoticeState =>
  makeVisibleNotice("error", message, announcement)

const withDispatch = (
  shell: ShellSlice,
  patch?: Partial<Pick<ShellSlice, "notice" | "inspector">>
): ShellSlice => ({
  ...shell,
  ...patch,
  dispatchCount: shell.dispatchCount + 1
})

export const reduce = (
  state: KanbanState,
  action: KanbanAction,
  ctx: ReduceContext
): ReduceResult => {
  switch (action._tag) {
    case "SelectedLane": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "SelectedLane", lane: action.lane }
      )
      return {
        state: {
          ...state,
          workspace: {
            ...state.workspace,
            activeLane: action.lane,
            mode:
              transition._tag === "Updated"
                ? transition.mode
                : state.workspace.mode
          },
          shell: withDispatch(state.shell, { notice: HIDDEN_NOTICE })
        },
        effects: NO_EFFECTS
      }
    }

    case "TypedSearchQuery":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, searchQuery: action.text },
          shell: withDispatch(state.shell)
        },
        effects: NO_EFFECTS
      }

    case "SelectedPriorityFilter":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, priorityFilter: action.priority },
          shell: withDispatch(state.shell)
        },
        effects: NO_EFFECTS
      }

    case "SelectedDensity":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, density: action.density },
          shell: withDispatch(state.shell)
        },
        effects: [{ _tag: "ViewTransition", names: ["layout"] }]
      }

    case "ClickedToggleTheme": {
      const nextTheme = toggleTheme(state.board.theme)
      return {
        state: {
          ...state,
          board: { ...state.board, theme: nextTheme },
          shell: withDispatch(state.shell, {
            notice: infoNotice(`Switched theme to ${themeLabel(nextTheme)}.`)
          })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: state.board.cards, theme: nextTheme }
          }
        ]
      }
    }

    case "ClickedToggleInspector": {
      const nextInspector = toggleInspector(state.shell.inspector)
      return {
        state: {
          ...state,
          shell: withDispatch(state.shell, { inspector: nextInspector })
        },
        effects: NO_EFFECTS
      }
    }

    case "ClickedUndo": {
      const result = undoHistory(state.board.history, state.board.cards)
      if (result === undefined) return { state, effects: NO_EFFECTS }
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          shell: withDispatch(state.shell, {
            notice: infoNotice("Undid last change.")
          })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          }
        ]
      }
    }

    case "ClickedRedo": {
      const result = redoHistory(state.board.history, state.board.cards)
      if (result === undefined) return { state, effects: NO_EFFECTS }
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          shell: withDispatch(state.shell, {
            notice: infoNotice("Redid change.")
          })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          }
        ]
      }
    }

    case "ClickedStartAddCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "StartAddCard", lane: action.lane }
      )
      if (transition._tag !== "Updated") return { state, effects: NO_EFFECTS }
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, mode: transition.mode },
          shell: withDispatch(state.shell, { notice: HIDDEN_NOTICE })
        },
        effects: NO_EFFECTS
      }
    }

    case "TypedQuickTitle": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "TypeQuickTitle", text: action.text }
      )
      if (transition._tag !== "Updated") return { state, effects: NO_EFFECTS }
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, mode: transition.mode }
        },
        effects: NO_EFFECTS
      }
    }

    case "SubmittedQuickCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "SubmitQuickCard", nextRequestId: state.workspace.nextRequestId }
      )
      switch (transition._tag) {
        case "ValidationFailed":
          return {
            state: {
              ...state,
              shell: withDispatch(state.shell, {
                notice: errorNotice(transition.error)
              })
            },
            effects: NO_EFFECTS
          }
        case "StartMint":
          return {
            state: {
              ...state,
              workspace: {
                ...state.workspace,
                mode: transition.mode,
                nextRequestId: state.workspace.nextRequestId + 1
              },
              shell: withDispatch(state.shell, { notice: HIDDEN_NOTICE })
            },
            effects: [
              {
                _tag: "MintCardMeta",
                requestId: transition.requestId,
                title: transition.title,
                lane: transition.lane,
                tag: ctx.runtimeTag
              }
            ]
          }
        default:
          return { state, effects: NO_EFFECTS }
      }
    }

    case "CompletedMintCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        {
          _tag: "ReceiveMintResult",
          requestId: action.requestId,
          lane: action.lane,
          title: action.title
        }
      )
      if (transition._tag !== "MintAccepted") {
        return { state, effects: NO_EFFECTS }
      }
      const createdPriority: Priority =
        state.workspace.priorityFilter === "all"
          ? "medium"
          : state.workspace.priorityFilter
      const result = applyCreateValidatedCard(state.board, {
        title: transition.title,
        lane: transition.lane,
        id: action.id,
        tag: action.tag,
        createdAt: action.createdAt,
        priority: createdPriority
      })
      const clearedSearch =
        state.workspace.searchQuery.trim().length > 0 &&
        scoreCard(result.card, state.workspace.searchQuery) === 0
      const message = clearedSearch
        ? `Added ${result.card.code} "${result.card.title}" to ${result.laneName} (cleared search filter).`
        : `Added ${result.card.code} "${result.card.title}" to ${result.laneName}.`
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: {
            ...state.workspace,
            ...(clearedSearch ? { searchQuery: "" } : {}),
            mode: transition.mode
          },
          shell: withDispatch(state.shell, { notice: infoNotice(message) })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          }
        ]
      }
    }

    case "FailedMintCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "FailMintResult", requestId: action.requestId }
      )
      if (transition._tag !== "MintFailed") {
        return { state, effects: NO_EFFECTS }
      }
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, mode: transition.mode },
          shell: withDispatch(state.shell, {
            notice: errorNotice(`Could not create card: ${action.error}`)
          })
        },
        effects: NO_EFFECTS
      }
    }

    case "CancelledQuickCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "CancelQuickCard" }
      )
      if (transition._tag !== "Updated") return { state, effects: NO_EFFECTS }
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, mode: transition.mode },
          shell: withDispatch(state.shell, { notice: HIDDEN_NOTICE })
        },
        effects: NO_EFFECTS
      }
    }

    case "ClickedMoveCard": {
      const result = applyMoveCard(state.board, action.cardId, action.toLane)
      if (result === undefined) return { state, effects: NO_EFFECTS }
      const announcement = formatTransferNotice({
        type: "drop",
        itemId: action.cardId,
        itemLabel: result.card.title,
        listLabel: result.laneName,
        position: 1,
        total: result.totalInTargetLane
      })
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          shell: withDispatch(state.shell, {
            notice: infoNotice(
              `Moved ${result.card.code} to ${result.laneName}.`,
              announcement
            )
          })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          },
          { _tag: "ViewTransition", names: ["move-card"] }
        ]
      }
    }

    case "ClickedDeleteCard": {
      const result = applyDeleteCard(state.board, action.cardId)
      if (result === undefined) return { state, effects: NO_EFFECTS }
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "CardDeleted", cardId: action.cardId }
      )
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: {
            ...state.workspace,
            mode:
              transition._tag === "Updated"
                ? transition.mode
                : state.workspace.mode
          },
          shell: withDispatch(state.shell, {
            notice: infoNotice(`Deleted ${result.card.code}.`)
          })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          }
        ]
      }
    }

    case "ClickedOpenEditor": {
      const card = findCard(state.board.cards, action.cardId)
      if (card === undefined) return { state, effects: NO_EFFECTS }
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "OpenEditor", draft: cardToDraft(card) }
      )
      if (transition._tag !== "Updated") return { state, effects: NO_EFFECTS }
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, mode: transition.mode },
          shell: withDispatch(state.shell, { notice: HIDDEN_NOTICE })
        },
        effects: NO_EFFECTS
      }
    }

    case "SavedEditedCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        {
          _tag: "CommitEditedCard",
          draft: action.draft,
          title: action.title
        }
      )
      if (transition._tag !== "CommitEditCard") {
        return { state, effects: NO_EFFECTS }
      }
      const result = applySaveValidatedDraft(
        state.board,
        transition.draft,
        transition.title
      )
      if (!result.ok) {
        return {
          state: {
            ...state,
            shell: withDispatch(state.shell, {
              notice: errorNotice(result.error)
            })
          },
          effects: NO_EFFECTS
        }
      }
      return {
        state: {
          ...state,
          board: {
            ...state.board,
            cards: result.cards,
            history: result.history
          },
          workspace: {
            ...state.workspace,
            activeLane: transition.draft.lane,
            mode: transition.mode
          },
          shell: withDispatch(state.shell, {
            notice: infoNotice(`Saved ${result.card.code}.`)
          })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          }
        ]
      }
    }

    case "CancelledEditCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "CancelEditCard" }
      )
      if (transition._tag !== "Updated") return { state, effects: NO_EFFECTS }
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, mode: transition.mode },
          shell: withDispatch(state.shell, { notice: HIDDEN_NOTICE })
        },
        effects: NO_EFFECTS
      }
    }

    case "ClickedResetDemo": {
      const result = applyResetBoard(state.board)
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "Reset" }
      )
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: {
            ...state.workspace,
            activeLane: "in_progress",
            searchQuery: "",
            priorityFilter: "all",
            mode:
              transition._tag === "Updated"
                ? transition.mode
                : IDLE_WORKSPACE_MODE
          },
          shell: withDispatch(state.shell, {
            notice: infoNotice("Reset board to default cards.")
          })
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          }
        ]
      }
    }

    case "DismissedNotice": {
      const notice = state.shell.notice
      switch (notice._tag) {
        case "Hidden":
          return { state, effects: NO_EFFECTS }
        case "Visible":
          return {
            state: {
              ...state,
              shell: { ...state.shell, notice: HIDDEN_NOTICE }
            },
            effects: NO_EFFECTS
          }
        default: {
          const _exhaustive: never = notice
          return _exhaustive
        }
      }
    }

    case "ChangedLifecycle": {
      const nextLifecycle = action.state
      let enteredBackground: boolean
      switch (nextLifecycle) {
        case "background":
          enteredBackground = state.shell.lifecycle !== "background"
          break
        case "active":
        case "inactive":
          enteredBackground = false
          break
        default: {
          const _exhaustive: never = nextLifecycle
          return _exhaustive
        }
      }
      return {
        state: {
          ...state,
          shell: {
            ...state.shell,
            lifecycle: nextLifecycle,
            backgroundTrips: enteredBackground
              ? state.shell.backgroundTrips + 1
              : state.shell.backgroundTrips
          }
        },
        effects: NO_EFFECTS
      }
    }

    case "ChangedViewport":
      return {
        state: {
          ...state,
          shell: { ...state.shell, viewport: action.viewport }
        },
        effects: NO_EFFECTS
      }

    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
