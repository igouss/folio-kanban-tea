import type { Html, NativeBuilder } from 'foldkit-native/view'
import { adjacentLanes, laneLabel, type Card } from '../domain'
import { Message } from '../message'
import { priorityColors, type Palette } from './palette'

export const cardRow = (
  card: Card,
  p: Palette,
  n: NativeBuilder<Message>,
): Html => {
  const prio = priorityColors(card.priority, p)
  const { prev, next } = adjacentLanes(card.lane)

  return n.view(
    [
      n.Key(card.id),
      n.TestID(`card.${card.id}`),
      n.Class('rounded-xl p-3.5 mb-3'),
      n.Style({
        backgroundColor: p.surface,
        borderWidth: 1,
        borderColor: p.border,
        borderLeftWidth: 4,
        borderLeftColor: prio.fg,
        gap: 8,
      }),
    ],
    [
      n.view(
        [
          n.Style({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }),
        ],
        [
          n.view(
            [n.Style({ flexDirection: 'row', alignItems: 'center', gap: 6 })],
            [
              n.text(
                [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                [card.code],
              ),
              n.view(
                [
                  n.Style({
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: prio.bg,
                  }),
                ],
                [
                  n.text(
                    [n.Style({ fontSize: 10, fontWeight: '700', color: prio.fg })],
                    [prio.label],
                  ),
                ],
              ),
            ],
          ),
          n.view(
            [n.Style({ flexDirection: 'row', alignItems: 'center', gap: 6 })],
            [
              n.text(
                [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                [`${card.points}pt`],
              ),
              n.view(
                [
                  n.Style({
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: p.avatarBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }),
                ],
                [
                  n.text(
                    [n.Style({ fontSize: 10, fontWeight: '700', color: p.avatarInk })],
                    [card.assignee],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      n.pressable(
        [
          n.TestID(`card.open.${card.id}`),
          n.AccessibilityLabel(`Edit ${card.title}`),
          n.OnPress(Message.PressedOpenCard({ cardId: card.id })),
        ],
        [
          n.text(
            [n.Style({ fontSize: 15, fontWeight: '700', color: p.ink })],
            [card.title],
          ),
        ],
      ),
      card.notes.length > 0
        ? n.text(
            [n.Style({ fontSize: 12.5, color: p.inkSoft })],
            [card.notes],
          )
        : null,
      n.view(
        [n.Style({ flexDirection: 'row', flexWrap: 'wrap', gap: 5 })],
        card.tags.map((tag) =>
          n.view(
            [
              n.Key(tag),
              n.Style({
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: p.chip,
              }),
            ],
            [n.text([n.Style({ fontSize: 10.5, color: p.inkSoft })], [`#${tag}`])],
          ),
        ),
      ),
      n.view(
        [
          n.Style({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: p.border,
          }),
        ],
        [
          n.view(
            [n.Style({ flexDirection: 'row', gap: 8 })],
            [
              prev !== undefined
                ? n.pressable(
                    [
                      n.TestID(`card.prev.${card.id}`),
                      n.AccessibilityLabel(`Move ${card.code} to ${laneLabel(prev)}`),
                      n.OnPress(
                        Message.PressedMoveCard({ cardId: card.id, toLane: prev }),
                      ),
                      n.Style({
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: p.surfaceAlt,
                        borderWidth: 1,
                        borderColor: p.border,
                      }),
                    ],
                    [
                      n.text(
                        [n.Style({ fontSize: 12, fontWeight: '600', color: p.ink })],
                        [`‹ ${laneLabel(prev)}`],
                      ),
                    ],
                  )
                : null,
              next !== undefined
                ? n.pressable(
                    [
                      n.TestID(`card.next.${card.id}`),
                      n.AccessibilityLabel(`Move ${card.code} to ${laneLabel(next)}`),
                      n.OnPress(
                        Message.PressedMoveCard({ cardId: card.id, toLane: next }),
                      ),
                      n.Style({
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: p.surfaceAlt,
                        borderWidth: 1,
                        borderColor: p.border,
                      }),
                    ],
                    [
                      n.text(
                        [n.Style({ fontSize: 12, fontWeight: '600', color: p.ink })],
                        [`${laneLabel(next)} ›`],
                      ),
                    ],
                  )
                : null,
            ],
          ),
          n.pressable(
            [
              n.TestID(`card.delete.${card.id}`),
              n.AccessibilityLabel(`Delete ${card.code}`),
              n.OnPress(Message.PressedDeleteCard({ cardId: card.id })),
              n.Style({
                paddingHorizontal: 9,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: p.accentSoft,
              }),
            ],
            [
              n.text(
                [n.Style({ fontSize: 11.5, fontWeight: '700', color: p.accent })],
                ['Delete'],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}
