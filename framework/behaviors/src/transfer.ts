import {
  createUndoStack,
  transferMessage,
  type TransferLists,
  type TransferReason,
  type UndoStackOptions
} from "@ui-sdk/core"

export type { TransferLists, TransferReason, UndoStackOptions }

export interface TransferNoticeParams {
  readonly type: "grab" | "move" | "drop" | "cancel"
  readonly itemId: string
  readonly itemLabel: string
  readonly listLabel: string
  readonly position: number
  readonly total: number
}

export const formatTransferNotice = (params: TransferNoticeParams): string =>
  transferMessage({
    type: params.type,
    key: params.itemId,
    label: params.itemLabel,
    list: params.listLabel,
    position: params.position,
    total: params.total
  })

export interface HistoryStack<State> {
  readonly record: (
    state: State,
    options?: { readonly group?: string; readonly time?: number }
  ) => void
  readonly undo: () => State | undefined
  readonly redo: () => State | undefined
  readonly canUndo: () => boolean
  readonly canRedo: () => boolean
  readonly reset: (state: State) => void
  readonly seal: () => void
}

export const createHistoryStack = <State>(
  initial: State,
  options?: UndoStackOptions
): HistoryStack<State> => {
  const stack = createUndoStack(initial, options)
  return {
    record: (state, opts) => stack.record(state, opts),
    undo: () => stack.undo(),
    redo: () => stack.redo(),
    canUndo: () => stack.canUndo(),
    canRedo: () => stack.canRedo(),
    reset: (state) => stack.reset(state),
    seal: () => stack.seal()
  }
}
