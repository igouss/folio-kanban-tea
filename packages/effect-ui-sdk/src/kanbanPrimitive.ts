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
import { attrs, partState } from "@ui-sdk/core/renderer"
import { toStringAttrs, type StringAttrs } from "./bridge.ts"

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

export interface ReadKanbanBoardLaneInput {
  readonly id: string
  readonly label: string
}

export interface ReadKanbanBoardCardInput {
  readonly id: string
  readonly lane: string
  readonly disabled?: boolean
}

export interface ReadKanbanBoardOptions {
  readonly id: string
  readonly label?: string
  readonly lists: TransferLists
  readonly lanes: ReadonlyArray<ReadKanbanBoardLaneInput>
  readonly cards?: ReadonlyArray<ReadKanbanBoardCardInput>
  readonly wipLimits?: Readonly<Record<string, number | null>>
  readonly selected?: ReadonlyArray<string>
}

export interface KanbanLanePartSnapshot {
  readonly id: string
  readonly count: number
  readonly overWip: boolean
  readonly attrs: StringAttrs
}

export interface KanbanCardPartSnapshot {
  readonly id: string
  readonly lane: string
  readonly selected: boolean
  readonly attrs: StringAttrs
}

export interface KanbanBoardSnapshot {
  readonly id: string
  readonly rootAttrs: StringAttrs
  readonly lanes: Readonly<Record<string, KanbanLanePartSnapshot>>
  readonly cards: Readonly<Record<string, KanbanCardPartSnapshot>>
}

export const readKanbanBoard = (
  options: ReadKanbanBoardOptions
): KanbanBoardSnapshot => {
  const instance = kanbanBoard({
    id: options.id,
    lists: options.lists,
    order: options.lanes.map((lane) => lane.id),
    ...(options.label !== undefined ? { label: options.label } : {}),
    ...(options.wipLimits !== undefined ? { wipLimits: options.wipLimits } : {}),
    ...(options.selected !== undefined ? { selected: [...options.selected] } : {})
  })

  try {
    const rootPart = instance.part("root")
    const rootAttrs = toStringAttrs(attrs(rootPart))

    const lanes: Record<string, KanbanLanePartSnapshot> = {}
    for (const lane of options.lanes) {
      const lanePart = instance.part("lane", {
        value: lane.id,
        label: lane.label
      })
      const state = partState(lanePart) as {
        readonly count: number
        readonly overWip: boolean
      }
      lanes[lane.id] = {
        id: lane.id,
        count: state.count,
        overWip: state.overWip,
        attrs: toStringAttrs(attrs(lanePart))
      }
    }

    const cards: Record<string, KanbanCardPartSnapshot> = {}
    for (const card of options.cards ?? []) {
      const cardPart = instance.part("card", {
        value: card.id,
        lane: card.lane,
        ...(card.disabled !== undefined ? { disabled: card.disabled } : {})
      })
      const state = partState(cardPart) as {
        readonly selected: boolean
      }
      cards[card.id] = {
        id: card.id,
        lane: card.lane,
        selected: state.selected,
        attrs: toStringAttrs(attrs(cardPart))
      }
    }

    return {
      id: options.id,
      rootAttrs,
      lanes,
      cards
    }
  } finally {
    instance.destroy()
  }
}

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
