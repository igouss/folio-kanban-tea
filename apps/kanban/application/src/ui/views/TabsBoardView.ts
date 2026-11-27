import type { Ui } from "@universal-ui/core"
import { deriveBoardView } from "../../presentation/index.ts"
import type { BoardScreenSnapshot } from "../../state/index.ts"
import type { FolioPalette as Palette } from "../theme.ts"
import {
  FolioAppMessage as Msg,
  type FolioAppMessage,
  type FolioAppProps
} from "../FolioApp.ts"
import { cardItem } from "./CardItem.ts"
import { pillBadge, secondaryButtonStyle, segmentedControl } from "./controls.ts"

export const tabsBoardView = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  screen: BoardScreenSnapshot,
  p: Palette
) => {
  const board = deriveBoardView({
    idPrefix: "folio",
    cards: screen.cards,
    searchQuery: screen.searchQuery,
    priorityFilter: screen.priorityFilter,
    priorityLabelStyle: "short",
    activeLane: screen.activeLane
  })
  const {
    activeLane,
    lanes,
    laneTabs,
    priorityControl,
    progress: velocity,
    velocity: stats
  } = board
  const activeLaneMeta = activeLane.lane
  const visibleCards = activeLane.visibleCards
  const overWip = activeLane.stats.overWip
  const { canUndo, canRedo } = screen

  return h.box
    .style({ flex: 1, flexDirection: "column" })
    .children(
      // Mobile header
      h.box
        .style({
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: p.border,
          gap: 8
        })
        .children(
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between"
            })
            .children(
              h.box
                .style({ flexDirection: "row", alignItems: "center", gap: 8 })
                .children(
                  h.box.style({
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: p.accent
                  }),
                  h.text
                    .style({ fontSize: 21, fontWeight: "700", color: p.ink })
                    .children("Folio Kanban")
                ),
              h.box
                .style({ flexDirection: "row", alignItems: "center", gap: 8 })
                .children(
                  pillBadge(
                    h,
                    screen.lifecycleBadge,
                    { bg: p.pineSoft, fg: p.pine },
                    "lifecycle.badge"
                  ),
                  h.button
                    .testId("theme.toggle")
                    .ariaLabel("Toggle theme")
                    .style(secondaryButtonStyle(p, 10))
                    .on("press", Msg.ClickedToggleTheme())
                    .children(
                      h.text
                        .style({ fontSize: 11.5, fontWeight: "700", color: p.ink })
                        .children(screen.theme === "paper" ? "Dark" : "Light")
                    )
                )
            ),
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between"
            })
            .children(
              h.text
                .testId("board.velocity")
                .style({ fontSize: 12, color: p.inkMuted })
                .children(
                  `${stats.totalCards} cards · ${stats.donePoints}/${stats.totalPoints}pt done (${velocity.text})`
                ),
              h.box
                .style({ flexDirection: "row", alignItems: "center", gap: 10 })
                .children(
                  canUndo &&
                    h.button
                      .testId("board.undo")
                      .ariaLabel("Undo last board change")
                      .on("press", Msg.ClickedUndo())
                      .children(
                        h.text
                          .style({ fontSize: 12, fontWeight: "700", color: p.ink })
                          .children("Undo")
                      ),
                  canRedo &&
                    h.button
                      .testId("board.redo")
                      .ariaLabel("Redo board change")
                      .on("press", Msg.ClickedRedo())
                      .children(
                        h.text
                          .style({ fontSize: 12, fontWeight: "700", color: p.ink })
                          .children("Redo")
                      ),
                  h.button
                    .testId("board.reset")
                    .ariaLabel("Reset demo board")
                    .on("press", Msg.ClickedResetDemo())
                    .children(
                      h.text
                        .style({ fontSize: 12, fontWeight: "700", color: p.accent })
                        .children("Reset")
                    )
                )
            ),
          h.box
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
            .children(
              h.box.style({
                width: `${velocity.percent}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: p.pine
              })
            )
        ),
      // 4-lane @ui-sdk/core Tabs bar
      laneTabs !== undefined &&
        h.box
          .role(laneTabs.listAttrs.role ?? "tablist")
          .ariaLabel(laneTabs.listAttrs["aria-label"] ?? "Kanban lanes")
          .style({
            flexDirection: "row",
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 6,
            backgroundColor: p.surfaceAlt,
            borderBottomWidth: 1,
            borderBottomColor: p.border
          })
          .children(
            laneTabs.items.map((tab) => {
              const entry = lanes.find((l) => l.lane.id === tab.value)!
              const { lane, stats: lStats, wipText } = entry
              const isActive = tab.selected
              const laneOver = lStats.overWip
              return h.button
                .key(lane.id)
                .testId(`lane.tab.${lane.id}`)
                .role("tab")
                .ariaSelected(isActive)
                .ariaLabel(`${lane.title} lane, ${lStats.count} cards`)
                .on("press", Msg.SelectedLane({ lane: lane.id }))
                .style({
                  flex: 1,
                  flexDirection: "column",
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor: isActive ? p.ink : p.surface,
                  borderWidth: 1,
                  borderColor: laneOver
                    ? p.accent
                    : isActive
                      ? p.ink
                      : p.border
                })
                .children(
                  h.text
                    .style({
                      fontSize: 12,
                      fontWeight: "700",
                      color: isActive ? p.surface : p.ink
                    })
                    .children(tab.label),
                  h.text
                    .style({
                      fontSize: 11,
                      fontWeight: "600",
                      color: laneOver
                        ? p.accent
                        : isActive
                          ? p.chip
                          : p.inkMuted
                    })
                    .children(wipText)
                )
            })
          ),
      // Search & Priority segmented control
      h.box
        .style({
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
          gap: 8
        })
        .children(
          h.input
            .testId("board.search")
            .ariaLabel("Search cards")
            .value(screen.searchQuery)
            .placeholder("Filter cards by title, #tag, code...")
            .autoCorrect(false)
            .autoCapitalize("none")
            .on("changeText", ({ text }) => Msg.TypedSearchQuery({ text }))
            .style({
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.surface,
              color: p.ink
            }),
          segmentedControl(h, priorityControl, p, {
            testIdPrefix: "filter",
            current: screen.priorityFilter,
            tone: "accent",
            stretch: true,
            itemAriaLabel: (label) => `${label} priority`,
            onSelect: (priority) => Msg.SelectedPriorityFilter({ priority })
          })
        ),
      // Quick add bar for active lane
      h.box
        .style({
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingBottom: 10,
          gap: 8
        })
        .children(
          h.input
            .testId("quick.input")
            .ariaLabel(`New card in ${activeLaneMeta.title}`)
            .value(screen.quickTitle)
            .placeholder(`Quick add to ${activeLaneMeta.title}...`)
            .autoCorrect(true)
            .autoCapitalize("sentences")
            .on("changeText", ({ text }) => Msg.TypedQuickTitle({ text }))
            .on("submit", Msg.SubmittedQuickCard())
            .style({
              flex: 1,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.surface,
              color: p.ink
            }),
          h.button
            .testId("quick.submit")
            .ariaLabel("Add card")
            .on("press", Msg.SubmittedQuickCard())
            .style({
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 8,
              backgroundColor: p.accent,
              justifyContent: "center"
            })
            .children(
              h.text
                .style({ fontSize: 13, fontWeight: "700", color: p.accentInk })
                .children("+ Add")
            )
        ),
      // WIP warning
      overWip &&
        h.box
          .testId("lane.wipWarning")
          .style({
            marginHorizontal: 16,
            marginBottom: 8,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 6,
            backgroundColor: p.accentSoft
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: "700", color: p.accent })
              .children(
                `WIP limit exceeded in ${activeLaneMeta.title} (${activeLane.wipText})`
              )
          ),
      // Notice banner
      screen.notice.length > 0 &&
        h.button
          .testId("board.notice")
          .ariaLabel(screen.statusAnnouncement || screen.notice)
          .on("press", Msg.DismissedNotice())
          .style({
            marginHorizontal: 16,
            marginBottom: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 6,
            backgroundColor: p.pineSoft,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: "600", color: p.pine })
              .children(screen.notice),
            h.text
              .style({ fontSize: 11, fontWeight: "700", color: p.pine })
              .children("OK")
          ),
      // Active lane scroll view
      h.scroll
        .testId("board.scroll")
        .ariaLabel(activeLane.laneAttrs["aria-label"] ?? activeLaneMeta.title)
        .style({ flex: 1, paddingHorizontal: 16 })
        .children(
          h.box
            .collapsable(false)
            .style({ flexDirection: "column", gap: 10, paddingBottom: 24 })
            .children(
              visibleCards.length === 0
                ? h.box
                    .testId("board.empty")
                    .style({
                      padding: 28,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      alignItems: "center"
                    })
                    .children(
                      h.text
                        .style({ fontSize: 14, fontWeight: "600", color: p.inkMuted })
                        .children(`No cards in ${activeLaneMeta.title}`)
                    )
                : visibleCards.map((card) =>
                    cardItem(h, card, p, {
                      compact: false,
                      searchQuery: screen.searchQuery,
                      isTabsLayout: true
                    })
                  )
            )
        )
    )
}
