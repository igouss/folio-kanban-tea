import {
  applyDeleteCard,
  applyMoveCard,
  applyQuickCreate,
  applyResetBoard,
  applySaveDraft,
  cardToDraft,
  findCard,
  normalizeDraftAssignee,
  redoHistory,
  themeLabel,
  toggleTheme,
  undoHistory,
  validateCardTitle,
  type CardDraft
} from "@folio/kanban-domain"
import { formatTransferNotice } from "@universal-ui/behaviors"
import type {
  AppEffect,
  KanbanAction,
  ReduceContext,
  ReduceResult
} from "./actions.ts"
import type { KanbanState, ShellSlice } from "./state.ts"

const MAX_TRACE_ENTRIES = 16
const NO_EFFECTS: ReadonlyArray<AppEffect> = []

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
  patch?: Partial<Pick<ShellSlice, "notice" | "statusAnnouncement" | "inspectorOpen">>
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
  if (state.workspace.editor._tag !== "Open") {
    return { state, effects: NO_EFFECTS }
  }
  return {
    state: {
      ...state,
      workspace: {
        ...state.workspace,
        editor: { _tag: "Open", draft: update(state.workspace.editor.draft) }
      }
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
    case "SelectedLane":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, activeLane: action.lane },
          shell: withTrace(state.shell, `SelectedLane(${action.lane})`, {
            notice: "",
            statusAnnouncement: ""
          })
        },
        effects: NO_EFFECTS
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
      const message = `Switched theme to ${themeLabel(nextTheme)}.`
      return {
        state: {
          ...state,
          board: { ...state.board, theme: nextTheme },
          shell: withTrace(state.shell, `ClickedToggleTheme(${nextTheme})`, {
            notice: message,
            statusAnnouncement: message
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
      const nextOpen = !state.shell.inspectorOpen
      return {
        state: {
          ...state,
          shell: withTrace(
            state.shell,
            `ClickedToggleInspector(${nextOpen ? "open" : "closed"})`,
            { inspectorOpen: nextOpen }
          )
        },
        effects: NO_EFFECTS
      }
    }

    case "ClickedUndo": {
      const result = undoHistory(state.board.history, state.board.cards)
      if (result === undefined) return { state, effects: NO_EFFECTS }
      const message = "Undid last change."
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          shell: withTrace(state.shell, "ClickedUndo", {
            notice: message,
            statusAnnouncement: message
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
      const message = "Redid change."
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          shell: withTrace(state.shell, "ClickedRedo", {
            notice: message,
            statusAnnouncement: message
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

    case "ClickedStartAddCard":
      return {
        state: {
          ...state,
          workspace: {
            ...state.workspace,
            composer: { _tag: "Open", lane: action.lane, title: "" }
          },
          shell: withTrace(state.shell, `ClickedStartAddCard(${action.lane})`, {
            notice: ""
          })
        },
        effects: NO_EFFECTS
      }

    case "TypedQuickTitle": {
      const lane =
        state.workspace.composer._tag === "Open"
          ? state.workspace.composer.lane
          : state.workspace.activeLane
      return {
        state: {
          ...state,
          workspace: {
            ...state.workspace,
            composer: { _tag: "Open", lane, title: action.text }
          }
        },
        effects: NO_EFFECTS
      }
    }

    case "SubmittedQuickCard": {
      const targetLane =
        state.workspace.composer._tag === "Open"
          ? state.workspace.composer.lane
          : state.workspace.activeLane
      const rawTitle =
        state.workspace.composer._tag === "Open"
          ? state.workspace.composer.title
          : ""
      const check = validateCardTitle(rawTitle, 2)
      if (!check.ok) {
        return {
          state: {
            ...state,
            shell: withTrace(state.shell, "SubmittedQuickCard(invalid)", {
              notice: check.error,
              statusAnnouncement: check.error
            })
          },
          effects: NO_EFFECTS
        }
      }
      return {
        state,
        effects: [
          {
            _tag: "MintCardMeta",
            title: check.title,
            lane: targetLane,
            tag: ctx.runtimeTag
          }
        ]
      }
    }

    case "CompletedMintCard": {
      const result = applyQuickCreate(state.board, {
        title: action.title,
        lane: action.lane,
        id: action.id,
        tag: action.tag,
        createdAt: action.createdAt
      })
      if (!result.ok) {
        return {
          state: {
            ...state,
            shell: withTrace(state.shell, "CompletedMintCard(invalid)", {
              notice: result.error,
              statusAnnouncement: result.error
            })
          },
          effects: NO_EFFECTS
        }
      }
      const message = `Added ${result.card.code} "${result.card.title}" to ${result.laneName}.`
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: { ...state.workspace, composer: { _tag: "Closed" } },
          shell: withTrace(
            state.shell,
            `CompletedMintCard(${result.card.code} -> ${action.lane})`,
            { notice: message, statusAnnouncement: message }
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

    case "CancelledQuickCard":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, composer: { _tag: "Closed" } },
          shell: withTrace(state.shell, "CancelledQuickCard")
        },
        effects: NO_EFFECTS
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
              notice: `Moved ${result.card.code} to ${result.laneName}.`,
              statusAnnouncement: announcement
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
      const message = `Deleted ${result.card.code}.`
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: { ...state.workspace, editor: { _tag: "Closed" } },
          shell: withTrace(state.shell, `ClickedDeleteCard(${result.card.code})`, {
            notice: message,
            statusAnnouncement: message
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
      return {
        state: {
          ...state,
          workspace: {
            ...state.workspace,
            editor: { _tag: "Open", draft: cardToDraft(card) }
          },
          shell: withTrace(state.shell, `ClickedOpenEditor(${card.code})`, {
            notice: "",
            statusAnnouncement: ""
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
      if (state.workspace.editor._tag !== "Open") {
        return { state, effects: NO_EFFECTS }
      }
      const draft = state.workspace.editor.draft
      const result = applySaveDraft(state.board, draft)
      if (!result.ok) {
        return {
          state: {
            ...state,
            shell: withTrace(state.shell, "SubmittedEditCard(invalid)", {
              notice: result.error,
              statusAnnouncement: result.error
            })
          },
          effects: NO_EFFECTS
        }
      }
      const message = `Saved ${result.card.code}.`
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: {
            ...state.workspace,
            activeLane: draft.lane,
            editor: { _tag: "Closed" }
          },
          shell: withTrace(state.shell, `SubmittedEditCard(${result.card.code})`, {
            notice: message,
            statusAnnouncement: message
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

    case "CancelledEditCard":
      return {
        state: {
          ...state,
          workspace: { ...state.workspace, editor: { _tag: "Closed" } },
          shell: withTrace(state.shell, "CancelledEditCard", { notice: "" })
        },
        effects: NO_EFFECTS
      }

    case "ClickedResetDemo": {
      const result = applyResetBoard(state.board)
      const message = "Reset board to default cards."
      return {
        state: {
          ...state,
          board: { ...state.board, cards: result.cards, history: result.history },
          workspace: {
            ...state.workspace,
            activeLane: "in_progress",
            searchQuery: "",
            priorityFilter: "all",
            composer: { _tag: "Closed" },
            editor: { _tag: "Closed" }
          },
          shell: withTrace(state.shell, "ClickedResetDemo", {
            notice: message,
            statusAnnouncement: message
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

    case "DismissedNotice":
      return {
        state: {
          ...state,
          shell: { ...state.shell, notice: "", statusAnnouncement: "" }
        },
        effects: NO_EFFECTS
      }

    case "ChangedLifecycle": {
      const enteredBackground =
        action.state === "background" && !state.shell.isBackgrounded
      return {
        state: {
          ...state,
          shell: {
            ...state.shell,
            lifecycle: action.state,
            isBackgrounded: action.state === "background",
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
