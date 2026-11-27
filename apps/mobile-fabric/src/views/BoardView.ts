import type { Fabric } from "@folio/effect-ui-fabric"
import { deriveBoardView } from "@folio/effect-ui-sdk"
import { canRedoHistory, canUndoHistory } from "@folio/kanban-core"
import { paletteFor, type FolioPalette as Palette } from "@folio/kanban-core/theme"
import {
  KanbanMobileMessage as Msg,
  type KanbanMobileMessage,
  type KanbanMobileModel
} from "../domain/schema"
import { cardRow } from "./CardRow"
import { detailView } from "./DetailView"
import { fabricSegmentedControl } from "./ui"

const boardView = (
  h: Fabric.H<KanbanMobileMessage>,
  model: KanbanMobileModel,
  p: Palette
) => {
  const board = deriveBoardView({
    idPrefix: "mobile",
    cards: model.cards,
    searchQuery: model.searchQuery,
    priorityFilter: model.priorityFilter,
    priorityLabelStyle: "short",
    activeLane: model.activeLane
  })
  const {
    activeLane,
    lanes,
    laneTabs,
    priorityControl,
    progress: velocity,
    velocity: stats
  } = board
  const activeLaneMeta = activeLane.lane
  const visibleCards = activeLane.visibleCards
  const overWip = activeLane.stats.overWip
  const canUndo = canUndoHistory(model.history)
  const canRedo = canRedoHistory(model.history)

  return h.view
    .style({ flex: 1 })
    .children(
      h.view
        .style({
          paddingHorizontal: 18,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: p.border,
          gap: 8
        })
        .children(
          h.view
            .style({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between"
            })
            .children(
              h.view
                .style({ flexDirection: "row", alignItems: "center", gap: 8 })
                .children(
                  h.view.style({
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: p.accent
                  }),
                  h.text
                    .style({ fontSize: 22, fontWeight: "700", color: p.ink })
                    .children("Folio Kanban")
                ),
              h.view
                .style({ flexDirection: "row", alignItems: "center", gap: 8 })
                .children(
                  h.view
                    .testID("lifecycle.badge")
                    .style({
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: p.pineSoft
                    })
                    .children(
                      h.text
                        .style({ fontSize: 11, fontWeight: "700", color: p.pine })
                        .children(
                          model.backgroundTrips > 0
                            ? `@effect/ui · ${model.appState} (${model.backgroundTrips})`
                            : `@effect/ui · ${model.appState}`
                        )
                    ),
                  h.pressable
                    .testID("theme.toggle")
                    .accessibilityLabel("Toggle theme")
                    .on("press", Msg.PressedToggleTheme())
                    .style({
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                      backgroundColor: p.surface,
                      borderWidth: 1,
                      borderColor: p.border
                    })
                    .children(
                      h.text
                        .style({ fontSize: 11.5, fontWeight: "700", color: p.ink })
                        .children(model.theme === "paper" ? "Dark" : "Light")
                    )
                )
            ),
          h.view
            .style({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between"
            })
            .children(
              h.text
                .testID("board.velocity")
                .style({ fontSize: 12, color: p.inkMuted })
                .children(
                  `${stats.totalCards} cards · ${stats.donePoints}/${stats.totalPoints}pt done (${velocity.text})`
                ),
              h.view
                .style({ flexDirection: "row", alignItems: "center", gap: 12 })
                .children(
                  canUndo &&
                    h.pressable
                      .testID("board.undo")
                      .accessibilityLabel("Undo last board change")
                      .on("press", Msg.PressedUndo())
                      .children(
                        h.text
                          .style({
                            fontSize: 12,
                            fontWeight: "600",
                            color: p.ink
                          })
                          .children("Undo")
                      ),
                  canRedo &&
                    h.pressable
                      .testID("board.redo")
                      .accessibilityLabel("Redo board change")
                      .on("press", Msg.PressedRedo())
                      .children(
                        h.text
                          .style({
                            fontSize: 12,
                            fontWeight: "600",
                            color: p.ink
                          })
                          .children("Redo")
                      ),
                  h.pressable
                    .testID("board.reset")
                    .on("press", Msg.PressedResetDemo())
                    .children(
                      h.text
                        .style({ fontSize: 12, fontWeight: "600", color: p.accent })
                        .children("Reset")
                    )
                )
            ),
          h.view
            .testID("board.progress")
            .accessibilityLabel(
              `${velocity.rootAttrs["aria-label"] ?? "Sprint velocity"} ${velocity.text}`
            )
            .style({
              height: 5,
              borderRadius: 999,
              backgroundColor: p.surfaceAlt,
              overflow: "hidden"
            })
            .children(
              h.view.style({
                width: `${velocity.percent}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: p.pine
              })
            )
        ),
      laneTabs !== undefined &&
        h.view
          .accessibilityLabel(laneTabs.listAttrs["aria-label"] ?? "Kanban lanes")
          .style({
            flexDirection: "row",
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 6,
            backgroundColor: p.surfaceAlt,
            borderBottomWidth: 1,
            borderBottomColor: p.border
          })
          .children(
            laneTabs.items.map((tab) => {
              const entry = lanes.find((l) => l.lane.id === tab.value)!
              const { lane, stats: lStats, wipText } = entry
              const isActive = tab.selected
              const laneOver = lStats.overWip
              return h.pressable
                .key(lane.id)
                .testID(`lane.tab.${lane.id}`)
                .accessibilityLabel(`${lane.title} lane, ${lStats.count} cards`)
                .on("press", Msg.SelectedLane({ lane: lane.id }))
                .style({
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor: isActive ? p.ink : p.surface,
                  borderWidth: 1,
                  borderColor: laneOver
                    ? p.accent
                    : isActive
                      ? p.ink
                      : p.border
                })
                .children(
                  h.text
                    .style({
                      fontSize: 12,
                      fontWeight: "700",
                      color: isActive ? p.surface : p.ink
                    })
                    .children(tab.label),
                  h.text
                    .style({
                      fontSize: 11,
                      fontWeight: "600",
                      color: laneOver
                        ? p.accent
                        : isActive
                          ? p.chip
                          : p.inkMuted
                    })
                    .children(wipText)
                )
            })
          ),
      h.view
        .style({
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
          gap: 8
        })
        .children(
          h.textInput
            .testID("board.search")
            .accessibilityLabel("Search cards")
            .value(model.searchQuery)
            .placeholder("Filter cards by title, #tag, code...")
            .autoCorrect(false)
            .autoCapitalize("none")
            .on("changeText", ({ text }) => Msg.TypedSearchQuery({ text }))
            .style({
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.surface,
              color: p.ink
            }),
          fabricSegmentedControl(h, priorityControl, p, {
            testIdPrefix: "filter",
            tone: "accent",
            paddingVertical: 6,
            borderRadius: 6,
            itemAccessibilityLabel: (label) => `${label} priority`,
            onSelect: (priority) => Msg.SelectedPriorityFilter({ priority })
          })
        ),
      h.view
        .style({
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingBottom: 10,
          gap: 8
        })
        .children(
          h.textInput
            .testID("quick.input")
            .accessibilityLabel(`New card in ${activeLaneMeta.title}`)
            .value(model.quickTitle)
            .placeholder(`Quick add to ${activeLaneMeta.title}...`)
            .autoCorrect(true)
            .autoCapitalize("sentences")
            .on("changeText", ({ text }) => Msg.TypedQuickTitle({ text }))
            .style({
              flex: 1,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.surface,
              color: p.ink
            }),
          h.pressable
            .testID("quick.submit")
            .accessibilityLabel("Add card")
            .on("press", Msg.SubmittedQuickCard())
            .style({
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 8,
              backgroundColor: p.accent,
              justifyContent: "center"
            })
            .children(
              h.text
                .style({ fontSize: 13, fontWeight: "700", color: p.accentInk })
                .children("+ Add")
            )
        ),
      overWip &&
        h.view
          .testID("lane.wipWarning")
          .style({
            marginHorizontal: 16,
            marginBottom: 8,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 6,
            backgroundColor: p.accentSoft
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: "700", color: p.accent })
              .children(
                `WIP limit exceeded in ${activeLaneMeta.title} (${activeLane.wipText})`
              )
          ),
      model.statusBanner.length > 0 &&
        h.pressable
          .testID("status.banner")
          .accessibilityLabel(model.statusAnnouncement || model.statusBanner)
          .on("press", Msg.DismissedBanner())
          .style({
            marginHorizontal: 16,
            marginBottom: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 6,
            backgroundColor: p.pineSoft,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          })
          .children(
            h.text
              .style({ fontSize: 12, fontWeight: "600", color: p.pine })
              .children(model.statusBanner),
            h.text
              .style({ fontSize: 11, fontWeight: "700", color: p.pine })
              .children("OK")
          ),
      h.scrollView
        .testID("board.scroll")
        .accessibilityLabel(activeLane.laneAttrs["aria-label"] ?? activeLaneMeta.title)
        .style({ flex: 1, paddingHorizontal: 16 })
        .children(
          h.view
            .collapsable(false)
            .style({ paddingBottom: 24 })
            .children(
              visibleCards.length === 0
                ? h.view
                    .testID("board.empty")
                    .style({
                      padding: 28,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      alignItems: "center"
                    })
                    .children(
                      h.text
                        .style({ fontSize: 14, fontWeight: "600", color: p.inkMuted })
                        .children(`No cards in ${activeLaneMeta.title}`)
                    )
                : visibleCards.map((card) => cardRow(h, card, p))
            )
        )
    )
}

export const view = (
  h: Fabric.H<KanbanMobileMessage>,
  model: KanbanMobileModel
) => {
  const p = paletteFor(model.theme)
  return h.view
    .style({
      flex: 1,
      paddingTop: 56,
      backgroundColor: p.canvas
    })
    .children(
      model.screen._tag === "Board"
        ? boardView(h, model, p)
        : detailView(h, model.screen.draft, model.statusBanner, p)
    )
}
