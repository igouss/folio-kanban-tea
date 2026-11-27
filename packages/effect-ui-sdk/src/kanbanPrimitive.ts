import {
  createChange,
  createSelection,
  createTransfer,
  createUndoStack,
  definePrimitive,
  selects,
  transferMessage,
  type ChangeDetails,
  type TransferDraft,
  type TransferLists,
  type TransferReason,
  type UndoStackOptions
} from "@ui-sdk/core"

export type { TransferLists, TransferReason, UndoStackOptions }

export type KanbanSelectionReason = "item-press" | "imperative"

export interface KanbanBoardOptions {
  readonly lists?: TransferLists
  readonly defaultLists?: TransferLists
  readonly onListsChange?: (
    lists: TransferLists,
    details: ChangeDetails<TransferReason> & {
      readonly key: string
      readonly from: string
      readonly to: string
      readonly index: number
    }
  ) => void
  readonly selected?: string[]
  readonly defaultSelected?: string[]
  readonly onSelectedChange?: (
    selected: string[],
    details: ChangeDetails<KanbanSelectionReason>
  ) => void
  readonly order?: ReadonlyArray<string>
  readonly wipLimits?: Readonly<Record<string, number | null>>
  readonly cardLabel?: (cardId: string) => string | undefined
  readonly laneLabel?: (laneId: string) => string | undefined
  readonly multiple?: boolean
  readonly label?: string
}

interface KanbanBoardState {
  lists: TransferLists
  draft: TransferDraft | null
  selected: string[]
  lastAnnouncement: string
}

const cloneLists = (lists: TransferLists | undefined): TransferLists => {
  const out: TransferLists = {}
  if (lists === undefined) return out
  for (const [lane, ids] of Object.entries(lists)) {
    out[lane] = [...ids]
  }
  return out
}

const orderedCardIds = (
  lists: TransferLists,
  order?: ReadonlyArray<string>
): string[] => {
  const laneIds = order ?? Object.keys(lists)
  const out: string[] = []
  for (const laneId of laneIds) {
    const items = lists[laneId]
    if (items !== undefined) out.push(...items)
  }
  return out
}

export const formatTransferNotice = (params: {
  readonly type: "grab" | "move" | "drop" | "cancel"
  readonly cardId: string
  readonly cardTitle: string
  readonly laneTitle: string
  readonly position: number
  readonly total: number
}): string =>
  transferMessage({
    type: params.type,
    key: params.cardId,
    label: params.cardTitle,
    list: params.laneTitle,
    position: params.position,
    total: params.total
  })

export const kanbanBoard = definePrimitive({
  name: "kanban-board",
  options: {
    lists: "value",
    defaultLists: "value",
    onListsChange: "callback",
    selected: "list",
    defaultSelected: "list",
    onSelectedChange: "callback",
    order: "list",
    wipLimits: "value",
    cardLabel: "callback",
    laneLabel: "callback",
    multiple: "boolean",
    label: "string"
  },
  controlled: ["lists", "selected"],
  state: (options: KanbanBoardOptions): KanbanBoardState => ({
    lists: cloneLists(options.lists ?? options.defaultLists),
    draft: null,
    selected: [...(options.selected ?? options.defaultSelected ?? [])],
    lastAnnouncement: ""
  }),
  sync: (options) => {
    const patch: Partial<KanbanBoardState> = {}
    if (options.lists !== undefined) patch.lists = cloneLists(options.lists)
    if (options.selected !== undefined) patch.selected = [...options.selected]
    return patch
  },
  api: (context) => {
    const change = createChange(context)

    const transfer = createTransfer(context, {
      key: "lists",
      draft: "draft",
      set: (value, details) => {
        const applied = change("lists", value, details)
        if (applied) {
          const laneItems = value[details.to] ?? []
          const pos = Math.max(1, laneItems.indexOf(details.key) + 1)
          const announcement = transferMessage({
            type: "drop",
            key: details.key,
            label: context.options().cardLabel?.(details.key) ?? details.key,
            list: context.options().laneLabel?.(details.to) ?? details.to,
            position: pos,
            total: laneItems.length
          })
          context.store.set({ lastAnnouncement: announcement })
        }
        return applied
      },
      order: () => {
        const opts = context.options()
        return opts.order !== undefined
          ? [...opts.order]
          : Object.keys(context.store.get().lists)
      },
      accepts: (cardId, laneId) => {
        const limit = context.options().wipLimits?.[laneId]
        if (limit === undefined || limit === null) return true
        const current = context.store.get().lists[laneId] ?? []
        return current.includes(cardId) || current.length < limit
      },
      label: (cardId) => context.options().cardLabel?.(cardId),
      listLabel: (laneId) => context.options().laneLabel?.(laneId),
      createAutoScroll: false
    })

    const selection = createSelection(context, {
      key: "selected",
      set: (value, details) => change("selected", value, details),
      order: () =>
        orderedCardIds(
          transfer.lists(context.store.get()),
          context.options().order
        ),
      multiple: () => context.options().multiple === true
    })

    const moveCard = (cardId: string, toLane: string, index = 0): boolean =>
      transfer.move(cardId, toLane, index)

    const selectCard = (cardId: string): void => {
      selection.choose(cardId, { reason: "imperative" })
    }

    const clearSelection = (): void => {
      change("selected", [], { reason: "imperative" })
    }

    return {
      transfer,
      selection,
      moveCard,
      selectCard,
      clearSelection,
      getLists: () => transfer.lists(context.store.get()),
      getSelected: () => context.store.get().selected,
      getAnnouncement: () => context.store.get().lastAnnouncement,
      wipLimitFor: (laneId: string) =>
        context.options().wipLimits?.[laneId] ?? null,
      boardLabel: () => context.options().label ?? "Kanban board"
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "region",
      attrs: (_state, { api }) => ({
        "aria-label": api.boardLabel()
      }),
      state: (state, { api }) => ({
        lists: api.transfer.lists(state),
        selected: state.selected,
        moving: state.draft?.key ?? null,
        lastAnnouncement: state.lastAnnouncement
      })
    }),
    lane: slot<{ value: string; label?: string }>({
      props: { value: "key", label: "string" },
      role: "list",
      attrs: (state, { api, props }) => {
        const items = api.transfer.lists(state)[props.value] ?? []
        const limit = api.wipLimitFor(props.value)
        const overWip = limit !== null && items.length > limit
        return {
          "aria-label": props.label ?? props.value,
          "data-lane": props.value,
          "data-count": String(items.length),
          "data-over-wip": overWip ? "" : undefined
        }
      },
      bind: (el, { api, key }) => api.transfer.bindList(el, key),
      state: (state, { api, props }) => {
        const items = api.transfer.lists(state)[props.value] ?? []
        const limit = api.wipLimitFor(props.value)
        return {
          items,
          count: items.length,
          overWip: limit !== null && items.length > limit
        }
      }
    }),
    card: slot<{ value: string; lane: string; disabled?: boolean }>({
      props: { value: "key", lane: "string", disabled: "boolean" },
      role: "listitem",
      selects: selects({
        selected: (part) => [part.props.value]
      }),
      attrs: (state, { api, props }) => {
        const selected = state.selected.includes(props.value)
        const moving = api.transfer.moving(state, props.value)
        const dragging = api.transfer.dragging(state, props.value)
        return {
          "data-lane": props.lane,
          "data-selected": selected ? "" : undefined,
          "data-moving": moving ? "" : undefined,
          "data-dragging": dragging ? "" : undefined,
          "aria-disabled": props.disabled === true ? "true" : undefined
        }
      },
      on: {
        keydown: (event, { api, key }) => {
          api.transfer.keydown(event, key)
        },
        pointerdown: (event, { api, key }) => {
          api.transfer.pointerdown(event, key)
        }
      },
      press: ({ api, key }, event) => {
        api.selection.choose(key, {
          reason: "item-press",
          ...(event !== undefined ? { event } : {})
        })
      },
      bind: (el, { api, key }) => api.transfer.bindItem(el, key),
      state: (state, { api, props }) => ({
        selected: state.selected.includes(props.value),
        moving: api.transfer.moving(state, props.value),
        dragging: api.transfer.dragging(state, props.value)
      })
    })
  }),
  agent: {
    actions: ["moveCard", "selectCard", "clearSelection"]
  }
})

export interface BoardHistory<State> {
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

export const createBoardHistory = <State>(
  initial: State,
  options?: UndoStackOptions
): BoardHistory<State> => {
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
