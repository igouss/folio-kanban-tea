import {
  nextSegmentedValue,
  type ProgressSnapshot,
  type SegmentedControlSnapshot
} from "@universal-ui/behaviors"
import type { Ui, UiStyle } from "@universal-ui/core"
import { NoticeStateSchema, type NoticeState } from "../../state/index.ts"
import type { FolioPalette as Palette } from "../theme.ts"

export const secondaryButtonStyle = (
  p: Palette,
  paddingHorizontal = 11
): UiStyle => ({
  paddingVertical: 6,
  paddingHorizontal,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: p.rule,
  backgroundColor: p.card
})

export const primaryButtonStyle = (
  p: Palette,
  paddingHorizontal = 12,
  paddingVertical = 6
): UiStyle => ({
  paddingVertical,
  paddingHorizontal,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: p.accent,
  backgroundColor: p.accent
})

export const textInputStyle = (
  p: Palette,
  overrides: UiStyle = {}
): UiStyle => ({
  paddingVertical: 8,
  paddingHorizontal: 11,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: p.rule,
  backgroundColor: p.input,
  color: p.ink,
  fontSize: 13,
  ...overrides
})

export interface ActionButtonOptions<Msg> {
  readonly label: string
  readonly onPress: Msg
  readonly variant?: "secondary" | "primary" | "danger" | "ghost"
  readonly testId?: string
  readonly ariaLabel?: string
  readonly disabled?: boolean
  readonly active?: boolean
  readonly paddingHorizontal?: number
  readonly paddingVertical?: number
  readonly fontSize?: number
  readonly fontWeight?: "600" | "700"
  readonly textColor?: string
  readonly style?: UiStyle
  readonly hover?: UiStyle
}

export const actionButton = <Msg>(
  h: Ui.H<Msg>,
  p: Palette,
  options: ActionButtonOptions<Msg>
) => {
  const variant = options.variant ?? "secondary"
  const baseStyle: UiStyle =
    variant === "primary"
      ? primaryButtonStyle(
          p,
          options.paddingHorizontal ?? 12,
          options.paddingVertical ?? 6
        )
      : variant === "danger"
        ? {
            paddingVertical: options.paddingVertical ?? 8,
            paddingHorizontal: options.paddingHorizontal ?? 12,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: p.accent,
            backgroundColor: p.accentSoft
          }
        : variant === "ghost"
          ? {}
          : {
              ...secondaryButtonStyle(p, options.paddingHorizontal),
              ...(options.paddingVertical !== undefined
                ? { paddingVertical: options.paddingVertical }
                : {}),
              ...(options.active
                ? { backgroundColor: p.ink, borderColor: p.ink }
                : {})
            }

  const defaultColor =
    variant === "primary"
      ? p.accentInk
      : variant === "danger"
        ? p.accent
        : options.active
          ? p.card
          : p.ink

  const defaultHover: UiStyle | undefined =
    options.hover ??
    (variant === "primary"
      ? { backgroundColor: p.accentHover }
      : variant === "secondary" && !options.active
        ? { backgroundColor: p.cardHover, borderColor: p.ruleStrong }
        : undefined)

  let btn = h.button.on("press", options.onPress)
  if (options.testId !== undefined) btn = btn.testId(options.testId)
  if (options.ariaLabel !== undefined) btn = btn.ariaLabel(options.ariaLabel)
  if (options.disabled) btn = btn.disabled(true)
  const mergedStyle = options.style
    ? { ...baseStyle, ...options.style }
    : baseStyle
  if (Object.keys(mergedStyle).length > 0) btn = btn.style(mergedStyle)
  if (defaultHover !== undefined) btn = btn.hover(defaultHover)

  return btn.children(
    h.text
      .style({
        fontSize: options.fontSize ?? 12,
        fontWeight:
          options.fontWeight ?? (variant === "secondary" ? "600" : "700"),
        color: options.textColor ?? defaultColor
      })
      .children(options.label)
  )
}

export const fieldLabel = <Msg>(
  h: Ui.H<Msg>,
  text: string,
  p: Palette
) =>
  h.text
    .style({ fontSize: 12, fontWeight: "700", color: p.inkSoft })
    .children(text)

export const pillBadge = <Msg>(
  h: Ui.H<Msg>,
  label: string,
  colors: { readonly bg: string; readonly fg: string; readonly border?: string },
  testId?: string
) => {
  const box = h.box.style({
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.bg,
    ...(colors.border !== undefined
      ? { borderWidth: 1, borderColor: colors.border }
      : {})
  })
  const withId = testId !== undefined ? box.testId(testId) : box
  return withId.children(
    h.text
      .style({ fontSize: 11, fontWeight: "700", color: colors.fg })
      .children(label)
  )
}

export const noticeBanner = <Msg>(
  h: Ui.H<Msg>,
  notice: NoticeState,
  p: Palette,
  options: {
    readonly testId: string
    readonly onDismiss?: Msg
    readonly dismissTestId?: string
    readonly dismissLabel?: string
    readonly wholeBannerDismiss?: boolean
    readonly style?: UiStyle
  }
) => {
  if (!NoticeStateSchema.guards.Visible(notice)) return false as const
  const isError = notice.tone === "error"
  const bg = isError ? p.accentSoft : p.pineSoft
  const fg = isError ? p.accent : p.pine
  const baseStyle: UiStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: bg,
    ...options.style
  }
  const messageNode = h.text
    .style({ fontSize: 12, fontWeight: "600", color: fg })
    .children(notice.message)

  if (options.onDismiss !== undefined && options.wholeBannerDismiss) {
    return h.button
      .testId(options.testId)
      .role(isError ? "alert" : "status")
      .ariaLabel(notice.announcement)
      .on("press", options.onDismiss)
      .style(baseStyle)
      .children(
        messageNode,
        h.text
          .style({ fontSize: 11, fontWeight: "700", color: fg })
          .children(options.dismissLabel ?? "OK")
      )
  }

  return h.box
    .testId(options.testId)
    .role(isError ? "alert" : "status")
    .ariaLabel(notice.announcement)
    .style(baseStyle)
    .children(
      messageNode,
      options.onDismiss !== undefined &&
        (() => {
          let dismissBtn = h.button.on("press", options.onDismiss)
          if (options.dismissTestId !== undefined) {
            dismissBtn = dismissBtn.testId(options.dismissTestId)
          }
          return dismissBtn.children(
            h.text
              .style({ fontSize: 12, fontWeight: "700", color: fg })
              .children(options.dismissLabel ?? "Dismiss")
          )
        })()
    )
}

export const velocityProgressBar = <Msg>(
  h: Ui.H<Msg>,
  velocity: ProgressSnapshot,
  p: Palette,
  options: {
    readonly compact?: boolean
  } = {}
) => {
  const fill = h.box.style({
    width: `${velocity.percent}%`,
    height: "100%",
    borderRadius: 999,
    backgroundColor: p.pine
  })

  if (options.compact) {
    return h.box
      .testId("board.progress")
      .role(velocity.rootAttrs.role ?? "progressbar")
      .ariaLabel(
        `${velocity.rootAttrs["aria-label"] ?? "Sprint velocity"} ${velocity.text}`
      )
      .ariaValueNow(velocity.percent)
      .ariaValueMin(0)
      .ariaValueMax(100)
      .style({
        height: 5,
        borderRadius: 999,
        backgroundColor: p.surfaceAlt,
        overflow: "hidden"
      })
      .children(fill)
  }

  return h.box
    .testId("board.progress")
    .role(velocity.rootAttrs.role ?? "progressbar")
    .ariaLabel(velocity.rootAttrs["aria-label"] ?? "Sprint velocity")
    .ariaValueNow(velocity.percent)
    .ariaValueMin(0)
    .ariaValueMax(100)
    .ariaValueText(velocity.text)
    .style({ flexDirection: "row", alignItems: "center", gap: 8 })
    .children(
      h.box
        .style({
          width: 96,
          height: 7,
          borderRadius: 999,
          backgroundColor: p.lane,
          overflow: "hidden"
        })
        .children(fill),
      h.text
        .style({ fontSize: 12, fontWeight: "700", color: p.ink })
        .children(velocity.text)
    )
}

export const emptyLaneBox = <Msg>(
  h: Ui.H<Msg>,
  count: number,
  laneTitle: string,
  p: Palette,
  options: { readonly testId: string; readonly spacious?: boolean }
) =>
  h.box
    .testId(options.testId)
    .style({
      padding: options.spacious ? 28 : 16,
      borderRadius: options.spacious ? 12 : 8,
      borderWidth: 1,
      borderColor: options.spacious ? p.border : p.rule,
      backgroundColor: p.surface,
      alignItems: "center"
    })
    .children(
      h.text
        .style({
          fontSize: options.spacious ? 14 : 12,
          ...(options.spacious ? { fontWeight: "600" } : {}),
          color: p.inkMuted
        })
        .children(
          count > 0
            ? `${count} ${count === 1 ? "card" : "cards"} hidden by filter`
            : `No cards in ${laneTitle}`
        )
    )

export interface SegmentedControlOptions<T extends string, Msg> {
  readonly testIdPrefix: string
  readonly current: T
  readonly tone?: "ink" | "accent"
  readonly stretch?: boolean
  readonly itemAriaLabel?: (label: string, value: T) => string
  readonly onSelect: (value: T) => Msg
}

export const segmentedControl = <T extends string, Msg>(
  h: Ui.H<Msg>,
  control: SegmentedControlSnapshot<T>,
  p: Palette,
  options: SegmentedControlOptions<T, Msg>
) => {
  const tone = options.tone ?? "ink"
  const stretch = options.stretch ?? false

  return h.box
    .role(control.rootAttrs.role ?? "radiogroup")
    .ariaLabel(control.rootAttrs["aria-label"] ?? "")
    .style({
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 4
    })
    .children(
      control.items.map((item) => {
        const activeBg = tone === "accent" ? p.accent : p.ink
        const activeFg = tone === "accent" ? p.accentInk : p.card
        const activeBorder = tone === "accent" ? p.accent : p.ink

        return h.button
          .key(item.value)
          .testId(`${options.testIdPrefix}.${item.value}`)
          .role(item.attrs.role ?? "radio")
          .ariaChecked(item.checked)
          .ariaLabel(
            options.itemAriaLabel?.(item.label, item.value) ?? item.label
          )
          .tabIndex(item.checked ? 0 : -1)
          .style({
            ...(stretch ? { flex: 1 } : {}),
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: item.checked ? activeBorder : p.rule,
            backgroundColor: item.checked ? activeBg : p.card,
            alignItems: "center",
            justifyContent: "center"
          })
          .hover({
            backgroundColor: item.checked ? activeBg : p.cardHover,
            borderColor: item.checked ? activeBorder : p.ruleStrong
          })
          .on("press", options.onSelect(item.value))
          .on("keyDown", ({ key }) => {
            const next = nextSegmentedValue(control.items, options.current, key)
            return next !== undefined ? options.onSelect(next) : undefined
          })
          .children(
            h.text
              .style({
                fontSize: 12,
                fontWeight: "600",
                color: item.checked ? activeFg : p.inkSoft
              })
              .children(item.label)
          )
      })
    )
}
