import type { CardDraft } from "@folio/kanban-domain"
import type { FolioPalette as Palette } from "@folio/kanban-domain/theme"
import type { Ui } from "@universal-ui/core"
import { deriveCardEditorControls } from "../presentation/index.ts"
import { FolioAppMessage as Msg, type FolioAppMessage } from "../FolioApp.ts"
import { fieldLabel, secondaryButtonStyle, segmentedControl } from "./ui.ts"

export const editorView = (
  h: Ui.H<FolioAppMessage>,
  draft: CardDraft,
  notice: string,
  p: Palette,
  mode: "modal" | "screen"
) => {
  const isModal = mode === "modal"
  const controls = deriveCardEditorControls({
    idPrefix: "folio",
    lane: draft.lane,
    priority: draft.priority,
    points: draft.points,
    useShortLaneLabels: !isModal,
    pointsSuffix: isModal ? "pt" : ""
  })

  const formBody = h.box
    .style({
      flexDirection: "column",
      gap: 12,
      padding: isModal ? 20 : 16
    })
    .children(
      // Header
      h.box
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8
        })
        .children(
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              gap: 8
            })
            .children(
              !isModal &&
                h.button
                  .testId("editor.back")
                  .ariaLabel("Back to board")
                  .style(secondaryButtonStyle(p, 10))
                  .on("press", Msg.CancelledEditCard())
                  .children(
                    h.text
                      .style({ fontSize: 12, fontWeight: "700", color: p.ink })
                      .children("← Board")
                  ),
              h.text
                .style({ fontSize: 16, fontWeight: "700", color: p.ink })
                .children(`Edit ${draft.code}`)
            ),
          h.button
            .testId("editor.close")
            .ariaLabel("Close editor")
            .style(secondaryButtonStyle(p, 10))
            .on("press", Msg.CancelledEditCard())
            .children(
              h.text
                .style({ fontSize: 12, fontWeight: "600", color: p.inkSoft })
                .children("Cancel")
            )
        ),
      // Validation / error notice inside editor
      notice.length > 0 &&
        h.box
          .testId("editor.notice")
          .role("alert")
          .style({
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 6,
            backgroundColor: p.accentSoft
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: "600", color: p.accent })
              .children(notice)
          ),
      // Title
      fieldLabel(h, "Title", p),
      h.input
        .testId("editor.title")
        .ariaLabel("Card title")
        .value(draft.title)
        .placeholder("Card title...")
        .style({
          width: "100%",
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: p.rule,
          backgroundColor: p.input,
          color: p.ink,
          fontSize: 14
        })
        .on("changeText", ({ text }) => Msg.TypedEditTitle({ text }))
        .on("submit", Msg.SubmittedEditCard())
        .on("keyDown", ({ key }) =>
          key === "Escape" ? Msg.CancelledEditCard() : undefined
        ),
      // Notes
      fieldLabel(h, "Notes", p),
      h.textarea
        .testId("editor.notes")
        .ariaLabel("Card notes")
        .value(draft.notes)
        .placeholder("Notes and acceptance criteria...")
        .minRows(3)
        .maxRows(5)
        .style({
          width: "100%",
          minHeight: 76,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: p.rule,
          backgroundColor: p.input,
          color: p.ink,
          fontSize: 13
        })
        .on("changeText", ({ text }) => Msg.TypedEditNotes({ text }))
        .on("keyDown", ({ key }) =>
          key === "Escape" ? Msg.CancelledEditCard() : undefined
        ),
      // Lane picker
      fieldLabel(h, "Lane", p),
      segmentedControl(h, controls.laneControl, p, {
        testIdPrefix: "editor.lane",
        current: draft.lane,
        stretch: !isModal,
        onSelect: (lane) => Msg.SelectedEditLane({ lane })
      }),
      // Priority picker
      fieldLabel(h, "Priority", p),
      segmentedControl(h, controls.priorityControl, p, {
        testIdPrefix: "editor.priority",
        current: draft.priority,
        tone: "accent",
        stretch: !isModal,
        onSelect: (priority) => Msg.SelectedEditPriority({ priority })
      }),
      // Assignee & Story points
      h.box
        .style({
          flexDirection: isModal ? "row" : "column",
          gap: 12
        })
        .children(
          h.box
            .style({ flexDirection: "column", gap: 6, ...(isModal ? { width: 130 } : {}) })
            .children(
              fieldLabel(h, "Assignee", p),
              h.input
                .testId("editor.assignee")
                .ariaLabel("Assignee initials")
                .value(draft.assignee)
                .placeholder("ME")
                .autoCapitalize("characters")
                .autoCorrect(false)
                .style({
                  width: "100%",
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: p.rule,
                  backgroundColor: p.input,
                  color: p.ink,
                  fontSize: 13
                })
                .on("changeText", ({ text }) => Msg.TypedEditAssignee({ text }))
                .on("submit", Msg.SubmittedEditCard())
                .on("keyDown", ({ key }) =>
                  key === "Escape" ? Msg.CancelledEditCard() : undefined
                )
            ),
          h.box
            .style({ flexDirection: "column", gap: 6, ...(isModal ? { flex: 1 } : {}) })
            .children(
              fieldLabel(h, "Story points", p),
              segmentedControl(h, controls.pointsControl, p, {
                testIdPrefix: "editor.points",
                current: String(draft.points),
                stretch: !isModal,
                onSelect: (value) =>
                  Msg.SelectedEditPoints({ points: Number(value) })
              })
            )
        ),
      // Footer buttons
      h.box
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 10,
          borderTopWidth: 1,
          borderColor: p.rule
        })
        .children(
          h.button
            .testId("editor.delete")
            .ariaLabel("Delete card")
            .style({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: p.accent,
              backgroundColor: p.accentSoft
            })
            .on("press", Msg.ClickedDeleteCard({ cardId: draft.cardId }))
            .children(
              h.text
                .style({ fontSize: 12.5, fontWeight: "700", color: p.accent })
                .children("Delete card")
            ),
          h.button
            .testId("editor.save")
            .ariaLabel("Save card changes")
            .style({
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: p.accent,
              backgroundColor: p.accent
            })
            .hover({ backgroundColor: p.accentHover })
            .on("press", Msg.SubmittedEditCard())
            .children(
              h.text
                .style({ fontSize: 12.5, fontWeight: "700", color: p.accentInk })
                .children("Save changes")
            )
        )
    )

  if (!isModal) {
    return h.scroll
      .testId("editor.view")
      .style({
        flex: 1,
        backgroundColor: p.canvas
      })
      .children(
        h.box.collapsable(false).style({ paddingBottom: 28 }).children(formBody)
      )
  }

  return h.box
    .testId("editor.view")
    .role("dialog")
    .ariaLabel(`Edit ${draft.code}`)
    .style({
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 50,
      backgroundColor: p.modalBackdrop,
      alignItems: "center",
      justifyContent: "center",
      padding: 24
    })
    .children(
      h.box
        .style({
          width: 540,
          maxWidth: "100%",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: p.ruleStrong,
          backgroundColor: p.surface
        })
        .children(formBody)
    )
}
