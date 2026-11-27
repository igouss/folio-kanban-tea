import type { Gpui } from "@folio/effect-ui-gpui"
import type { SegmentedControlSnapshot } from "@folio/effect-ui-sdk"
import type { FolioPalette as Palette } from "@folio/kanban-core/theme"

export const gpuiSegmentedControl = <Msg, T extends string>(
  h: Gpui.H<Msg>,
  control: SegmentedControlSnapshot<T>,
  p: Palette,
  options: {
    readonly testIdPrefix: string
    readonly onSelect: (value: T) => Msg
    readonly fill?: boolean
    readonly itemAriaLabel?: (label: string) => string
  }
) => {
  const fill = options.fill ?? false
  return h.box
    .role(control.rootAttrs.role ?? "radiogroup")
    .ariaLabel(control.rootAttrs["aria-label"] ?? control.id)
    .style({
      display: "flex",
      flexDirection: "row",
      padding: 3,
      gap: 2,
      borderRadius: 7,
      backgroundColor: p.lane,
      borderWidth: 1,
      borderColor: p.rule
    })
    .children(
      control.items.map((opt) => {
        const btn = h.button
          .key(opt.value)
          .testId(`${options.testIdPrefix}.${opt.value}`)
          .role(opt.attrs.role ?? "radio")
          .style({
            ...(fill ? { flexGrow: 1, textAlign: "center" as const } : {}),
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: fill ? 8 : 10,
            paddingRight: fill ? 8 : 10,
            borderRadius: 5,
            backgroundColor: opt.checked ? p.cardHover : "transparent",
            color: opt.checked ? p.ink : p.inkSoft,
            fontSize: 12,
            fontWeight: 600
          })
          .on("click", options.onSelect(opt.value))
          .children(opt.label)
        return options.itemAriaLabel !== undefined
          ? btn.ariaLabel(options.itemAriaLabel(opt.label))
          : btn
      })
    )
}

export const gpuiSecondaryButtonStyle = (p: Palette, paddingX = 12): Gpui.GpuiStyle => ({
  paddingTop: 6,
  paddingBottom: 6,
  paddingLeft: paddingX,
  paddingRight: paddingX,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: p.rule,
  backgroundColor: p.card,
  color: p.ink,
  fontSize: 12,
  fontWeight: 600
})

export const gpuiFieldLabel = <Msg>(
  h: Gpui.H<Msg>,
  text: string,
  p: Palette
) =>
  h.text
    .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
    .children(text)
