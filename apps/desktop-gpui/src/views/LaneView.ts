import type { Gpui } from "@folio/effect-ui-gpui"
import type { LaneViewSnapshot } from "@folio/effect-ui-sdk"
import type { KanbanCard, LaneMeta } from "@folio/kanban-core"
import type { FolioPalette as Palette } from "@folio/kanban-core/theme"
import { Option } from "effect"
import type {
  KanbanDesktopMessage,
  KanbanDesktopModel
} from "../components/KanbanDesktop.ts"
import { KanbanDesktopMessage as Msg } from "../components/KanbanDesktop.ts"
import { cardView } from "./CardView.ts"

const addCardSection = (
  h: Gpui.H<KanbanDesktopMessage>,
  model: KanbanDesktopModel,
  lane: LaneMeta,
  p: Palette
) => {
  const isAdding = Option.exists(model.newCardLane, (id) => id === lane.id)

  if (!isAdding) {
    return h.button
      .testId(`lane.add.${lane.id}`)
      .style({
        width: "100%",
        paddingTop: 7,
        paddingBottom: 7,
        paddingLeft: 10,
        paddingRight: 10,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: p.ruleStrong,
        backgroundColor: "transparent",
        color: p.inkSoft,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "left"
      })
      .hover({ backgroundColor: p.card, color: p.ink })
      .on("click", Msg.ClickedAddCard({ lane: lane.id }))
      .children("+ Add card")
  }

  return h.box
    .style({
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 9,
      borderRadius: 8,
      backgroundColor: p.cardHover,
      borderWidth: 1,
      borderColor: p.accent
    })
    .children(
      h.input
        .testId("add.input")
        .autoFocus(true)
        .value(model.newCardTitle)
        .placeholder(`New card in ${lane.title}...`)
        .style({
          width: "100%",
          paddingTop: 7,
          paddingBottom: 7,
          paddingLeft: 9,
          paddingRight: 9,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: p.rule,
          backgroundColor: p.input,
          color: p.ink,
          fontSize: 13
        })
        .on("change", ({ value }) => Msg.TypedNewCardTitle({ value }))
        .on("submit", Msg.SubmittedNewCard())
        .on("keyDown", ({ key }) =>
          key === "Escape" ? Msg.CancelledNewCard() : undefined
        ),
      h.box
        .style({
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 6
        })
        .children(
          h.button
            .testId("add.cancel")
            .style({
              paddingTop: 5,
              paddingBottom: 5,
              paddingLeft: 10,
              paddingRight: 10,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: p.rule,
              backgroundColor: p.card,
              color: p.ink,
              fontSize: 12,
              fontWeight: 600
            })
            .on("click", Msg.CancelledNewCard())
            .children("Cancel"),
          h.button
            .testId("add.submit")
            .style({
              paddingTop: 5,
              paddingBottom: 5,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: p.accent,
              backgroundColor: p.accent,
              color: p.accentInk,
              fontSize: 12,
              fontWeight: 700
            })
            .hover({ backgroundColor: p.accentHover })
            .on("click", Msg.SubmittedNewCard())
            .children("Add")
        )
    )
}

export const laneView = (
  h: Gpui.H<KanbanDesktopMessage>,
  model: KanbanDesktopModel,
  entry: LaneViewSnapshot<KanbanCard>,
  p: Palette
) => {
  const { lane, stats, visibleCards, visiblePoints, visibleWipText, laneAttrs } = entry
  const overWip = stats.overWip

  return h.box
    .key(lane.id)
    .testId(`lane.${lane.id}`)
    .role(laneAttrs.role ?? "list")
    .ariaLabel(laneAttrs["aria-label"] ?? lane.title)
    .style({
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      backgroundColor: p.lane,
      borderWidth: 1,
      borderColor: overWip ? p.accent : p.rule,
      borderRadius: 12,
      padding: 11
    })
    .children(
      h.box
        .style({
          display: "flex",
          flexDirection: "column",
          gap: 5,
          paddingBottom: 10,
          marginBottom: 10,
          borderBottomWidth: 1,
          borderColor: p.rule
        })
        .children(
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8
            })
            .children(
              h.box
                .style({
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7
                })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                    .children(lane.code),
                  h.text
                    .style({ fontSize: 15, fontWeight: 700, color: p.ink })
                    .children(lane.title)
                ),
              h.box
                .style({
                  paddingTop: 2,
                  paddingBottom: 2,
                  paddingLeft: 8,
                  paddingRight: 8,
                  borderRadius: 999,
                  backgroundColor: overWip ? p.accentSoft : p.card,
                  borderWidth: 1,
                  borderColor: overWip ? p.accent : p.rule
                })
                .children(
                  h.text
                    .style({
                      fontSize: 11,
                      fontWeight: 700,
                      color: overWip ? p.accent : p.inkSoft
                    })
                    .children(visibleWipText)
                )
            ),
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between"
            })
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: 600, color: p.inkMuted })
                .children(`${visiblePoints} pt`),
              overWip &&
                h.text
                  .style({ fontSize: 10, fontWeight: 700, color: p.accent })
                  .children("WIP LIMIT EXCEEDED")
            )
        ),
      h.box
        .style({
          flexGrow: 1,
          minHeight: 80,
          display: "flex",
          flexDirection: "column",
          gap: 9,
          overflowY: "auto"
        })
        .children(
          visibleCards.length === 0
            ? h.box
                .style({
                  paddingTop: 20,
                  paddingBottom: 20,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: p.ruleStrong,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                })
                .children(
                  h.text
                    .style({ fontSize: 12, color: p.inkMuted })
                    .children("No matching cards in lane")
                )
            : visibleCards.map((card) => cardView(h, card, p))
        ),
      h.box
        .style({
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderColor: p.rule
        })
        .children(addCardSection(h, model, lane, p))
    )
}
