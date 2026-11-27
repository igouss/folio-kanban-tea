import type { Fabric } from "@folio/effect-ui-fabric"
import { deriveCardEditorControls } from "@folio/effect-ui-sdk"
import type { FolioPalette as Palette } from "@folio/kanban-core/theme"
import {
  KanbanMobileMessage as Msg,
  type EditDraft,
  type KanbanMobileMessage
} from "../domain/schema"
import { fabricFieldLabel, fabricSegmentedControl } from "./ui"

export const detailView = (
  h: Fabric.H<KanbanMobileMessage>,
  draft: EditDraft,
  statusBanner: string,
  p: Palette
) => {
  const { laneControl, priorityControl, pointsControl } =
    deriveCardEditorControls({
      idPrefix: "mobile",
      lane: draft.lane,
      priority: draft.priority,
      points: draft.points,
      useShortLaneLabels: true,
      pointsSuffix: ""
    })

  return h.view
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
                  fabricFieldLabel(h, "TITLE", p),
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
                  fabricFieldLabel(h, "LANE", p),
                  fabricSegmentedControl(h, laneControl, p, {
                    testIdPrefix: "detail.lane",
                    tone: "ink",
                    onSelect: (lane) => Msg.SelectedDraftLane({ lane })
                  })
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  fabricFieldLabel(h, "PRIORITY", p),
                  fabricSegmentedControl(h, priorityControl, p, {
                    testIdPrefix: "detail.priority",
                    tone: "accent",
                    onSelect: (priority) => Msg.SelectedDraftPriority({ priority })
                  })
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  fabricFieldLabel(h, "STORY POINTS", p),
                  fabricSegmentedControl(h, pointsControl, p, {
                    testIdPrefix: "detail.points",
                    tone: "ink",
                    onSelect: (value) =>
                      Msg.SelectedDraftPoints({ points: Number(value) })
                  })
                ),
              h.view
                .style({ gap: 6 })
                .children(
                  fabricFieldLabel(h, "ASSIGNEE", p),
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
                  fabricFieldLabel(h, "NOTES", p),
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
}
