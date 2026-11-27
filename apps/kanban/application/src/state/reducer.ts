import {
  applyCreateValidatedCard,
  applyDeleteCard,
  applyMoveCard,
  applyResetBoard,
  applySaveValidatedDraft,
  cardToDraft,
  findCard,
  normalizeDraftAssignee,
  redoHistory,
  themeLabel,
  toggleTheme,
  undoHistory,
  type CardDraft
} from "@folio/kanban-domain"
import { formatTransferNotice } from "@universal-ui/behaviors"
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

const MAX_TRACE_ENTRIES = 16
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

const appendTrace = (
  entries: ReadonlyArray<string>,
  count: number,
  label: string
): ReadonlyArray<string> => [
  `#${count} ${label}`,
  ...entries.slice(0, MAX_TRACE_ENTRIES - 1)
]

const withTrace = (
  shell: ShellSlice,
  label: string,
  patch?: Partial<Pick<ShellSlice, "notice" | "inspector">>
): ShellSlice => {
  const dispatchCount = shell.dispatchCount + 1
  return {
    ...shell,
    ...patch,
    dispatchCount,
    traceEntries: appendTrace(shell.traceEntries, dispatchCount, label)
  }
}

const mapEditorDraft = (
  state: KanbanState,
  update: (draft: CardDraft) => CardDraft
): ReduceResult => {
  const transition = transitionWorkspaceMode(
    state.workspace.mode,
    state.workspace.activeLane,
    { _tag: "UpdateDraft", update }
  )
  if (transition._tag !== "Updated") {
    return { state, effects: NO_EFFECTS }
  }
  return {
    state: {
      ...state,
      workspace: { ...state.workspace, mode: transition.mode }
    },
    effects: NO_EFFECTS
  }
}

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
          shell: withTrace(state.shell, `SelectedLane(${action.lane})`, {
            notice: HIDDEN_NOTICE
          })
        },
        effects: NO_EFFECTS
      }
    }

    case "TypedSearchQuery":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, searchQuery: action.text },
          shell: withTrace(state.shell, `TypedSearchQuery("${action.text}")`)
        },
        effects: NO_EFFECTS
      }

    case "SelectedPriorityFilter":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, priorityFilter: action.priority },
          shell: withTrace(
            state.shell,
            `SelectedPriorityFilter(${action.priority})`
          )
        },
        effects: NO_EFFECTS
      }

    case "SelectedDensity":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, density: action.density },
          shell: withTrace(state.shell, `SelectedDensity(${action.density})`)
        },
        effects: [{ _tag: "ViewTransition", names: ["layout"] }]
      }

    case "ClickedToggleTheme": {
      const nextTheme = toggleTheme(state.board.theme)
      return {
        state: {
          ...state,
          board: { ...state.board, theme: nextTheme },
          shell: withTrace(state.shell, `ClickedToggleTheme(${nextTheme})`, {
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
          shell: withTrace(
            state.shell,
            `ClickedToggleInspector(${nextInspector})`,
            { inspector: nextInspector }
          )
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
          shell: withTrace(state.shell, "ClickedUndo", {
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
          shell: withTrace(state.shell, "ClickedRedo", {
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
          shell: withTrace(state.shell, `ClickedStartAddCard(${action.lane})`, {
            notice: HIDDEN_NOTICE
          })
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
              shell: withTrace(state.shell, "SubmittedQuickCard(invalid)", {
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
              shell: withTrace(
                state.shell,
                `SubmittedQuickCard(${transition.lane}#${transition.requestId})`,
                { notice: HIDDEN_NOTICE }
              )
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
      const result = applyCreateValidatedCard(state.board, {
        title: transition.title,
        lane: transition.lane,
        id: action.id,
        tag: action.tag,
        createdAt: action.createdAt
      })
      const message = `Added ${result.card.code} "${result.card.title}" to ${result.laneName}.`
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: { ...state.workspace, mode: transition.mode },
          shell: withTrace(
            state.shell,
            `CompletedMintCard(${result.card.code} -> ${transition.lane})`,
            { notice: infoNotice(message) }
          )
        },
        effects: [
          {
            _tag: "PersistBoard",
            board: { cards: result.cards, theme: state.board.theme }
          }
        ]
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
          shell: withTrace(state.shell, "CancelledQuickCard", {
            notice: HIDDEN_NOTICE
          })
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
          shell: withTrace(
            state.shell,
            `ClickedMoveCard(${result.card.code} -> ${action.toLane})`,
            {
              notice: infoNotice(
                `Moved ${result.card.code} to ${result.laneName}.`,
                announcement
              )
            }
          )
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
          shell: withTrace(state.shell, `ClickedDeleteCard(${result.card.code})`, {
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
          shell: withTrace(state.shell, `ClickedOpenEditor(${card.code})`, {
            notice: HIDDEN_NOTICE
          })
        },
        effects: NO_EFFECTS
      }
    }

    case "TypedEditTitle":
      return mapEditorDraft(state, (d) => ({ ...d, title: action.text }))

    case "TypedEditNotes":
      return mapEditorDraft(state, (d) => ({ ...d, notes: action.text }))

    case "TypedEditAssignee":
      return mapEditorDraft(state, (d) => ({
        ...d,
        assignee: normalizeDraftAssignee(action.text)
      }))

    case "SelectedEditLane":
      return mapEditorDraft(state, (d) => ({ ...d, lane: action.lane }))

    case "SelectedEditPriority":
      return mapEditorDraft(state, (d) => ({ ...d, priority: action.priority }))

    case "SelectedEditPoints":
      return mapEditorDraft(state, (d) => ({ ...d, points: action.points }))

    case "SubmittedEditCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "SubmitEditCard" }
      )
      switch (transition._tag) {
        case "ValidationFailed":
          return {
            state: {
              ...state,
              shell: withTrace(state.shell, "SubmittedEditCard(invalid)", {
                notice: errorNotice(transition.error)
              })
            },
            effects: NO_EFFECTS
          }
        case "CommitEditCard": {
          const result = applySaveValidatedDraft(
            state.board,
            transition.draft,
            transition.title
          )
          if (!result.ok) {
            return {
              state: {
                ...state,
                shell: withTrace(state.shell, "SubmittedEditCard(invalid)", {
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
              shell: withTrace(
                state.shell,
                `SubmittedEditCard(${result.card.code})`,
                { notice: infoNotice(`Saved ${result.card.code}.`) }
              )
            },
            effects: [
              {
                _tag: "PersistBoard",
                board: { cards: result.cards, theme: state.board.theme }
              }
            ]
          }
        }
        default:
          return { state, effects: NO_EFFECTS }
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
          shell: withTrace(state.shell, "CancelledEditCard", {
            notice: HIDDEN_NOTICE
          })
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
          shell: withTrace(state.shell, "ClickedResetDemo", {
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
