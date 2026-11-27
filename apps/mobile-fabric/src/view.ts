import type { Fabric } from "@folio/effect-ui-fabric"
import {
  KanbanMobileMessage as Msg,
  type KanbanMobileMessage,
  type KanbanMobileModel
} from "./schema"
import { LANES, matchesCard, type PriorityFilter } from "./domain"
import { cardRow } from "./view/cardRow"
import { detailView } from "./view/detailView"
import { paletteFor, type Palette } from "./view/palette"

const PRIORITY_FILTERS: ReadonlyArray<{
  readonly value: PriorityFilter
  readonly label: string
}> = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Med" },
  { value: "low", label: "Low" }
]

const boardView = (
  h: Fabric.H<KanbanMobileMessage>,
  model: KanbanMobileModel,
  p: Palette
) => {
  const activeLaneMeta = LANES.find((l) => l.id === model.activeLane)!
  const laneAllCards = model.cards.filter((c) => c.lane === model.activeLane)
  const visibleCards = laneAllCards.filter((c) =>
    matchesCard(c, model.searchQuery, model.priorityFilter)
  )
  const overWip =
    activeLaneMeta.wipLimit !== null &&
    laneAllCards.length > activeLaneMeta.wipLimit

  const totalPoints = model.cards.reduce((sum, c) => sum + c.points, 0)
  const donePoints = model.cards
    .filter((c) => c.lane === "done")
    .reduce((sum, c) => sum + c.points, 0)
  const pct =
    totalPoints === 0 ? 0 : Math.round((donePoints / totalPoints) * 100)

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
                  `${model.cards.length} cards · ${donePoints}/${totalPoints}pt done (${pct}%)`
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
          LANES.map((lane) => {
            const count = model.cards.filter((c) => c.lane === lane.id).length
            const isActive = model.activeLane === lane.id
            const laneOver = lane.wipLimit !== null && count > lane.wipLimit
            return h.pressable
              .key(lane.id)
              .testID(`lane.tab.${lane.id}`)
              .accessibilityLabel(`${lane.label} lane, ${count} cards`)
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
                  .children(lane.shortLabel),
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
                  .children(
                    lane.wipLimit !== null ? `${count}/${lane.wipLimit}` : `${count}`
                  )
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
          h.view
            .style({ flexDirection: "row", gap: 6 })
            .children(
              PRIORITY_FILTERS.map((opt) => {
                const active = model.priorityFilter === opt.value
                return h.pressable
                  .key(opt.value)
                  .testID(`filter.${opt.value}`)
                  .on("press", Msg.SelectedPriorityFilter({ priority: opt.value }))
                  .style({
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 6,
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
                        color: active ? p.accentInk : p.inkSoft
                      })
                      .children(opt.label)
                  )
              })
            )
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
            .accessibilityLabel(`New card in ${activeLaneMeta.label}`)
            .value(model.quickTitle)
            .placeholder(`Quick add to ${activeLaneMeta.label}...`)
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
                `WIP limit exceeded in ${activeLaneMeta.label} (${laneAllCards.length}/${activeLaneMeta.wipLimit})`
              )
          ),
      model.statusBanner.length > 0 &&
        h.pressable
          .testID("status.banner")
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
                        .children(`No cards in ${activeLaneMeta.label}`)
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
