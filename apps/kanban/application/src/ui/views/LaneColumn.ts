import type { Ui } from "@universal-ui/core"
import type { LaneViewSnapshot } from "../../presentation/index.ts"
import type { BoardScreenSnapshot } from "../../state/index.ts"
import type { FolioPalette as Palette } from "../theme.ts"
import {
  FolioAppMessage as Msg,
  type FolioAppMessage,
  type FolioAppProps
} from "../FolioApp.ts"
import { cardItem } from "./CardItem.ts"
import { pillBadge, secondaryButtonStyle } from "./controls.ts"

export const laneColumn = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  screen: BoardScreenSnapshot,
  entry: LaneViewSnapshot,
  p: Palette
) => {
  const { lane, stats, visibleCards, wipText, laneAttrs } = entry
  const overWip = stats.overWip
  const isAdding = screen.composingLane === lane.id

  return h.box
    .key(lane.id)
    .testId(`lane.${lane.id}`)
    .role(laneAttrs.role ?? "list")
    .ariaLabel(laneAttrs["aria-label"] ?? `${lane.title} column`)
    .style({
      flex: 1,
      minWidth: 230,
      minHeight: 0,
      flexDirection: "column",
      borderRadius: 10,
      backgroundColor: p.lane,
      borderWidth: 1,
      borderColor: overWip ? p.accent : p.rule,
      overflow: "hidden"
    })
    .children(
      // Lane header
      h.box
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderColor: p.rule
        })
        .children(
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            })
            .children(
              h.text
                .style({ fontSize: 10.5, fontWeight: "700", color: p.inkMuted })
                .children(lane.code),
              h.text
                .style({ fontSize: 13.5, fontWeight: "700", color: p.ink })
                .children(lane.title)
            ),
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            })
            .children(
              pillBadge(h, wipText, {
                bg: overWip ? p.accentSoft : p.card,
                fg: overWip ? p.accent : p.inkSoft,
                border: overWip ? p.accent : p.rule
              }),
              h.button
                .testId(`lane.add.${lane.id}`)
                .ariaLabel(`Add card to ${lane.title}`)
                .style({
                  paddingVertical: 2,
                  paddingHorizontal: 8,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.card
                })
                .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                .on("press", Msg.ClickedStartAddCard({ lane: lane.id }))
                .children(
                  h.text
                    .style({ fontSize: 13, fontWeight: "700", color: p.ink })
                    .children("+")
                )
            )
        ),
      // Inline quick-add composer
      isAdding &&
        h.box
          .testId("quick.composer")
          .style({
            flexDirection: "column",
            gap: 8,
            padding: 10,
            borderBottomWidth: 1,
            borderColor: p.rule,
            backgroundColor: p.surface
          })
          .children(
            h.input
              .testId("quick.input")
              .ariaLabel(`New card title in ${lane.title}`)
              .value(screen.quickTitle)
              .placeholder(`New card in ${lane.title}...`)
              .autoFocus(true)
              .style({
                width: "100%",
                paddingVertical: 7,
                paddingHorizontal: 10,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: p.ruleStrong,
                backgroundColor: p.input,
                color: p.ink,
                fontSize: 13
              })
              .on("changeText", ({ text }) => Msg.TypedQuickTitle({ text }))
              .on("submit", Msg.SubmittedQuickCard())
              .on("keyDown", ({ key }) =>
                key === "Escape" ? Msg.CancelledQuickCard() : undefined
              ),
            h.box
              .style({
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 6
              })
              .children(
                h.button
                  .testId("quick.cancel")
                  .style(secondaryButtonStyle(p, 10))
                  .on("press", Msg.CancelledQuickCard())
                  .children(
                    h.text
                      .style({ fontSize: 11.5, fontWeight: "600", color: p.inkSoft })
                      .children("Cancel")
                  ),
                h.button
                  .testId("quick.submit")
                  .style({
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: p.accent,
                    backgroundColor: p.accent
                  })
                  .hover({ backgroundColor: p.accentHover })
                  .on("press", Msg.SubmittedQuickCard())
                  .children(
                    h.text
                      .style({ fontSize: 11.5, fontWeight: "700", color: p.accentInk })
                      .children("Add card")
                  )
              )
          ),
      // Scrollable card list
      h.scroll
        .style({
          flex: 1,
          minHeight: 0,
          padding: 10
        })
        .children(
          h.box
            .collapsable(false)
            .style({ flexDirection: "column", gap: 8 })
            .children(
              visibleCards.length === 0
                ? h.box
                    .testId(`lane.empty.${lane.id}`)
                    .style({
                      padding: 16,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.rule,
                      backgroundColor: p.surface,
                      alignItems: "center"
                    })
                    .children(
                      h.text
                        .style({ fontSize: 12, color: p.inkMuted })
                        .children("No matching cards")
                    )
                : visibleCards.map((card) =>
                    cardItem(h, card, p, {
                      compact: screen.density === "compact",
                      searchQuery: screen.searchQuery,
                      isTabsLayout: false
                    })
                  )
            )
        )
    )
}
