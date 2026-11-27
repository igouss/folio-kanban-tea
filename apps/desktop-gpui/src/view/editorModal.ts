import type { Gpui } from "@folio/effect-ui-gpui"
import type { KanbanDesktopMessage, KanbanDesktopModel } from "../board.ts"
import { KanbanDesktopMessage as Msg } from "../board.ts"
import type { EditDraft, Priority } from "../domain.ts"
import type { Palette } from "../palette.ts"

const PRIORITIES: ReadonlyArray<{
  readonly value: Priority
  readonly label: string
}> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" }
]

const POINT_CHOICES: ReadonlyArray<number> = [1, 2, 3, 5, 8, 13]

export const editorModal = (
  h: Gpui.H<KanbanDesktopMessage>,
  model: KanbanDesktopModel,
  draft: EditDraft,
  p: Palette
) =>
  h.box
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
                .hover({ backgroundColor: p.lane })
                .on("click", Msg.CancelledEditCard())
                .children("Close")
            ),
          h.box
            .style({ display: "flex", flexDirection: "column", gap: 5 })
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                .children("TITLE"),
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
              h.text
                .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                .children("LANE"),
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
                  model.columns.map((col) => {
                    const active = draft.columnId === col.id
                    return h.button
                      .key(col.id)
                      .testId(`editor.lane.${col.id}`)
                      .style({
                        flexGrow: 1,
                        paddingTop: 5,
                        paddingBottom: 5,
                        paddingLeft: 8,
                        paddingRight: 8,
                        borderRadius: 5,
                        backgroundColor: active ? p.cardHover : "transparent",
                        color: active ? p.ink : p.inkSoft,
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: "center"
                      })
                      .on("click", Msg.SelectedEditColumn({ columnId: col.id }))
                      .children(col.name)
                  })
                )
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
                  h.text
                    .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                    .children("PRIORITY"),
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
                      PRIORITIES.map((opt) => {
                        const active = draft.priority === opt.value
                        return h.button
                          .key(opt.value)
                          .testId(`editor.priority.${opt.value}`)
                          .style({
                            flexGrow: 1,
                            paddingTop: 5,
                            paddingBottom: 5,
                            paddingLeft: 8,
                            paddingRight: 8,
                            borderRadius: 5,
                            backgroundColor: active ? p.cardHover : "transparent",
                            color: active ? p.ink : p.inkSoft,
                            fontSize: 12,
                            fontWeight: 600,
                            textAlign: "center"
                          })
                          .on(
                            "click",
                            Msg.SelectedEditPriority({ priority: opt.value })
                          )
                          .children(opt.label)
                      })
                    )
                ),
              h.box
                .style({
                  width: 110,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5
                })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                    .children("ASSIGNEE"),
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
              h.text
                .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                .children("STORY POINTS"),
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
                  POINT_CHOICES.map((pt) => {
                    const active = draft.points === pt
                    return h.button
                      .key(String(pt))
                      .testId(`editor.points.${pt}`)
                      .style({
                        flexGrow: 1,
                        paddingTop: 5,
                        paddingBottom: 5,
                        borderRadius: 5,
                        backgroundColor: active ? p.cardHover : "transparent",
                        color: active ? p.ink : p.inkSoft,
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: "center"
                      })
                      .on("click", Msg.SelectedEditPoints({ points: pt }))
                      .children(`${pt}pt`)
                  })
                )
            ),
          h.box
            .style({ display: "flex", flexDirection: "column", gap: 5 })
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: 700, color: p.inkMuted })
                .children("NOTES"),
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
                .on(
                  "click",
                  Msg.ClickedDeleteCard({
                    cardId: draft.cardId,
                    columnId: draft.columnId
                  })
                )
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
