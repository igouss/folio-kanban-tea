import { UiSchema } from "@effect/ui"
import {
  normalizeDraftAssignee,
  storyPointsFromLabel,
  validateCardTitle
} from "@folio/kanban-domain"
import {
  CardDraftSchema,
  CardIdSchema,
  CardTitleSchema,
  LaneId,
  Priority,
  StoryPoints,
  ThemeMode
} from "@folio/kanban-domain/schema"
import { Ui } from "@universal-ui/core"
import * as Schema from "effect/Schema"
import { deriveCardEditorControls } from "../../presentation/index.ts"
import {
  NoticeStateSchema,
  makeVisibleNotice,
  type NoticeState
} from "../../state/index.ts"
import { paletteFor } from "../theme.ts"
import {
  fieldLabel,
  secondaryButtonStyle,
  segmentedControl
} from "../views/controls.ts"

export const CardEditorMode = Schema.Literals(["modal", "screen"])
export type CardEditorMode = typeof CardEditorMode.Type

export const CardEditorProps = Schema.Struct({
  draft: CardDraftSchema,
  theme: ThemeMode,
  mode: CardEditorMode
})
export type CardEditorProps = typeof CardEditorProps.Type

export const CardEditorModel = Schema.Struct({
  draft: CardDraftSchema,
  notice: NoticeStateSchema
})
export type CardEditorModel = typeof CardEditorModel.Type

export const CardEditorMessage = UiSchema.TaggedEnum({
  TypedTitle: { text: Schema.String },
  TypedNotes: { text: Schema.String },
  TypedAssignee: { text: Schema.String },
  SelectedLane: { lane: LaneId },
  SelectedPriority: { priority: Priority },
  SelectedPoints: { points: StoryPoints },
  ClickedSave: {},
  ClickedCancel: {},
  ClickedDelete: {}
})
export type CardEditorMessage = typeof CardEditorMessage.Type

export const CardEditorEvents = UiSchema.TaggedEnum({
  Saved: { draft: CardDraftSchema, title: CardTitleSchema },
  Deleted: { cardId: CardIdSchema },
  Cancelled: {}
})
export type CardEditorEvents = typeof CardEditorEvents.Type

const HIDDEN_NOTICE: NoticeState = { _tag: "Hidden" }

/**
 * Self-contained @effect/ui child component for editing a Kanban card.
 * Encapsulates form draft state, field keystrokes, and title validation,
 * communicating with FolioApp solely via typed Saved / Deleted / Cancelled events.
 */
export const CardEditor = Ui.component({
  name: "CardEditor",
  props: CardEditorProps,
  model: CardEditorModel,
  message: CardEditorMessage,
  events: CardEditorEvents
}).make({
  init: ({ props }) => ({
    draft: props.draft,
    notice: HIDDEN_NOTICE
  }),

  update: ($, message) =>
    CardEditorMessage.match(message, {
      TypedTitle: ({ text }) =>
        $.set({
          ...$.model,
          draft: { ...$.model.draft, title: text }
        }),
      TypedNotes: ({ text }) =>
        $.set({
          ...$.model,
          draft: { ...$.model.draft, notes: text }
        }),
      TypedAssignee: ({ text }) =>
        $.set({
          ...$.model,
          draft: { ...$.model.draft, assignee: normalizeDraftAssignee(text) }
        }),
      SelectedLane: ({ lane }) =>
        $.set({
          ...$.model,
          draft: { ...$.model.draft, lane }
        }),
      SelectedPriority: ({ priority }) =>
        $.set({
          ...$.model,
          draft: { ...$.model.draft, priority }
        }),
      SelectedPoints: ({ points }) =>
        $.set({
          ...$.model,
          draft: { ...$.model.draft, points }
        }),
      ClickedSave: () => {
        const check = validateCardTitle($.model.draft.title)
        if (!check.ok) {
          return $.set({
            ...$.model,
            notice: makeVisibleNotice("error", check.error)
          })
        }
        return $.set({
          ...$.model,
          notice: HIDDEN_NOTICE
        }).emit(
          CardEditorEvents.Saved({
            draft: $.model.draft,
            title: check.title
          })
        )
      },
      ClickedCancel: () => $.emit(CardEditorEvents.Cancelled()),
      ClickedDelete: () =>
        $.emit(CardEditorEvents.Deleted({ cardId: $.model.draft.cardId }))
    }),

  view: (h, model) => {
    const { draft, notice } = model
    const p = paletteFor(h.props.theme)
    const isModal = h.props.mode === "modal"
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
                    .on("press", CardEditorMessage.ClickedCancel())
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
              .on("press", CardEditorMessage.ClickedCancel())
              .children(
                h.text
                  .style({ fontSize: 12, fontWeight: "600", color: p.inkSoft })
                  .children("Cancel")
              )
          ),
        // Validation / info notice inside editor
        NoticeStateSchema.guards.Visible(notice) &&
          (() => {
            const isError = notice.tone === "error"
            return h.box
              .testId("editor.notice")
              .role(isError ? "alert" : "status")
              .ariaLabel(notice.announcement)
              .style({
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 6,
                backgroundColor: isError ? p.accentSoft : p.pineSoft
              })
              .children(
                h.text
                  .style({
                    fontSize: 12,
                    fontWeight: "600",
                    color: isError ? p.accent : p.pine
                  })
                  .children(notice.message)
              )
          })(),
        // Title
        fieldLabel(h, "Title", p),
        h.input
          .testId("editor.title")
          .ariaLabel("Card title")
          .value(draft.title)
          .placeholder("Card title...")
          .placeholderColor(p.inkMuted)
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
          .on("changeText", ({ text }) => CardEditorMessage.TypedTitle({ text }))
          .on("submit", CardEditorMessage.ClickedSave())
          .on("keyDown", ({ key }) =>
            key === "Escape" ? CardEditorMessage.ClickedCancel() : undefined
          ),
        // Notes
        fieldLabel(h, "Notes", p),
        h.textarea
          .testId("editor.notes")
          .ariaLabel("Card notes")
          .value(draft.notes)
          .placeholder("Notes and acceptance criteria...")
          .placeholderColor(p.inkMuted)
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
          .on("changeText", ({ text }) => CardEditorMessage.TypedNotes({ text }))
          .on("keyDown", ({ key }) =>
            key === "Escape" ? CardEditorMessage.ClickedCancel() : undefined
          ),
        // Lane picker
        fieldLabel(h, "Lane", p),
        segmentedControl(h, controls.laneControl, p, {
          testIdPrefix: "editor.lane",
          current: draft.lane,
          stretch: !isModal,
          onSelect: (lane) => CardEditorMessage.SelectedLane({ lane })
        }),
        // Priority picker
        fieldLabel(h, "Priority", p),
        segmentedControl(h, controls.priorityControl, p, {
          testIdPrefix: "editor.priority",
          current: draft.priority,
          tone: "accent",
          stretch: !isModal,
          onSelect: (priority) => CardEditorMessage.SelectedPriority({ priority })
        }),
        // Assignee & Story points
        h.box
          .style({
            flexDirection: isModal ? "row" : "column",
            gap: 12
          })
          .children(
            h.box
              .style({
                flexDirection: "column",
                gap: 6,
                ...(isModal ? { width: 130 } : {})
              })
              .children(
                fieldLabel(h, "Assignee", p),
                h.input
                  .testId("editor.assignee")
                  .ariaLabel("Assignee initials")
                  .value(draft.assignee)
                  .placeholder("ME")
                  .placeholderColor(p.inkMuted)
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
                  .on("changeText", ({ text }) =>
                    CardEditorMessage.TypedAssignee({ text })
                  )
                  .on("submit", CardEditorMessage.ClickedSave())
                  .on("keyDown", ({ key }) =>
                    key === "Escape"
                      ? CardEditorMessage.ClickedCancel()
                      : undefined
                  )
              ),
            h.box
              .style({
                flexDirection: "column",
                gap: 6,
                ...(isModal ? { flex: 1 } : {})
              })
              .children(
                fieldLabel(h, "Story points", p),
                segmentedControl(h, controls.pointsControl, p, {
                  testIdPrefix: "editor.points",
                  current: `${draft.points}`,
                  stretch: !isModal,
                  onSelect: (value) =>
                    CardEditorMessage.SelectedPoints({
                      points: storyPointsFromLabel(value)
                    })
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
              .on("press", CardEditorMessage.ClickedDelete())
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
              .on("press", CardEditorMessage.ClickedSave())
              .children(
                h.text
                  .style({
                    fontSize: 12.5,
                    fontWeight: "700",
                    color: p.accentInk
                  })
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
})
