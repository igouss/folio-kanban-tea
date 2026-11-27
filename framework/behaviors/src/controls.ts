import type { Attrs } from "@ui-sdk/core"
import { progress, type ProgressStatus } from "@ui-sdk/core/progress"
import { attrs, partState, present } from "@ui-sdk/core/renderer"
import {
  segmentedControl,
  type SegmentedControlOrientation
} from "@ui-sdk/core/segmented-control"
import { tabs, type TabsOrientation } from "@ui-sdk/core/tabs"

export type StringAttrs = Record<string, string>

export const toStringAttrs = (raw: Attrs): StringAttrs => {
  const out: StringAttrs = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

export interface SegmentedItemInput<T extends string = string> {
  readonly value: T
  readonly label: string
  readonly disabled?: boolean
}

export interface SegmentedItemView<T extends string = string> {
  readonly value: T
  readonly label: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly attrs: StringAttrs
}

export interface SegmentedControlSnapshot<T extends string = string> {
  readonly id: string
  readonly value: T | null
  readonly orientation: SegmentedControlOrientation
  readonly rootAttrs: StringAttrs
  readonly items: ReadonlyArray<SegmentedItemView<T>>
}

export interface ReadSegmentedControlOptions<T extends string = string> {
  readonly id: string
  readonly value: T | null
  readonly items: ReadonlyArray<SegmentedItemInput<T>>
  readonly orientation?: SegmentedControlOrientation
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly ariaLabel?: string
}

export const readSegmentedControl = <T extends string>(
  options: ReadSegmentedControlOptions<T>
): SegmentedControlSnapshot<T> => {
  const instance = segmentedControl({
    id: options.id,
    value: options.value,
    ...(options.orientation !== undefined
      ? { orientation: options.orientation }
      : {}),
    ...(options.disabled !== undefined ? { disabled: options.disabled } : {}),
    ...(options.readOnly !== undefined ? { readOnly: options.readOnly } : {})
  })

  try {
    const rootPart = instance.part("root")
    const rootAttrs = toStringAttrs(attrs(rootPart))
    if (options.ariaLabel !== undefined) {
      rootAttrs["aria-label"] = options.ariaLabel
    }
    const rootState = partState(rootPart) as {
      readonly value: T | null
      readonly orientation: SegmentedControlOrientation
    }

    const items = options.items.map((item): SegmentedItemView<T> => {
      const itemPart = instance.part("item", {
        value: item.value,
        ...(item.disabled !== undefined ? { disabled: item.disabled } : {})
      })
      const state = partState(itemPart) as {
        readonly checked: boolean
        readonly disabled: boolean
      }
      return {
        value: item.value,
        label: item.label,
        checked: state.checked,
        disabled: state.disabled,
        attrs: toStringAttrs(attrs(itemPart))
      }
    })

    return {
      id: options.id,
      value: rootState.value,
      orientation: rootState.orientation,
      rootAttrs,
      items
    }
  } finally {
    instance.destroy()
  }
}

export const nextSegmentedValue = <T extends string>(
  items: ReadonlyArray<Pick<SegmentedItemInput<T>, "value" | "disabled">>,
  current: T | null,
  key: string,
  loop = true
): T | undefined => {
  const enabled = items.filter((item) => item.disabled !== true)
  if (enabled.length === 0) return undefined

  if (key === "Home") return enabled[0]?.value
  if (key === "End") return enabled[enabled.length - 1]?.value

  const step =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0
  if (step === 0) return undefined

  const index = enabled.findIndex((item) => item.value === current)
  if (index < 0) return enabled[0]?.value

  const raw = index + step
  const nextIndex = loop
    ? (raw + enabled.length) % enabled.length
    : Math.max(0, Math.min(enabled.length - 1, raw))
  return enabled[nextIndex]?.value
}

export interface TabItemInput<T extends string = string> {
  readonly value: T
  readonly label: string
  readonly disabled?: boolean
}

export interface TabItemView<T extends string = string> {
  readonly value: T
  readonly label: string
  readonly selected: boolean
  readonly disabled: boolean
  readonly tabAttrs: StringAttrs
  readonly panelAttrs: StringAttrs
  readonly panelPresent: boolean
}

export interface TabsSnapshot<T extends string = string> {
  readonly id: string
  readonly value: T | null
  readonly orientation: TabsOrientation
  readonly rootAttrs: StringAttrs
  readonly listAttrs: StringAttrs
  readonly items: ReadonlyArray<TabItemView<T>>
}

export interface ReadTabsOptions<T extends string = string> {
  readonly id: string
  readonly value: T | null
  readonly items: ReadonlyArray<TabItemInput<T>>
  readonly orientation?: TabsOrientation
  readonly ariaLabel?: string
}

export const readTabs = <T extends string>(
  options: ReadTabsOptions<T>
): TabsSnapshot<T> => {
  const instance = tabs({
    id: options.id,
    value: options.value,
    ...(options.orientation !== undefined
      ? { orientation: options.orientation }
      : {})
  })

  try {
    const rootPart = instance.part("root")
    const listPart = instance.part("list")
    const rootAttrs = toStringAttrs(attrs(rootPart))
    const listAttrs = toStringAttrs(attrs(listPart))
    if (options.ariaLabel !== undefined) {
      listAttrs["aria-label"] = options.ariaLabel
    }
    const rootState = partState(rootPart) as {
      readonly value: T | null
      readonly orientation: TabsOrientation
    }

    const items = options.items.map((item): TabItemView<T> => {
      const tabPart = instance.part("tab", {
        value: item.value,
        ...(item.disabled !== undefined ? { disabled: item.disabled } : {})
      })
      const panelPart = instance.part("panel", { value: item.value })
      const tabState = partState(tabPart) as {
        readonly selected: boolean
        readonly disabled: boolean
      }
      return {
        value: item.value,
        label: item.label,
        selected: tabState.selected,
        disabled: tabState.disabled,
        tabAttrs: toStringAttrs(attrs(tabPart)),
        panelAttrs: toStringAttrs(attrs(panelPart)),
        panelPresent: present(panelPart)
      }
    })

    return {
      id: options.id,
      value: rootState.value,
      orientation: rootState.orientation,
      rootAttrs,
      listAttrs,
      items
    }
  } finally {
    instance.destroy()
  }
}

export interface ProgressSnapshot {
  readonly id: string
  readonly value: number | null
  readonly percent: number
  readonly status: ProgressStatus
  readonly text: string
  readonly rootAttrs: StringAttrs
  readonly trackAttrs: StringAttrs
  readonly indicatorAttrs: StringAttrs
  readonly valueAttrs: StringAttrs
}

export interface ReadProgressOptions {
  readonly id: string
  readonly value: number | null
  readonly min?: number
  readonly max?: number
  readonly ariaLabel?: string
}

export const readProgress = (options: ReadProgressOptions): ProgressSnapshot => {
  const min = options.min ?? 0
  const max = options.max !== undefined && options.max > min ? options.max : 100
  const safeValue =
    options.value === null
      ? null
      : Math.max(min, Math.min(max, options.value))

  const instance = progress({
    id: options.id,
    value: safeValue,
    min,
    max
  })

  try {
    const rootPart = instance.part("root")
    const trackPart = instance.part("track")
    const indicatorPart = instance.part("indicator")
    const valuePart = instance.part("value")

    const rootAttrs = toStringAttrs(attrs(rootPart))
    if (options.ariaLabel !== undefined) {
      rootAttrs["aria-label"] = options.ariaLabel
    }
    const state = partState(valuePart) as {
      readonly value: number | null
      readonly percent: number | null
      readonly status: ProgressStatus
      readonly text: string
    }

    return {
      id: options.id,
      value: state.value,
      percent: state.percent === null ? 0 : Math.round(state.percent),
      status: state.status,
      text: state.text.length > 0 ? state.text : "0%",
      rootAttrs,
      trackAttrs: toStringAttrs(attrs(trackPart)),
      indicatorAttrs: toStringAttrs(attrs(indicatorPart)),
      valueAttrs: toStringAttrs(attrs(valuePart))
    }
  } finally {
    instance.destroy()
  }
}
