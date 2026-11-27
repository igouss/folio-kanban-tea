import { adjacentLanes, laneMeta, type KanbanCard } from "@folio/kanban-domain"
import { highlightText } from "@universal-ui/behaviors"
import type { Ui } from "@universal-ui/core"
import {
  priorityColors,
  type FolioPalette as Palette
} from "../theme.ts"
import { FolioAppMessage as Msg, type FolioAppMessage } from "../FolioApp.ts"

export interface CardItemOptions {
  readonly compact: boolean
  readonly searchQuery: string
  readonly isTabsLayout: boolean
}

export const cardItem = (
  h: Ui.H<FolioAppMessage>,
  card: KanbanCard,
  p: Palette,
  options: CardItemOptions
) => {
  const badge = priorityColors(card.priority, p)
  const { prev: prevId, next: nextId } = adjacentLanes(card.lane)
  const prevLane = prevId !== undefined ? laneMeta(prevId) : undefined
  const nextLane = nextId !== undefined ? laneMeta(nextId) : undefined
  const titleSegments = highlightText(card.title, options.searchQuery)

  return h.box
    .key(card.id)
    .testId(`card.${card.id}`)
    .role("listitem")
    .ariaLabel(`${card.code} ${card.title}`)
    .style({
      flexDirection: "column",
      gap: options.compact ? 6 : 8,
      padding: options.compact ? 10 : 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: p.rule,
      backgroundColor: p.card
    })
    .hover({
      backgroundColor: p.cardHover,
      borderColor: p.ruleStrong
    })
    .children(
      // Header: priority pill + code + story points
      h.box
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6
        })
        .children(
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            })
            .children(
              h.box
                .style({
                  paddingVertical: 2,
                  paddingHorizontal: 6,
                  borderRadius: 4,
                  backgroundColor: badge.bg
                })
                .children(
                  h.text
                    .style({
                      fontSize: 10,
                      fontWeight: "700",
                      color: badge.fg
                    })
                    .children(badge.label)
                ),
              h.text
                .style({
                  fontSize: 11,
                  fontWeight: "600",
                  color: p.inkMuted
                })
                .children(card.code)
            ),
          h.text
            .style({
              fontSize: 11,
              fontWeight: "600",
              color: p.inkSoft
            })
            .children(`${card.points}pt`)
        ),
      // Clickable Title (opens editor modal or detail screen)
      h.button
        .testId(`card.open.${card.id}`)
        .ariaLabel(`Open ${card.code} ${card.title}`)
        .style({
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          width: "100%"
        })
        .on("press", Msg.ClickedOpenEditor({ cardId: card.id }))
        .children(
          titleSegments.length === 1
            ? h.text
                .style({
                  fontSize: options.isTabsLayout ? 15 : 13.5,
                  fontWeight: "700",
                  color: p.ink
                })
                .children(card.title)
            : options.isTabsLayout
              ? h.text
                  .style({
                    fontSize: 15,
                    fontWeight: "700",
                    color: p.ink
                  })
                  .children(
                    titleSegments.map((seg, idx) =>
                      h.text
                        .key(`${card.id}-seg-${idx}`)
                        .style({
                          fontSize: 15,
                          fontWeight: "700",
                          color: seg.match ? p.accent : p.ink,
                          ...(seg.match ? { backgroundColor: p.accentSoft } : {})
                        })
                        .children(seg.text)
                    )
                  )
              : titleSegments.map((seg, idx) =>
                  h.text
                    .key(`${card.id}-seg-${idx}`)
                    .style({
                      fontSize: 13.5,
                      fontWeight: "700",
                      color: seg.match ? p.accent : p.ink,
                      ...(seg.match ? { backgroundColor: p.accentSoft } : {})
                    })
                    .children(seg.text)
                )
        ),
      // Notes preview (omitted in compact mode)
      !options.compact &&
        card.notes.length > 0 &&
        h.text
          .numberOfLines(2)
          .style({
            fontSize: 12,
            color: p.inkSoft
          })
          .children(card.notes),
      // Tags row
      !options.compact &&
        card.tags.length > 0 &&
        h.box
          .style({
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4
          })
          .children(
            card.tags.map((tag) =>
              h.box
                .key(tag)
                .style({
                  paddingVertical: 2,
                  paddingHorizontal: 6,
                  borderRadius: 4,
                  backgroundColor: p.chip
                })
                .children(
                  h.text
                    .style({
                      fontSize: 10.5,
                      fontWeight: "500",
                      color: p.inkSoft
                    })
                    .children(`#${tag}`)
                )
            )
          ),
      // Footer: assignee pill + move left / move right controls
      h.box
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 6,
          borderTopWidth: 1,
          borderColor: p.rule
        })
        .children(
          h.box
            .style({
              width: 24,
              height: 24,
              borderRadius: 999,
              backgroundColor: p.avatarBg,
              alignItems: "center",
              justifyContent: "center"
            })
            .children(
              h.text
                .style({
                  fontSize: 10,
                  fontWeight: "700",
                  color: p.avatarInk
                })
                .children(card.assignee)
            ),
          h.box
            .style({
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            })
            .children(
              prevLane !== undefined &&
                h.button
                  .testId(`card.prev.${card.id}`)
                  .ariaLabel(`Move ${card.code} to ${prevLane.title}`)
                  .style({
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: p.rule,
                    backgroundColor: p.surface
                  })
                  .hover({
                    backgroundColor: p.lane,
                    borderColor: p.ruleStrong
                  })
                  .on(
                    "press",
                    Msg.ClickedMoveCard({ cardId: card.id, toLane: prevLane.id })
                  )
                  .children(
                    h.text
                      .style({
                        fontSize: 11.5,
                        fontWeight: "700",
                        color: p.inkSoft
                      })
                      .children(options.isTabsLayout ? `← ${prevLane.shortTitle}` : "<")
                  ),
              nextLane !== undefined &&
                h.button
                  .testId(`card.next.${card.id}`)
                  .ariaLabel(`Move ${card.code} to ${nextLane.title}`)
                  .style({
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: p.rule,
                    backgroundColor: p.surface
                  })
                  .hover({
                    backgroundColor: p.lane,
                    borderColor: p.ruleStrong
                  })
                  .on(
                    "press",
                    Msg.ClickedMoveCard({ cardId: card.id, toLane: nextLane.id })
                  )
                  .children(
                    h.text
                      .style({
                        fontSize: 11.5,
                        fontWeight: "700",
                        color: p.inkSoft
                      })
                      .children(options.isTabsLayout ? `${nextLane.shortTitle} →` : ">")
                  )
            )
        )
    )
}
