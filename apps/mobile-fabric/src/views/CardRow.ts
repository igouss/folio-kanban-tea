import type { Fabric } from "@folio/effect-ui-fabric"
import { adjacentLanes, laneTitle as laneLabel, type KanbanCard as Card } from "@folio/kanban-core"
import { priorityColors, type FolioPalette as Palette } from "@folio/kanban-core/theme"
import {
  KanbanMobileMessage as Msg,
  type KanbanMobileMessage
} from "../domain/schema"

export const cardRow = (
  h: Fabric.H<KanbanMobileMessage>,
  card: Card,
  p: Palette
) => {
  const prio = priorityColors(card.priority, p)
  const { prev, next } = adjacentLanes(card.lane)

  return h.view
    .key(card.id)
    .testID(`card.${card.id}`)
    .class("rounded-xl p-3.5 mb-3")
    .style({
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderLeftWidth: 4,
      borderLeftColor: prio.fg,
      gap: 8
    })
    .children(
      h.view
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between"
        })
        .children(
          h.view
            .style({ flexDirection: "row", alignItems: "center", gap: 6 })
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                .children(card.code),
              h.view
                .style({
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: prio.bg
                })
                .children(
                  h.text
                    .style({ fontSize: 10, fontWeight: "700", color: prio.fg })
                    .children(prio.label)
                )
            ),
          h.view
            .style({ flexDirection: "row", alignItems: "center", gap: 6 })
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                .children(`${card.points}pt`),
              h.view
                .style({
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: p.avatarBg,
                  alignItems: "center",
                  justifyContent: "center"
                })
                .children(
                  h.text
                    .style({ fontSize: 10, fontWeight: "700", color: p.avatarInk })
                    .children(card.assignee)
                )
            )
        ),
      h.pressable
        .testID(`card.open.${card.id}`)
        .accessibilityLabel(`Edit ${card.title}`)
        .on("press", Msg.PressedOpenCard({ cardId: card.id }))
        .children(
          h.text
            .style({ fontSize: 15, fontWeight: "700", color: p.ink })
            .children(card.title)
        ),
      card.notes.length > 0 &&
        h.text
          .style({ fontSize: 12.5, color: p.inkSoft })
          .children(card.notes),
      h.view
        .style({ flexDirection: "row", flexWrap: "wrap", gap: 5 })
        .children(
          card.tags.map((tag) =>
            h.view
              .key(tag)
              .style({
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: p.chip
              })
              .children(
                h.text
                  .style({ fontSize: 10.5, color: p.inkSoft })
                  .children(`#${tag}`)
              )
          )
        ),
      h.view
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: p.border
        })
        .children(
          h.view
            .style({ flexDirection: "row", gap: 8 })
            .children(
              prev !== undefined &&
                h.pressable
                  .testID(`card.prev.${card.id}`)
                  .accessibilityLabel(`Move ${card.code} to ${laneLabel(prev)}`)
                  .on("press", Msg.PressedMoveCard({ cardId: card.id, toLane: prev }))
                  .style({
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 6,
                    backgroundColor: p.surfaceAlt,
                    borderWidth: 1,
                    borderColor: p.border
                  })
                  .children(
                    h.text
                      .style({ fontSize: 12, fontWeight: "600", color: p.ink })
                      .children(`‹ ${laneLabel(prev)}`)
                  ),
              next !== undefined &&
                h.pressable
                  .testID(`card.next.${card.id}`)
                  .accessibilityLabel(`Move ${card.code} to ${laneLabel(next)}`)
                  .on("press", Msg.PressedMoveCard({ cardId: card.id, toLane: next }))
                  .style({
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 6,
                    backgroundColor: p.surfaceAlt,
                    borderWidth: 1,
                    borderColor: p.border
                  })
                  .children(
                    h.text
                      .style({ fontSize: 12, fontWeight: "600", color: p.ink })
                      .children(`${laneLabel(next)} ›`)
                  )
            ),
          h.pressable
            .testID(`card.delete.${card.id}`)
            .accessibilityLabel(`Delete ${card.code}`)
            .on("press", Msg.PressedDeleteCard({ cardId: card.id }))
            .style({
              paddingHorizontal: 9,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: p.accentSoft
            })
            .children(
              h.text
                .style({ fontSize: 11.5, fontWeight: "700", color: p.accent })
                .children("Delete")
            )
        )
    )
}
