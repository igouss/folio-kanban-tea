import type { Gpui } from "@folio/effect-ui-gpui"
import { adjacentLanes, type KanbanCard } from "@folio/kanban-core"
import { priorityColors, type FolioPalette as Palette } from "@folio/kanban-core/theme"
import type { KanbanDesktopMessage } from "../components/KanbanDesktop.ts"
import { KanbanDesktopMessage as Msg } from "../components/KanbanDesktop.ts"

export const cardView = (
  h: Gpui.H<KanbanDesktopMessage>,
  card: KanbanCard,
  p: Palette
) => {
  const prio = priorityColors(card.priority, p)
  const { prev, next } = adjacentLanes(card.lane)

  return h.box
    .key(card.id)
    .testId(`card.${card.id}`)
    .role("listitem")
    .style({
      display: "flex",
      flexDirection: "column",
      gap: 7,
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 11,
      paddingRight: 11,
      minWidth: 0,
      borderRadius: 9,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.rule,
      borderLeftWidth: 3,
      boxShadow: {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 6,
        spreadRadius: 0,
        color: p.cardShadow
      }
    })
    .hover({
      backgroundColor: p.cardHover,
      borderColor: p.ruleStrong
    })
    .children(
      h.box
        .style({
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6
        })
        .children(
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            })
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                .children(card.code),
              h.box
                .style({
                  paddingTop: 1,
                  paddingBottom: 1,
                  paddingLeft: 6,
                  paddingRight: 6,
                  borderRadius: 4,
                  backgroundColor: prio.bg
                })
                .children(
                  h.text
                    .style({ fontSize: 10, fontWeight: 700, color: prio.fg })
                    .children(prio.label)
                )
            ),
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 3
            })
            .children(
              prev !== undefined &&
                h.button
                  .testId(`card.prev.${card.id}`)
                  .ariaLabel(`Move ${card.title} left`)
                  .style({
                    paddingTop: 2,
                    paddingBottom: 2,
                    paddingLeft: 6,
                    paddingRight: 6,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: "transparent",
                    color: p.inkMuted,
                    fontSize: 11,
                    fontWeight: 700
                  })
                  .hover({
                    backgroundColor: p.lane,
                    borderColor: p.rule,
                    color: p.ink
                  })
                  .on("click", Msg.ClickedMoveCard({ cardId: card.id, toLane: prev }))
                  .children("<"),
              next !== undefined &&
                h.button
                  .testId(`card.next.${card.id}`)
                  .ariaLabel(`Move ${card.title} right`)
                  .style({
                    paddingTop: 2,
                    paddingBottom: 2,
                    paddingLeft: 6,
                    paddingRight: 6,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: "transparent",
                    color: p.inkMuted,
                    fontSize: 11,
                    fontWeight: 700
                  })
                  .hover({
                    backgroundColor: p.lane,
                    borderColor: p.rule,
                    color: p.ink
                  })
                  .on("click", Msg.ClickedMoveCard({ cardId: card.id, toLane: next }))
                  .children(">"),
              h.button
                .testId(`card.delete.${card.id}`)
                .ariaLabel(`Delete ${card.title}`)
                .style({
                  paddingTop: 2,
                  paddingBottom: 2,
                  paddingLeft: 6,
                  paddingRight: 6,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: "transparent",
                  color: p.inkMuted,
                  fontSize: 11,
                  fontWeight: 700
                })
                .hover({
                  backgroundColor: p.accentSoft,
                  color: p.accent
                })
                .on("click", Msg.ClickedDeleteCard({ cardId: card.id }))
                .children("x")
            )
        ),
      h.button
        .testId(`card.open.${card.id}`)
        .style({
          padding: 0,
          color: p.ink,
          fontSize: 13.5,
          fontWeight: 700,
          textAlign: "left"
        })
        .hover({ color: p.accent })
        .on("click", Msg.ClickedOpenEditor({ cardId: card.id }))
        .children(card.title),
      card.notes.length > 0 &&
        h.text
          .style({ fontSize: 12, color: p.inkSoft })
          .children(card.notes),
      h.box
        .style({
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingTop: 3
        })
        .children(
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 4
            })
            .children(
              card.tags.map((tag) =>
                h.box
                  .key(tag)
                  .style({
                    paddingTop: 2,
                    paddingBottom: 2,
                    paddingLeft: 6,
                    paddingRight: 6,
                    borderRadius: 4,
                    backgroundColor: p.chip
                  })
                  .children(
                    h.text
                      .style({ fontSize: 10, fontWeight: 600, color: p.inkSoft })
                      .children(`#${tag}`)
                  )
              )
            ),
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            })
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                .children(`${card.points}pt`),
              h.box
                .style({
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  backgroundColor: p.avatarBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                })
                .children(
                  h.text
                    .style({
                      fontSize: 10,
                      fontWeight: 700,
                      color: p.avatarInk
                    })
                    .children(card.assignee)
                )
            )
        )
    )
}
