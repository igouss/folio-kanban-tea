import type { Gpui } from "@folio/effect-ui-gpui"
import { deriveCardEditorControls } from "@folio/effect-ui-sdk"
import type { CardDraft } from "@folio/kanban-core"
import type { FolioPalette as Palette } from "@folio/kanban-core/theme"
import type { KanbanDesktopMessage } from "../components/KanbanDesktop.ts"
import { KanbanDesktopMessage as Msg } from "../components/KanbanDesktop.ts"
import { gpuiFieldLabel, gpuiSecondaryButtonStyle, gpuiSegmentedControl } from "./ui.ts"

export const editorModal = (
  h: Gpui.H<KanbanDesktopMessage>,
  draft: CardDraft,
  p: Palette
) => {
  const { laneControl, priorityControl, pointsControl } =
    deriveCardEditorControls({
      idPrefix: "desktop",
      lane: draft.lane,
      priority: draft.priority,
      points: draft.points
    })

  return h.box
    .testId("editor.modal")
    .role("dialog")
    .ariaLabel(`Edit ${draft.code}`)
    .style({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.modalBackdrop,
      padding: 24
    })
    .children(
      h.box
        .style({
          width: 520,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          paddingTop: 20,
          paddingBottom: 20,
          paddingLeft: 22,
          paddingRight: 22,
          borderRadius: 12,
          backgroundColor: p.cardHover,
          borderWidth: 1,
          borderColor: p.ruleStrong,
          boxShadow: {
            offsetX: 0,
            offsetY: 10,
            blurRadius: 26,
            spreadRadius: 0,
            color: p.modalShadow
          }
        })
        .children(
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderColor: p.rule
            })
            .children(
              h.text
                .style({ fontSize: 16, fontWeight: 700, color: p.ink })
                .children(`Edit ${draft.code}`),
              h.button
                .testId("editor.close")
                .style(gpuiSecondaryButtonStyle(p))
                .hover({ backgroundColor: p.lane })
                .on("click", Msg.CancelledEditCard())
                .children("Close")
            ),
          h.box
            .style({ display: "flex", flexDirection: "column", gap: 5 })
            .children(
              gpuiFieldLabel(h, "TITLE", p),
              h.input
                .testId("editor.title")
                .value(draft.title)
                .placeholder("Card title")
                .style({
                  width: "100%",
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 10,
                  paddingRight: 10,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.input,
                  color: p.ink,
                  fontSize: 13
                })
                .on("change", ({ value }) => Msg.TypedEditTitle({ value }))
                .on("submit", Msg.SubmittedEditCard())
            ),
          h.box
            .style({ display: "flex", flexDirection: "column", gap: 5 })
            .children(
              gpuiFieldLabel(h, "LANE", p),
              gpuiSegmentedControl(h, laneControl, p, {
                testIdPrefix: "editor.lane",
                fill: true,
                onSelect: (lane) => Msg.SelectedEditLane({ lane })
              })
            ),
          h.box
            .style({ display: "flex", flexDirection: "row", gap: 10 })
            .children(
              h.box
                .style({
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5
                })
                .children(
                  gpuiFieldLabel(h, "PRIORITY", p),
                  gpuiSegmentedControl(h, priorityControl, p, {
                    testIdPrefix: "editor.priority",
                    fill: true,
                    onSelect: (priority) => Msg.SelectedEditPriority({ priority })
                  })
                ),
              h.box
                .style({
                  width: 110,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5
                })
                .children(
                  gpuiFieldLabel(h, "ASSIGNEE", p),
                  h.input
                    .testId("editor.assignee")
                    .value(draft.assignee)
                    .style({
                      width: "100%",
                      paddingTop: 7,
                      paddingBottom: 7,
                      paddingLeft: 10,
                      paddingRight: 10,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: p.rule,
                      backgroundColor: p.input,
                      color: p.ink,
                      fontSize: 13
                    })
                    .on("change", ({ value }) => Msg.TypedEditAssignee({ value }))
                )
            ),
          h.box
            .style({ display: "flex", flexDirection: "column", gap: 5 })
            .children(
              gpuiFieldLabel(h, "STORY POINTS", p),
              gpuiSegmentedControl(h, pointsControl, p, {
                testIdPrefix: "editor.points",
                fill: true,
                onSelect: (value) => Msg.SelectedEditPoints({ points: Number(value) })
              })
            ),
          h.box
            .style({ display: "flex", flexDirection: "column", gap: 5 })
            .children(
              gpuiFieldLabel(h, "NOTES", p),
              h.textarea
                .testId("editor.notes")
                .value(draft.notes)
                .placeholder("Implementation notes...")
                .minRows(3)
                .maxRows(5)
                .style({
                  width: "100%",
                  height: 76,
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 10,
                  paddingRight: 10,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.input,
                  color: p.ink,
                  fontSize: 13
                })
                .on("change", ({ value }) => Msg.TypedEditNotes({ value }))
            ),
          h.box
            .style({
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 6
            })
            .children(
              h.button
                .testId("editor.delete")
                .style({
                  paddingTop: 7,
                  paddingBottom: 7,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: p.accent,
                  backgroundColor: p.accentSoft,
                  color: p.accent,
                  fontSize: 12,
                  fontWeight: 600
                })
                .on("click", Msg.ClickedDeleteCard({ cardId: draft.cardId }))
                .children("Delete card"),
              h.box
                .style({ display: "flex", flexDirection: "row", gap: 8 })
                .children(
                  h.button
                    .testId("editor.cancel")
                    .style({
                      paddingTop: 7,
                      paddingBottom: 7,
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
                    .on("click", Msg.CancelledEditCard())
                    .children("Cancel"),
                  h.button
                    .testId("editor.save")
                    .style({
                      paddingTop: 7,
                      paddingBottom: 7,
                      paddingLeft: 14,
                      paddingRight: 14,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: p.accent,
                      backgroundColor: p.accent,
                      color: p.accentInk,
                      fontSize: 12,
                      fontWeight: 700
                    })
                    .hover({ backgroundColor: p.accentHover })
                    .on("click", Msg.SubmittedEditCard())
                    .children("Save card")
                )
            )
        )
    )
}
