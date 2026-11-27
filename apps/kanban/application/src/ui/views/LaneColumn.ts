import type { Ui } from "@universal-ui/core"
import type { LaneViewSnapshot } from "../../presentation/index.ts"
import {
  WorkspaceModeSchema,
  isComposerWorkspaceMode,
  type BoardScreenSnapshot
} from "../../state/index.ts"
import type { FolioPalette as Palette } from "../theme.ts"
import {
  FolioAppMessage as Msg,
  type FolioAppMessage,
  type FolioAppProps
} from "../FolioApp.ts"
import { cardItem } from "./CardItem.ts"
import {
  actionButton,
  emptyLaneBox,
  pillBadge,
  textInputStyle
} from "./controls.ts"

export const laneColumn = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  screen: BoardScreenSnapshot,
  entry: LaneViewSnapshot,
  p: Palette
) => {
  const { lane, stats, visibleCards, wipText, laneAttrs } = entry
  const overWip = stats.overWip
  const { workspaceMode } = screen
  const composerMode =
    isComposerWorkspaceMode(workspaceMode) && workspaceMode.lane === lane.id
      ? workspaceMode
      : undefined
  const isSubmitting =
    composerMode !== undefined &&
    WorkspaceModeSchema.guards.SubmittingCard(composerMode)

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
            .style({ flexDirection: "row", alignItems: "center", gap: 6 })
            .children(
              h.text
                .style({ fontSize: 10.5, fontWeight: "700", color: p.inkMuted })
                .children(lane.code),
              h.text
                .style({ fontSize: 13.5, fontWeight: "700", color: p.ink })
                .children(lane.title)
            ),
          h.box
            .style({ flexDirection: "row", alignItems: "center", gap: 6 })
            .children(
              pillBadge(h, wipText, {
                bg: overWip ? p.accentSoft : p.card,
                fg: overWip ? p.accent : p.inkSoft,
                border: overWip ? p.accent : p.rule
              }),
              actionButton(h, p, {
                label: "+",
                testId: `lane.add.${lane.id}`,
                ariaLabel: `Add card to ${lane.title}`,
                paddingVertical: 2,
                paddingHorizontal: 8,
                fontSize: 13,
                fontWeight: "700",
                onPress: Msg.ClickedStartAddCard({ lane: lane.id })
              })
            )
        ),
      // Inline quick-add composer
      composerMode !== undefined &&
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
              .value(composerMode.title)
              .placeholder(`New card in ${lane.title}...`)
              .placeholderColor(p.inkMuted)
              .autoFocus(true)
              .style(
                textInputStyle(p, {
                  width: "100%",
                  paddingVertical: 7,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  borderColor: p.ruleStrong
                })
              )
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
                actionButton(h, p, {
                  label: "Cancel",
                  testId: "quick.cancel",
                  paddingHorizontal: 10,
                  fontSize: 11.5,
                  textColor: p.inkSoft,
                  onPress: Msg.CancelledQuickCard()
                }),
                actionButton(h, p, {
                  label: isSubmitting ? "Adding..." : "Add card",
                  variant: "primary",
                  testId: "quick.submit",
                  disabled: isSubmitting,
                  fontSize: 11.5,
                  onPress: Msg.SubmittedQuickCard()
                })
              )
          ),
      // Scrollable card list
      h.scroll
        .style({ flex: 1, minHeight: 0, padding: 10 })
        .children(
          h.box
            .collapsable(false)
            .style({ flexDirection: "column", gap: 8 })
            .children(
              visibleCards.length === 0
                ? emptyLaneBox(h, stats.count, lane.title, p, {
                    testId: `lane.empty.${lane.id}`
                  })
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
