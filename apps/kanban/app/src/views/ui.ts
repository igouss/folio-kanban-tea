import {
  nextSegmentedValue,
  type SegmentedControlSnapshot
} from "@universal-ui/behaviors"
import type { Ui, UiStyle } from "@universal-ui/core"
import type { FolioPalette as Palette } from "./theme.ts"

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
