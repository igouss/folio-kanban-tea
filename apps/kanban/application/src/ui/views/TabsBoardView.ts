import type { Ui } from "@universal-ui/core"
import { deriveBoardView } from "../../presentation/index.ts"
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
  noticeBanner,
  pillBadge,
  segmentedControl,
  textInputStyle,
  velocityProgressBar
} from "./controls.ts"

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
  const { workspaceMode } = screen
  const quickTitle = isComposerWorkspaceMode(workspaceMode)
    ? workspaceMode.title
    : ""
  const isSubmittingQuickCard =
    WorkspaceModeSchema.guards.SubmittingCard(workspaceMode)

  const mobileInputStyle = textInputStyle(p, {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderColor: p.border,
    backgroundColor: p.surface
  })

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
                  actionButton(h, p, {
                    label: screen.theme === "paper" ? "Dark" : "Light",
                    testId: "theme.toggle",
                    ariaLabel: "Toggle theme",
                    paddingHorizontal: 10,
                    fontSize: 11.5,
                    fontWeight: "700",
                    onPress: Msg.ClickedToggleTheme()
                  })
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
                  screen.canUndo &&
                    actionButton(h, p, {
                      label: "Undo",
                      variant: "ghost",
                      testId: "board.undo",
                      ariaLabel: "Undo last board change",
                      onPress: Msg.ClickedUndo()
                    }),
                  screen.canRedo &&
                    actionButton(h, p, {
                      label: "Redo",
                      variant: "ghost",
                      testId: "board.redo",
                      ariaLabel: "Redo board change",
                      onPress: Msg.ClickedRedo()
                    }),
                  actionButton(h, p, {
                    label: "Reset",
                    variant: "ghost",
                    testId: "board.reset",
                    ariaLabel: "Reset demo board",
                    textColor: p.accent,
                    onPress: Msg.ClickedResetDemo()
                  })
                )
            ),
          velocityProgressBar(h, velocity, p, { compact: true })
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
              const { lane, stats: lStats, wipText } = lanes.find(
                (l) => l.lane.id === tab.value
              )!
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
            .placeholderColor(p.inkMuted)
            .autoCorrect(false)
            .autoCapitalize("none")
            .on("changeText", ({ text }) => Msg.TypedSearchQuery({ text }))
            .style(mobileInputStyle),
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
            .value(quickTitle)
            .placeholder(`Quick add to ${activeLaneMeta.title}...`)
            .placeholderColor(p.inkMuted)
            .autoCorrect(true)
            .autoCapitalize("sentences")
            .on("changeText", ({ text }) => Msg.TypedQuickTitle({ text }))
            .on("submit", Msg.SubmittedQuickCard())
            .style({ ...mobileInputStyle, flex: 1 }),
          actionButton(h, p, {
            label: isSubmittingQuickCard ? "Adding..." : "+ Add",
            variant: "primary",
            testId: "quick.submit",
            ariaLabel: "Add card",
            disabled: isSubmittingQuickCard,
            paddingHorizontal: 14,
            paddingVertical: 9,
            fontSize: 13,
            style: { borderRadius: 8, borderWidth: 0, justifyContent: "center" },
            onPress: Msg.SubmittedQuickCard()
          })
        ),
      // WIP warning
      activeLane.stats.overWip &&
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
      noticeBanner(h, screen.notice, p, {
        testId: "board.notice",
        onDismiss: Msg.DismissedNotice(),
        dismissLabel: "OK",
        wholeBannerDismiss: true,
        style: { marginHorizontal: 16, marginBottom: 8 }
      }),
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
                ? emptyLaneBox(h, activeLane.stats.count, activeLaneMeta.title, p, {
                    testId: "board.empty",
                    spacious: true
                  })
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
