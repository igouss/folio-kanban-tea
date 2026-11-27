import { canRedoHistory, canUndoHistory } from "@folio/kanban-domain"
import type { FolioPalette as Palette } from "@folio/kanban-domain/theme"
import { readSegmentedControl } from "@universal-ui/behaviors"
import type { Ui } from "@universal-ui/core"
import { deriveBoardView } from "../presentation/index.ts"
import {
  FolioAppMessage as Msg,
  type FolioAppMessage,
  type FolioAppModel,
  type FolioAppProps
} from "../FolioApp.ts"
import { inspectorPanel } from "./InspectorPanel.ts"
import { laneColumn } from "./LaneColumn.ts"
import { pillBadge, secondaryButtonStyle, segmentedControl } from "./ui.ts"

const densityOptions: ReadonlyArray<{
  readonly value: "comfortable" | "compact"
  readonly label: string
}> = [
  { value: "comfortable", label: "Detailed" },
  { value: "compact", label: "Compact" }
]

export const columnsBoardView = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  model: FolioAppModel,
  p: Palette
) => {
  const board = deriveBoardView({
    idPrefix: "folio",
    cards: model.cards,
    searchQuery: model.searchQuery,
    priorityFilter: model.priorityFilter
  })
  const densityControl = readSegmentedControl({
    id: "folio-density",
    value: model.density,
    ariaLabel: "Card density",
    items: densityOptions
  })
  const { velocity: stats, progress: velocity, priorityControl } = board
  const canUndo = canUndoHistory(model.history)
  const canRedo = canRedoHistory(model.history)

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
            .style({
              flexDirection: "row",
              alignItems: "center",
              gap: 10
            })
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
              canUndo &&
                h.button
                  .testId("board.undo")
                  .ariaLabel("Undo last board change")
                  .style(secondaryButtonStyle(p, 10))
                  .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                  .on("press", Msg.ClickedUndo())
                  .children(
                    h.text
                      .style({ fontSize: 12, fontWeight: "600", color: p.ink })
                      .children("Undo")
                  ),
              canRedo &&
                h.button
                  .testId("board.redo")
                  .ariaLabel("Redo board change")
                  .style(secondaryButtonStyle(p, 10))
                  .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                  .on("press", Msg.ClickedRedo())
                  .children(
                    h.text
                      .style({ fontSize: 12, fontWeight: "600", color: p.ink })
                      .children("Redo")
                  ),
              h.button
                .testId("board.inspector")
                .ariaLabel("Toggle MVU Trace")
                .style({
                  ...secondaryButtonStyle(p, 10),
                  ...(model.inspectorOpen
                    ? { backgroundColor: p.ink, borderColor: p.ink }
                    : {})
                })
                .on("press", Msg.ClickedToggleInspector())
                .children(
                  h.text
                    .style({
                      fontSize: 12,
                      fontWeight: "600",
                      color: model.inspectorOpen ? p.card : p.ink
                    })
                    .children("MVU Trace")
                ),
              h.button
                .testId("theme.toggle")
                .ariaLabel("Toggle theme")
                .style(secondaryButtonStyle(p))
                .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                .on("press", Msg.ClickedToggleTheme())
                .children(
                  h.text
                    .style({ fontSize: 12, fontWeight: "600", color: p.ink })
                    .children(
                      model.theme === "paper"
                        ? "Theme: Paper -> Graphite"
                        : "Theme: Graphite -> Paper"
                    )
                ),
              h.button
                .testId("board.reset")
                .ariaLabel("Reset demo board")
                .style(secondaryButtonStyle(p))
                .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                .on("press", Msg.ClickedResetDemo())
                .children(
                  h.text
                    .style({ fontSize: 12, fontWeight: "600", color: p.ink })
                    .children("Reset demo")
                ),
              h.button
                .testId("board.newCard")
                .ariaLabel("Add new card")
                .style({
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.accent,
                  backgroundColor: p.accent
                })
                .hover({ backgroundColor: p.accentHover })
                .on("press", Msg.ClickedStartAddCard({ lane: "backlog" }))
                .children(
                  h.text
                    .style({ fontSize: 12, fontWeight: "700", color: p.accentInk })
                    .children("+ New card")
                )
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
                .value(model.searchQuery)
                .placeholder("Fuzzy filter by code, title, #tag, assignee...")
                .style({
                  width: 260,
                  paddingVertical: 7,
                  paddingHorizontal: 11,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.input,
                  color: p.ink,
                  fontSize: 13
                })
                .on("changeText", ({ text }) => Msg.TypedSearchQuery({ text })),
              segmentedControl(h, priorityControl, p, {
                testIdPrefix: "filter",
                current: model.priorityFilter,
                itemAriaLabel: (label) => `${label} priority`,
                onSelect: (priority) => Msg.SelectedPriorityFilter({ priority })
              }),
              segmentedControl(h, densityControl, p, {
                testIdPrefix: "density",
                current: model.density,
                onSelect: (density) => Msg.SelectedDensity({ density })
              })
            ),
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              gap: 12
            })
            .children(
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
                    .children("Cards"),
                  h.text
                    .style({ fontSize: 12, fontWeight: "700", color: p.ink })
                    .children(String(stats.totalCards))
                ),
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
                    .children("Done"),
                  h.text
                    .style({ fontSize: 12, fontWeight: "700", color: p.ink })
                    .children(`${stats.donePoints}/${stats.totalPoints}pt`)
                ),
              h.box
                .testId("board.progress")
                .role(velocity.rootAttrs.role ?? "progressbar")
                .ariaLabel(velocity.rootAttrs["aria-label"] ?? "Sprint velocity")
                .ariaValueNow(velocity.percent)
                .ariaValueMin(0)
                .ariaValueMax(100)
                .ariaValueText(velocity.text)
                .style({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8
                })
                .children(
                  h.box
                    .style({
                      width: 96,
                      height: 7,
                      borderRadius: 999,
                      backgroundColor: p.lane,
                      overflow: "hidden"
                    })
                    .children(
                      h.box.style({
                        width: `${velocity.percent}%`,
                        height: "100%",
                        borderRadius: 999,
                        backgroundColor: p.pine
                      })
                    ),
                  h.text
                    .style({ fontSize: 12, fontWeight: "700", color: p.ink })
                    .children(velocity.text)
                )
            )
        ),
      // Notice banner
      model.notice.length > 0 &&
        h.box
          .testId("board.notice")
          .role("status")
          .ariaLabel(model.statusAnnouncement || model.notice)
          .style({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
            marginHorizontal: 20,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 6,
            backgroundColor: p.pineSoft
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: "600", color: p.pine })
              .children(model.notice),
            h.button
              .testId("notice.dismiss")
              .on("press", Msg.DismissedNotice())
              .children(
                h.text
                  .style({ fontSize: 12, fontWeight: "700", color: p.pine })
                  .children("Dismiss")
              )
          ),
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
            .ariaLabel(board.board.rootAttrs["aria-label"] ?? "Folio Kanban board")
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
              board.lanes.map((entry) => laneColumn(h, model, entry, p))
            ),
          model.inspectorOpen && inspectorPanel(h, model, p)
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
          h.text
            .testId("board.dispatches")
            .style({ fontSize: 11.5, fontWeight: "600", color: p.inkSoft })
            .children(`@effect/ui dispatches: ${model.dispatchCount}`)
        )
    )
}
