import type { Fabric } from "@folio/effect-ui-fabric"
import { LANES, type Priority } from "@folio/kanban-core"
import type { FolioPalette as Palette } from "@folio/kanban-core/theme"
import {
  KanbanMobileMessage as Msg,
  type EditDraft,
  type KanbanMobileMessage
} from "../domain/schema"

const PRIORITIES: ReadonlyArray<{
  readonly value: Priority
  readonly label: string
}> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" }
]

const POINTS: ReadonlyArray<number> = [1, 2, 3, 5, 8, 13]

export const detailView = (
  h: Fabric.H<KanbanMobileMessage>,
  draft: EditDraft,
  statusBanner: string,
  p: Palette
) =>
  h.view
    .key(`detail.${draft.cardId}`)
    .style({ flex: 1 })
    .children(
      h.view
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: p.border
        })
        .children(
          h.pressable
            .testID("detail.back")
            .accessibilityLabel("Back to board")
            .on("press", Msg.PressedBackToBoard())
            .style({ paddingVertical: 6, paddingRight: 12 })
            .children(
              h.text
                .style({ fontSize: 15, fontWeight: "700", color: p.accent })
                .children("‹ Board")
            ),
          h.text
            .style({ fontSize: 15, fontWeight: "700", color: p.ink })
            .children(draft.code),
          h.pressable
            .testID("detail.save")
            .accessibilityLabel("Save card")
            .on("press", Msg.PressedSaveDraft())
            .style({
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 7,
              backgroundColor: p.accent
            })
            .children(
              h.text
                .style({ fontSize: 13, fontWeight: "700", color: p.accentInk })
                .children("Save")
            )
        ),
      statusBanner.length > 0 &&
        h.view
          .style({
            marginHorizontal: 16,
            marginTop: 10,
            padding: 10,
            borderRadius: 6,
            backgroundColor: p.accentSoft
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: "600", color: p.accent })
              .children(statusBanner)
          ),
      h.scrollView
        .style({ flex: 1, paddingHorizontal: 16, paddingTop: 14 })
        .children(
          h.view
            .collapsable(false)
            .style({ gap: 14, paddingBottom: 32 })
            .children(
              h.view
                .style({ gap: 6 })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                    .children("TITLE"),
                  h.textInput
                    .testID("detail.title")
                    .value(draft.title)
                    .placeholder("Card title")
                    .on("changeText", ({ text }) => Msg.TypedDraftTitle({ text }))
                    .style({
                      fontSize: 16,
                      fontWeight: "600",
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      color: p.ink
                    })
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                    .children("LANE"),
                  h.view
                    .style({ flexDirection: "row", gap: 6 })
                    .children(
                      LANES.map((lane) => {
                        const active = draft.lane === lane.id
                        return h.pressable
                          .key(lane.id)
                          .testID(`detail.lane.${lane.id}`)
                          .on("press", Msg.SelectedDraftLane({ lane: lane.id }))
                          .style({
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 7,
                            alignItems: "center",
                            backgroundColor: active ? p.ink : p.surface,
                            borderWidth: 1,
                            borderColor: active ? p.ink : p.border
                          })
                          .children(
                            h.text
                              .style({
                                fontSize: 12,
                                fontWeight: "700",
                                color: active ? p.surface : p.ink
                              })
                              .children(lane.shortTitle)
                          )
                      })
                    )
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                    .children("PRIORITY"),
                  h.view
                    .style({ flexDirection: "row", gap: 6 })
                    .children(
                      PRIORITIES.map((opt) => {
                        const active = draft.priority === opt.value
                        return h.pressable
                          .key(opt.value)
                          .testID(`detail.priority.${opt.value}`)
                          .on("press", Msg.SelectedDraftPriority({ priority: opt.value }))
                          .style({
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 7,
                            alignItems: "center",
                            backgroundColor: active ? p.accent : p.surface,
                            borderWidth: 1,
                            borderColor: active ? p.accent : p.border
                          })
                          .children(
                            h.text
                              .style({
                                fontSize: 12,
                                fontWeight: "700",
                                color: active ? p.accentInk : p.ink
                              })
                              .children(opt.label)
                          )
                      })
                    )
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                    .children("STORY POINTS"),
                  h.view
                    .style({ flexDirection: "row", gap: 6 })
                    .children(
                      POINTS.map((pt) => {
                        const active = draft.points === pt
                        return h.pressable
                          .key(String(pt))
                          .testID(`detail.points.${pt}`)
                          .on("press", Msg.SelectedDraftPoints({ points: pt }))
                          .style({
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 7,
                            alignItems: "center",
                            backgroundColor: active ? p.ink : p.surface,
                            borderWidth: 1,
                            borderColor: active ? p.ink : p.border
                          })
                          .children(
                            h.text
                              .style({
                                fontSize: 12,
                                fontWeight: "700",
                                color: active ? p.surface : p.ink
                              })
                              .children(`${pt}`)
                          )
                      })
                    )
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                    .children("ASSIGNEE"),
                  h.textInput
                    .testID("detail.assignee")
                    .value(draft.assignee)
                    .autoCorrect(false)
                    .autoCapitalize("characters")
                    .on("changeText", ({ text }) => Msg.TypedDraftAssignee({ text }))
                    .style({
                      fontSize: 14,
                      padding: 11,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      color: p.ink
                    })
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  h.text
                    .style({ fontSize: 11, fontWeight: "700", color: p.inkMuted })
                    .children("NOTES"),
                  h.textInput
                    .testID("detail.notes")
                    .value(draft.notes)
                    .placeholder("Implementation notes...")
                    .on("changeText", ({ text }) => Msg.TypedDraftNotes({ text }))
                    .style({
                      fontSize: 14,
                      padding: 12,
                      minHeight: 80,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      color: p.ink
                    })
                ),
              h.pressable
                .testID("detail.delete")
                .accessibilityLabel("Delete card")
                .on("press", Msg.PressedDeleteCard({ cardId: draft.cardId }))
                .style({
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: p.accentSoft,
                  alignItems: "center",
                  marginTop: 6
                })
                .children(
                  h.text
                    .style({ fontSize: 14, fontWeight: "700", color: p.accent })
                    .children("Delete Card")
                )
            )
        )
    )
