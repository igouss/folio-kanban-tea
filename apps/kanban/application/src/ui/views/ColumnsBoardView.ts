import { readSegmentedControl } from "@universal-ui/behaviors"
import type { Ui } from "@universal-ui/core"
import { deriveBoardView } from "../../presentation/index.ts"
import type { BoardScreenSnapshot } from "../../state/index.ts"
import type { FolioPalette as Palette } from "../theme.ts"
import {
  FolioAppMessage as Msg,
  type FolioAppMessage,
  type FolioAppProps
} from "../FolioApp.ts"
import { InspectorFeature } from "../components/InspectorFeature.ts"
import { SyncStatus } from "../components/SyncStatus.ts"
import { laneColumn } from "./LaneColumn.ts"
import {
  actionButton,
  noticeBanner,
  pillBadge,
  segmentedControl,
  textInputStyle,
  velocityProgressBar
} from "./controls.ts"

const densityOptions: ReadonlyArray<{
  readonly value: "comfortable" | "compact"
  readonly label: string
}> = [
  { value: "comfortable", label: "Detailed" },
  { value: "compact", label: "Compact" }
]

const metricChip = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  label: string,
  value: string,
  p: Palette
) =>
  h.box
    .style({
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.rule
    })
    .children(
      h.text
        .style({ fontSize: 12, fontWeight: "600", color: p.inkMuted })
        .children(label),
      h.text
        .style({ fontSize: 12, fontWeight: "700", color: p.ink })
        .children(value)
    )

export const columnsBoardView = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  screen: BoardScreenSnapshot,
  p: Palette
) => {
  const board = deriveBoardView({
    idPrefix: "folio",
    cards: screen.cards,
    searchQuery: screen.searchQuery,
    priorityFilter: screen.priorityFilter
  })
  const densityControl = readSegmentedControl({
    id: "folio-density",
    value: screen.density,
    ariaLabel: "Card density",
    items: densityOptions
  })
  const { velocity: stats, progress: velocity, priorityControl } = board

  return h.box
    .style({ flex: 1, minHeight: 0, flexDirection: "column" })
    .children(
      // Topbar
      h.box
        .style({
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 20,
          backgroundColor: p.topbar,
          borderBottomWidth: 1,
          borderColor: p.rule,
          gap: 12
        })
        .children(
          h.box
            .style({ flexDirection: "row", alignItems: "center", gap: 10 })
            .children(
              h.box.style({
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: p.accent
              }),
              h.text
                .style({ fontSize: 18, fontWeight: "700", color: p.ink })
                .children("Folio Kanban"),
              pillBadge(h, "@effect/ui", {
                bg: p.lane,
                fg: p.inkSoft,
                border: p.rule
              }),
              pillBadge(
                h,
                h.props.platformLabel,
                { bg: p.pineSoft, fg: p.pine },
                "platform.badge"
              )
            ),
          h.box
            .style({
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8
            })
            .children(
              screen.canUndo &&
                actionButton(h, p, {
                  label: "Undo",
                  testId: "board.undo",
                  ariaLabel: "Undo last board change",
                  paddingHorizontal: 10,
                  onPress: Msg.ClickedUndo()
                }),
              screen.canRedo &&
                actionButton(h, p, {
                  label: "Redo",
                  testId: "board.redo",
                  ariaLabel: "Redo board change",
                  paddingHorizontal: 10,
                  onPress: Msg.ClickedRedo()
                }),
              actionButton(h, p, {
                label: "MVU Trace",
                testId: "board.inspector",
                ariaLabel: "Toggle MVU Trace",
                paddingHorizontal: 10,
                active: screen.inspectorOpen,
                onPress: Msg.ClickedToggleInspector()
              }),
              actionButton(h, p, {
                label:
                  screen.theme === "paper"
                    ? "Theme: Paper -> Graphite"
                    : "Theme: Graphite -> Paper",
                testId: "theme.toggle",
                ariaLabel: "Toggle theme",
                onPress: Msg.ClickedToggleTheme()
              }),
              actionButton(h, p, {
                label: "Reset demo",
                testId: "board.reset",
                ariaLabel: "Reset demo board",
                onPress: Msg.ClickedResetDemo()
              }),
              actionButton(h, p, {
                label: "+ New card",
                variant: "primary",
                testId: "board.newCard",
                ariaLabel: "Add new card",
                onPress: Msg.ClickedStartAddCard({ lane: "backlog" })
              })
            )
        ),
      // Toolbar + Telemetry
      h.box
        .style({
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 11,
          paddingHorizontal: 20,
          gap: 12,
          borderBottomWidth: 1,
          borderColor: p.rule,
          backgroundColor: p.canvas
        })
        .children(
          h.box
            .style({
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8
            })
            .children(
              h.input
                .testId("board.search")
                .ariaLabel("Search cards")
                .value(screen.searchQuery)
                .placeholder("Fuzzy filter by code, title, #tag, assignee...")
                .placeholderColor(p.inkMuted)
                .style(
                  textInputStyle(p, {
                    width: 260,
                    paddingVertical: 7,
                    borderRadius: 6
                  })
                )
                .on("changeText", ({ text }) => Msg.TypedSearchQuery({ text })),
              segmentedControl(h, priorityControl, p, {
                testIdPrefix: "filter",
                current: screen.priorityFilter,
                itemAriaLabel: (label) => `${label} priority`,
                onSelect: (priority) => Msg.SelectedPriorityFilter({ priority })
              }),
              segmentedControl(h, densityControl, p, {
                testIdPrefix: "density",
                current: screen.density,
                onSelect: (density) => Msg.SelectedDensity({ density })
              })
            ),
          h.box
            .style({ flexDirection: "row", alignItems: "center", gap: 12 })
            .children(
              metricChip(h, "Cards", String(stats.totalCards), p),
              metricChip(h, "Done", `${stats.donePoints}/${stats.totalPoints}pt`, p),
              velocityProgressBar(h, velocity, p)
            )
        ),
      // Notice banner
      noticeBanner(h, screen.notice, p, {
        testId: "board.notice",
        onDismiss: Msg.DismissedNotice(),
        dismissTestId: "notice.dismiss",
        style: { marginTop: 10, marginHorizontal: 20 }
      }),
      // Workspace body: 4 Kanban lanes + optional MVU Trace drawer
      h.box
        .style({
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          flexDirection: "row"
        })
        .children(
          h.box
            .role(board.board.rootAttrs.role ?? "region")
            .ariaLabel(
              board.board.rootAttrs["aria-label"] ?? "Folio Kanban board"
            )
            .style({
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              flexDirection: "row",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 18
            })
            .children(
              board.lanes.map((entry) => laneColumn(h, screen, entry, p))
            ),
          screen.inspectorOpen &&
            InspectorFeature.render(h, {
              key: "mvu-trace",
              props: {
                theme: screen.theme,
                dispatchCount: screen.dispatchCount,
                undoDepth: screen.undoDepth,
                redoDepth: screen.redoDepth
              },
              onEmit: {
                Closed: () => Msg.ClickedToggleInspector()
              },
              fallback: () => h.box
            })
        ),
      // Footer status bar
      h.box
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 8,
          paddingHorizontal: 20,
          backgroundColor: p.topbar,
          borderTopWidth: 1,
          borderColor: p.rule
        })
        .children(
          h.text
            .style({ fontSize: 11.5, color: p.inkMuted })
            .children(
              `Unified @effect/ui + @ui-sdk/core app (${h.props.platformLabel}) · Click any card to edit, < / > to move lanes`
            ),
          h.box
            .style({ flexDirection: "row", alignItems: "center", gap: 14 })
            .children(
              SyncStatus(h, {
                key: "board-sync",
                props: {
                  board: { cards: screen.cards, theme: screen.theme },
                  theme: screen.theme
                }
              }),
              h.text
                .testId("board.dispatches")
                .style({ fontSize: 11.5, fontWeight: "600", color: p.inkSoft })
                .children(`@effect/ui dispatches: ${screen.dispatchCount}`)
            )
        )
    )
}
