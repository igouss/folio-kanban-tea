import type { Fabric } from "@folio/effect-ui-fabric"
import type { SegmentedControlSnapshot } from "@folio/effect-ui-sdk"
import type { FolioPalette as Palette } from "@folio/kanban-core/theme"

export const fabricSegmentedControl = <Msg, T extends string>(
  h: Fabric.H<Msg>,
  control: SegmentedControlSnapshot<T>,
  p: Palette,
  options: {
    readonly testIdPrefix: string
    readonly onSelect: (value: T) => Msg
    readonly tone?: "ink" | "accent"
    readonly paddingVertical?: number
    readonly borderRadius?: number
    readonly itemAccessibilityLabel?: (label: string) => string
  }
) => {
  const tone = options.tone ?? "ink"
  const activeBg = tone === "accent" ? p.accent : p.ink
  const activeInk = tone === "accent" ? p.accentInk : p.surface
  const inactiveInk = tone === "accent" ? p.inkSoft : p.ink
  const paddingVertical = options.paddingVertical ?? 8
  const borderRadius = options.borderRadius ?? 7

  return h.view
    .accessibilityLabel(control.rootAttrs["aria-label"] ?? control.id)
    .style({ flexDirection: "row", gap: 6 })
    .children(
      control.items.map((opt) => {
        const item = h.pressable
          .key(opt.value)
          .testID(`${options.testIdPrefix}.${opt.value}`)
          .on("press", options.onSelect(opt.value))
          .style({
            flex: 1,
            paddingVertical,
            borderRadius,
            alignItems: "center",
            backgroundColor: opt.checked ? activeBg : p.surface,
            borderWidth: 1,
            borderColor: opt.checked ? activeBg : p.border
          })
          .children(
            h.text
              .style({
                fontSize: 12,
                fontWeight: "700",
                color: opt.checked ? activeInk : inactiveInk
              })
              .children(opt.label)
          )
        return options.itemAccessibilityLabel !== undefined
          ? item.accessibilityLabel(options.itemAccessibilityLabel(opt.label))
          : item
      })
    )
}

export const fabricFieldLabel = <Msg>(
  h: Fabric.H<Msg>,
  text: string,
  p: Palette
) =>
  h.text
    .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
    .children(text)
