import type { Gpui } from "@folio/effect-ui-gpui"
import { paletteFor } from "@folio/kanban-core/theme"
import { Option } from "effect"
import type {
  KanbanDesktopMessage,
  KanbanDesktopModel
} from "../components/KanbanDesktop.ts"
import { KanbanDesktopMessage as Msg } from "../components/KanbanDesktop.ts"
import type { PriorityFilter } from "../domain/board.ts"
import { editorModal } from "./EditorModal.ts"
import { laneView } from "./LaneView.ts"

const PRIORITY_FILTERS: ReadonlyArray<{
  readonly value: PriorityFilter
  readonly label: string
}> = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" }
]

export const boardView = (
  h: Gpui.H<KanbanDesktopMessage>,
  model: KanbanDesktopModel
) => {
  const p = paletteFor(model.theme)
  const allCards = model.columns.flatMap((col) => col.cards)
  const totalPoints = allCards.reduce((sum, card) => sum + card.points, 0)
  const donePoints =
    model.columns
      .find((col) => col.id === "done")
      ?.cards.reduce((sum, card) => sum + card.points, 0) ?? 0
  const pct = totalPoints === 0 ? 0 : Math.round((donePoints / totalPoints) * 100)

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
              h.button
                .testId("theme.toggle")
                .style({
                  paddingTop: 6,
                  paddingBottom: 6,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.card,
                  color: p.ink,
                  fontSize: 12,
                  fontWeight: 600
                })
                .hover({ backgroundColor: p.cardHover, borderColor: p.ruleStrong })
                .on("click", Msg.ClickedToggleTheme())
                .children(
                  model.theme === "paper"
                    ? "Theme: Paper -> Graphite"
                    : "Theme: Graphite -> Paper"
                ),
              h.button
                .testId("board.reset")
                .style({
                  paddingTop: 6,
                  paddingBottom: 6,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.card,
                  color: p.ink,
                  fontSize: 12,
                  fontWeight: 600
                })
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
                .on("click", Msg.ClickedAddCard({ columnId: "backlog" }))
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
              h.box
                .style({
                  display: "flex",
                  flexDirection: "row",
                  padding: 3,
                  gap: 2,
                  borderRadius: 7,
                  backgroundColor: p.lane,
                  borderWidth: 1,
                  borderColor: p.rule
                })
                .children(
                  PRIORITY_FILTERS.map((opt) => {
                    const active = model.priorityFilter === opt.value
                    return h.button
                      .key(opt.value)
                      .testId(`filter.${opt.value}`)
                      .style({
                        paddingTop: 5,
                        paddingBottom: 5,
                        paddingLeft: 10,
                        paddingRight: 10,
                        borderRadius: 5,
                        backgroundColor: active ? p.cardHover : "transparent",
                        color: active ? p.ink : p.inkSoft,
                        fontSize: 12,
                        fontWeight: 600
                      })
                      .on(
                        "click",
                        Msg.SelectedPriorityFilter({ priority: opt.value })
                      )
                      .children(opt.label)
                  })
                )
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
                    .children(String(allCards.length))
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
                    .children(`${donePoints}/${totalPoints}pt`)
                ),
              h.box
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
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 999,
                        backgroundColor: p.pine
                      })
                    ),
                  h.text
                    .style({ fontSize: 12, fontWeight: 700, color: p.ink })
                    .children(`${pct}%`)
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
        .children(
          model.columns.map((column, idx) =>
            laneView(h, model, column, idx, p)
          )
        ),
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
              "Native @effect/ui Renderer.Host over Zed GPUI · Click any title to edit, < / > to move lanes"
            ),
          h.text
            .testId("board.dispatches")
            .style({ fontSize: 11.5, fontWeight: 600, color: p.inkSoft })
            .children(`@effect/ui dispatches: ${model.dispatchCount}`)
        ),
      // Modal editor overlay
      Option.match(model.editDraft, {
        onNone: () => false,
        onSome: (draft) => editorModal(h, model, draft, p)
      })
    )
}
