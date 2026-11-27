import type { Gpui } from "@folio/effect-ui-gpui"
import { deriveBoardView } from "@folio/effect-ui-sdk"
import { canRedoHistory, canUndoHistory } from "@folio/kanban-core"
import { paletteFor } from "@folio/kanban-core/theme"
import { Option } from "effect"
import type {
  KanbanDesktopMessage,
  KanbanDesktopModel
} from "../components/KanbanDesktop.ts"
import { KanbanDesktopMessage as Msg } from "../components/KanbanDesktop.ts"
import { editorModal } from "./EditorModal.ts"
import { laneView } from "./LaneView.ts"
import { gpuiSecondaryButtonStyle, gpuiSegmentedControl } from "./ui.ts"

export const boardView = (
  h: Gpui.H<KanbanDesktopMessage>,
  model: KanbanDesktopModel
) => {
  const p = paletteFor(model.theme)
  const board = deriveBoardView({
    idPrefix: "desktop",
    cards: model.cards,
    searchQuery: model.searchQuery,
    priorityFilter: model.priorityFilter
  })
  const { velocity: stats, progress: velocity, priorityControl } = board
  const canUndo = canUndoHistory(model.history)
  const canRedo = canRedoHistory(model.history)

  return h.box
    .testId("board.root")
    .style({
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      backgroundColor: p.canvas,
      color: p.ink,
      fontSize: 13
    })
    .children(
      // Topbar
      h.box
        .style({
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
          backgroundColor: p.topbar,
          borderBottomWidth: 1,
          borderColor: p.rule,
          gap: 14
        })
        .children(
          h.box
            .style({
              display: "flex",
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
                .style({ fontSize: 18, fontWeight: 700, color: p.ink })
                .children("Folio Kanban"),
              h.box
                .style({
                  paddingTop: 3,
                  paddingBottom: 3,
                  paddingLeft: 8,
                  paddingRight: 8,
                  borderRadius: 999,
                  backgroundColor: p.lane,
                  borderWidth: 1,
                  borderColor: p.rule
                })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: 600, color: p.inkSoft })
                    .children("@effect/ui")
                ),
              h.box
                .style({
                  paddingTop: 3,
                  paddingBottom: 3,
                  paddingLeft: 8,
                  paddingRight: 8,
                  borderRadius: 999,
                  backgroundColor: p.pineSoft
                })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: 600, color: p.pine })
                    .children("GPUI · Native GPU")
                )
            ),
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8
            })
            .children(
              canUndo &&
                h.button
                  .testId("board.undo")
                  .ariaLabel("Undo last board change")
                  .style(gpuiSecondaryButtonStyle(p, 10))
                  .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                  .on("click", Msg.ClickedUndo())
                  .children("Undo"),
              canRedo &&
                h.button
                  .testId("board.redo")
                  .ariaLabel("Redo board change")
                  .style(gpuiSecondaryButtonStyle(p, 10))
                  .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                  .on("click", Msg.ClickedRedo())
                  .children("Redo"),
              h.button
                .testId("theme.toggle")
                .style(gpuiSecondaryButtonStyle(p))
                .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                .on("click", Msg.ClickedToggleTheme())
                .children(
                  model.theme === "paper"
                    ? "Theme: Paper -> Graphite"
                    : "Theme: Graphite -> Paper"
                ),
              h.button
                .testId("board.reset")
                .style(gpuiSecondaryButtonStyle(p))
                .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                .on("click", Msg.ClickedResetDemo())
                .children("Reset demo"),
              h.button
                .testId("board.newCard")
                .style({
                  paddingTop: 6,
                  paddingBottom: 6,
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
                .on("click", Msg.ClickedAddCard({ lane: "backlog" }))
                .children("+ New card")
            )
        ),
      // Subbar
      h.box
        .style({
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
          gap: 12,
          borderBottomWidth: 1,
          borderColor: p.rule,
          backgroundColor: p.canvas
        })
        .children(
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8
            })
            .children(
              h.input
                .testId("board.search")
                .value(model.searchQuery)
                .placeholder("Filter by code, title, #tag, assignee...")
                .style({
                  width: 270,
                  paddingTop: 7,
                  paddingBottom: 7,
                  paddingLeft: 11,
                  paddingRight: 11,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.input,
                  color: p.ink,
                  fontSize: 13
                })
                .on("change", ({ value }) => Msg.TypedSearchQuery({ value })),
              gpuiSegmentedControl(h, priorityControl, p, {
                testIdPrefix: "filter",
                itemAriaLabel: (label) => `${label} priority`,
                onSelect: (priority) => Msg.SelectedPriorityFilter({ priority })
              })
            ),
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 14
            })
            .children(
              h.box
                .style({
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingTop: 5,
                  paddingBottom: 5,
                  paddingLeft: 10,
                  paddingRight: 10,
                  borderRadius: 6,
                  backgroundColor: p.card,
                  borderWidth: 1,
                  borderColor: p.rule
                })
                .children(
                  h.text
                    .style({ fontSize: 12, fontWeight: 600, color: p.inkMuted })
                    .children("Cards"),
                  h.text
                    .style({ fontSize: 12, fontWeight: 700, color: p.ink })
                    .children(String(stats.totalCards))
                ),
              h.box
                .style({
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingTop: 5,
                  paddingBottom: 5,
                  paddingLeft: 10,
                  paddingRight: 10,
                  borderRadius: 6,
                  backgroundColor: p.card,
                  borderWidth: 1,
                  borderColor: p.rule
                })
                .children(
                  h.text
                    .style({ fontSize: 12, fontWeight: 600, color: p.inkMuted })
                    .children("Done"),
                  h.text
                    .style({ fontSize: 12, fontWeight: 700, color: p.ink })
                    .children(`${stats.donePoints}/${stats.totalPoints}pt`)
                ),
              h.box
                .role(velocity.rootAttrs.role ?? "progressbar")
                .ariaLabel(velocity.rootAttrs["aria-label"] ?? "Sprint velocity")
                .style({
                  display: "flex",
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
                    .style({ fontSize: 12, fontWeight: 700, color: p.ink })
                    .children(velocity.text)
                )
            )
        ),
      // Notice bar
      model.notice.length > 0 &&
        h.box
          .testId("board.notice")
          .style({
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
            marginLeft: 20,
            marginRight: 20,
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 6,
            backgroundColor: p.pineSoft
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: 600, color: p.pine })
              .children(model.notice),
            h.button
              .testId("notice.dismiss")
              .style({
                color: p.pine,
                fontSize: 12,
                fontWeight: 700
              })
              .on("click", Msg.DismissedNotice())
              .children("Dismiss")
          ),
      // 4-lane Kanban Board
      h.box
        .role(board.board.rootAttrs.role ?? "region")
        .ariaLabel(board.board.rootAttrs["aria-label"] ?? "Folio Kanban board")
        .style({
          flexGrow: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "row",
          gap: 12,
          paddingTop: 14,
          paddingBottom: 14,
          paddingLeft: 18,
          paddingRight: 18
        })
        .children(board.lanes.map((entry) => laneView(h, model, entry, p))),
      // Status bar
      h.box
        .style({
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 20,
          paddingRight: 20,
          backgroundColor: p.topbar,
          borderTopWidth: 1,
          borderColor: p.rule
        })
        .children(
          h.text
            .style({ fontSize: 11.5, color: p.inkMuted })
            .children(
              "Native @effect/ui + @ui-sdk/core over Zed GPUI · Click any title to edit, < / > to move lanes"
            ),
          h.text
            .testId("board.dispatches")
            .style({ fontSize: 11.5, fontWeight: 600, color: p.inkSoft })
            .children(`@effect/ui dispatches: ${model.dispatchCount}`)
        ),
      // Modal editor overlay
      Option.match(model.editDraft, {
        onNone: () => false,
        onSome: (draft) => editorModal(h, draft, p)
      })
    )
}
