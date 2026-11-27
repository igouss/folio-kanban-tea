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
  type BoardHistoryState,
  type KanbanCard,
  type Priority,
  type ThemeMode
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
  type BoardSlice,
  type KanbanState,
  type NoticeState,
  type ShellSlice,
  type WorkspaceSlice
} from "./state.ts"
import {
  IDLE_WORKSPACE_MODE,
  transitionWorkspaceMode,
  type WorkspaceModeEvent
} from "./workspaceMode.ts"

const NO_EFFECTS: ReadonlyArray<AppEffect> = []
const HIDDEN_NOTICE: NoticeState = { _tag: "Hidden" }

const infoNotice = (message: string, announcement = message): NoticeState =>
  makeVisibleNotice("info", message, announcement)

const errorNotice = (message: string, announcement = message): NoticeState =>
  makeVisibleNotice("error", message, announcement)

const noop = (state: KanbanState): ReduceResult => ({
  state,
  effects: NO_EFFECTS
})

const persistBoard = (
  cards: ReadonlyArray<KanbanCard>,
  theme: ThemeMode
): AppEffect => ({ _tag: "PersistBoard", board: { cards, theme } })

const dispatchUpdate = (
  state: KanbanState,
  patch: {
    readonly board?: Partial<BoardSlice>
    readonly workspace?: Partial<WorkspaceSlice>
    readonly shell?: Partial<ShellSlice>
    readonly countDispatch?: boolean
  },
  effects: ReadonlyArray<AppEffect> = NO_EFFECTS
): ReduceResult => ({
  state: {
    board: patch.board ? { ...state.board, ...patch.board } : state.board,
    workspace: patch.workspace
      ? { ...state.workspace, ...patch.workspace }
      : state.workspace,
    shell: {
      ...state.shell,
      ...patch.shell,
      ...(patch.countDispatch === false
        ? {}
        : { dispatchCount: state.shell.dispatchCount + 1 })
    }
  },
  effects
})

const applyHistoryStep = (
  state: KanbanState,
  result:
    | { readonly cards: ReadonlyArray<KanbanCard>; readonly history: BoardHistoryState }
    | undefined,
  message: string
): ReduceResult =>
  result === undefined
    ? noop(state)
    : dispatchUpdate(
        state,
        {
          board: { cards: result.cards, history: result.history },
          shell: { notice: infoNotice(message) }
        },
        [persistBoard(result.cards, state.board.theme)]
      )

const applyModeEvent = (
  state: KanbanState,
  event: WorkspaceModeEvent,
  options: { readonly clearNotice?: boolean; readonly countDispatch?: boolean } = {}
): ReduceResult => {
  const transition = transitionWorkspaceMode(
    state.workspace.mode,
    state.workspace.activeLane,
    event
  )
  if (transition._tag !== "Updated") return noop(state)
  return dispatchUpdate(state, {
    workspace: { mode: transition.mode },
    ...(options.clearNotice ? { shell: { notice: HIDDEN_NOTICE } } : {}),
    ...(options.countDispatch === false ? { countDispatch: false } : {})
  })
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
      return dispatchUpdate(state, {
        workspace: {
          activeLane: action.lane,
          ...(transition._tag === "Updated" ? { mode: transition.mode } : {})
        },
        shell: { notice: HIDDEN_NOTICE }
      })
    }

    case "TypedSearchQuery":
      return dispatchUpdate(state, { workspace: { searchQuery: action.text } })

    case "SelectedPriorityFilter":
      return dispatchUpdate(state, {
        workspace: { priorityFilter: action.priority }
      })

    case "SelectedDensity":
      return dispatchUpdate(
        state,
        { workspace: { density: action.density } },
        [{ _tag: "ViewTransition", names: ["layout"] }]
      )

    case "ClickedToggleTheme": {
      const nextTheme = toggleTheme(state.board.theme)
      return dispatchUpdate(
        state,
        {
          board: { theme: nextTheme },
          shell: {
            notice: infoNotice(`Switched theme to ${themeLabel(nextTheme)}.`)
          }
        },
        [persistBoard(state.board.cards, nextTheme)]
      )
    }

    case "ClickedToggleInspector":
      return dispatchUpdate(state, {
        shell: {
          inspector: state.shell.inspector === "closed" ? "open" : "closed"
        }
      })

    case "ClickedUndo":
      return applyHistoryStep(
        state,
        undoHistory(state.board.history, state.board.cards),
        "Undid last change."
      )

    case "ClickedRedo":
      return applyHistoryStep(
        state,
        redoHistory(state.board.history, state.board.cards),
        "Redid change."
      )

    case "ClickedStartAddCard":
      return applyModeEvent(
        state,
        { _tag: "StartAddCard", lane: action.lane },
        { clearNotice: true }
      )

    case "TypedQuickTitle":
      return applyModeEvent(
        state,
        { _tag: "TypeQuickTitle", text: action.text },
        { countDispatch: false }
      )

    case "SubmittedQuickCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "SubmitQuickCard", nextRequestId: state.workspace.nextRequestId }
      )
      switch (transition._tag) {
        case "ValidationFailed":
          return dispatchUpdate(state, {
            shell: { notice: errorNotice(transition.error) }
          })
        case "StartMint":
          return dispatchUpdate(
            state,
            {
              workspace: {
                mode: transition.mode,
                nextRequestId: state.workspace.nextRequestId + 1
              },
              shell: { notice: HIDDEN_NOTICE }
            },
            [
              {
                _tag: "MintCardMeta",
                requestId: transition.requestId,
                title: transition.title,
                lane: transition.lane,
                tag: ctx.runtimeTag
              }
            ]
          )
        default:
          return noop(state)
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
      if (transition._tag !== "MintAccepted") return noop(state)
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
      return dispatchUpdate(
        state,
        {
          board: { cards: result.cards, history: result.history },
          workspace: {
            ...(clearedSearch ? { searchQuery: "" } : {}),
            mode: transition.mode
          },
          shell: { notice: infoNotice(message) }
        },
        [persistBoard(result.cards, state.board.theme)]
      )
    }

    case "FailedMintCard": {
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "FailMintResult", requestId: action.requestId }
      )
      if (transition._tag !== "MintFailed") return noop(state)
      return dispatchUpdate(state, {
        workspace: { mode: transition.mode },
        shell: { notice: errorNotice(`Could not create card: ${action.error}`) }
      })
    }

    case "CancelledQuickCard":
      return applyModeEvent(
        state,
        { _tag: "CancelQuickCard" },
        { clearNotice: true }
      )

    case "ClickedMoveCard": {
      const result = applyMoveCard(state.board, action.cardId, action.toLane)
      if (result === undefined) return noop(state)
      const announcement = formatTransferNotice({
        type: "drop",
        itemId: action.cardId,
        itemLabel: result.card.title,
        listLabel: result.laneName,
        position: 1,
        total: result.totalInTargetLane
      })
      return dispatchUpdate(
        state,
        {
          board: { cards: result.cards, history: result.history },
          shell: {
            notice: infoNotice(
              `Moved ${result.card.code} to ${result.laneName}.`,
              announcement
            )
          }
        },
        [
          persistBoard(result.cards, state.board.theme),
          { _tag: "ViewTransition", names: ["move-card"] }
        ]
      )
    }

    case "ClickedDeleteCard": {
      const result = applyDeleteCard(state.board, action.cardId)
      if (result === undefined) return noop(state)
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "CardDeleted", cardId: action.cardId }
      )
      return dispatchUpdate(
        state,
        {
          board: { cards: result.cards, history: result.history },
          ...(transition._tag === "Updated"
            ? { workspace: { mode: transition.mode } }
            : {}),
          shell: { notice: infoNotice(`Deleted ${result.card.code}.`) }
        },
        [persistBoard(result.cards, state.board.theme)]
      )
    }

    case "ClickedOpenEditor": {
      const card = findCard(state.board.cards, action.cardId)
      if (card === undefined) return noop(state)
      return applyModeEvent(
        state,
        { _tag: "OpenEditor", draft: cardToDraft(card) },
        { clearNotice: true }
      )
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
      if (transition._tag !== "CommitEditCard") return noop(state)
      const result = applySaveValidatedDraft(
        state.board,
        transition.draft,
        transition.title
      )
      if (!result.ok) {
        return dispatchUpdate(state, {
          shell: { notice: errorNotice(result.error) }
        })
      }
      return dispatchUpdate(
        state,
        {
          board: { cards: result.cards, history: result.history },
          workspace: {
            activeLane: transition.draft.lane,
            mode: transition.mode
          },
          shell: { notice: infoNotice(`Saved ${result.card.code}.`) }
        },
        [persistBoard(result.cards, state.board.theme)]
      )
    }

    case "CancelledEditCard":
      return applyModeEvent(
        state,
        { _tag: "CancelEditCard" },
        { clearNotice: true }
      )

    case "ClickedResetDemo": {
      const result = applyResetBoard(state.board)
      const transition = transitionWorkspaceMode(
        state.workspace.mode,
        state.workspace.activeLane,
        { _tag: "Reset" }
      )
      return dispatchUpdate(
        state,
        {
          board: { cards: result.cards, history: result.history },
          workspace: {
            activeLane: "in_progress",
            searchQuery: "",
            priorityFilter: "all",
            mode:
              transition._tag === "Updated"
                ? transition.mode
                : IDLE_WORKSPACE_MODE
          },
          shell: { notice: infoNotice("Reset board to default cards.") }
        },
        [persistBoard(result.cards, state.board.theme)]
      )
    }

    case "DismissedNotice":
      return state.shell.notice._tag === "Hidden"
        ? noop(state)
        : dispatchUpdate(state, {
            shell: { notice: HIDDEN_NOTICE },
            countDispatch: false
          })

    case "ChangedLifecycle": {
      const enteredBackground =
        action.state === "background" && state.shell.lifecycle !== "background"
      return dispatchUpdate(state, {
        shell: {
          lifecycle: action.state,
          backgroundTrips: enteredBackground
            ? state.shell.backgroundTrips + 1
            : state.shell.backgroundTrips
        },
        countDispatch: false
      })
    }

    case "ChangedViewport":
      return dispatchUpdate(state, {
        shell: { viewport: action.viewport },
        countDispatch: false
      })

    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
