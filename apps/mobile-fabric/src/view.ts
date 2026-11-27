import type { Html, NativeBuilder } from 'foldkit-native/view'
import { LANES, matchesCard, type PriorityFilter } from './domain'
import { Message } from './message'
import type { Model } from './model'
import { cardRow } from './view/cardRow'
import { detailView } from './view/detailView'
import { paletteFor, type Palette } from './view/palette'

const PRIORITY_FILTERS: ReadonlyArray<{
  readonly value: PriorityFilter
  readonly label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Med' },
  { value: 'low', label: 'Low' },
]

const boardView = (
  model: Model,
  p: Palette,
  n: NativeBuilder<Message>,
): Html => {
  const activeLaneMeta = LANES.find((l) => l.id === model.activeLane)!
  const laneAllCards = model.cards.filter((c) => c.lane === model.activeLane)
  const visibleCards = laneAllCards.filter((c) =>
    matchesCard(c, model.searchQuery, model.priorityFilter),
  )
  const overWip =
    activeLaneMeta.wipLimit !== null &&
    laneAllCards.length > activeLaneMeta.wipLimit

  const totalPoints = model.cards.reduce((sum, c) => sum + c.points, 0)
  const donePoints = model.cards
    .filter((c) => c.lane === 'done')
    .reduce((sum, c) => sum + c.points, 0)
  const pct = totalPoints === 0 ? 0 : Math.round((donePoints / totalPoints) * 100)

  return n.view(
    [n.Style({ flex: 1 })],
    [
      n.view(
        [
          n.Style({
            paddingHorizontal: 18,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: p.border,
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
                [n.Style({ flexDirection: 'row', alignItems: 'center', gap: 8 })],
                [
                  n.view([
                    n.Style({
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: p.accent,
                    }),
                  ]),
                  n.text(
                    [n.Style({ fontSize: 22, fontWeight: '700', color: p.ink })],
                    ['Folio Kanban'],
                  ),
                ],
              ),
              n.view(
                [n.Style({ flexDirection: 'row', alignItems: 'center', gap: 8 })],
                [
                  n.view(
                    [
                      n.TestID('lifecycle.badge'),
                      n.Style({
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: p.pineSoft,
                      }),
                    ],
                    [
                      n.text(
                        [n.Style({ fontSize: 11, fontWeight: '700', color: p.pine })],
                        [
                          model.backgroundTrips > 0
                            ? `Fabric · ${model.appState} (${model.backgroundTrips})`
                            : `Fabric · ${model.appState}`,
                        ],
                      ),
                    ],
                  ),
                  n.pressable(
                    [
                      n.TestID('theme.toggle'),
                      n.AccessibilityLabel('Toggle theme'),
                      n.OnPress(Message.PressedToggleTheme()),
                      n.Style({
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: p.surface,
                        borderWidth: 1,
                        borderColor: p.border,
                      }),
                    ],
                    [
                      n.text(
                        [n.Style({ fontSize: 11.5, fontWeight: '700', color: p.ink })],
                        [model.theme === 'paper' ? 'Dark' : 'Light'],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          n.view(
            [
              n.Style({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }),
            ],
            [
              n.text(
                [n.TestID('board.velocity'), n.Style({ fontSize: 12, color: p.inkMuted })],
                [`${model.cards.length} cards · ${donePoints}/${totalPoints}pt done (${pct}%)`],
              ),
              n.pressable(
                [
                  n.TestID('board.reset'),
                  n.OnPress(Message.PressedResetDemo()),
                ],
                [
                  n.text(
                    [n.Style({ fontSize: 12, fontWeight: '600', color: p.accent })],
                    ['Reset'],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      n.view(
        [
          n.Style({
            flexDirection: 'row',
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 6,
            backgroundColor: p.surfaceAlt,
            borderBottomWidth: 1,
            borderBottomColor: p.border,
          }),
        ],
        LANES.map((lane) => {
          const count = model.cards.filter((c) => c.lane === lane.id).length
          const isActive = model.activeLane === lane.id
          const laneOver = lane.wipLimit !== null && count > lane.wipLimit
          return n.pressable(
            [
              n.Key(lane.id),
              n.TestID(`lane.tab.${lane.id}`),
              n.AccessibilityLabel(`${lane.label} lane, ${count} cards`),
              n.OnPress(Message.SelectedLane({ lane: lane.id })),
              n.Style({
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 6,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: isActive ? p.ink : p.surface,
                borderWidth: 1,
                borderColor: laneOver ? p.accent : isActive ? p.ink : p.border,
              }),
            ],
            [
              n.text(
                [
                  n.Style({
                    fontSize: 12,
                    fontWeight: '700',
                    color: isActive ? p.surface : p.ink,
                  }),
                ],
                [lane.shortLabel],
              ),
              n.text(
                [
                  n.Style({
                    fontSize: 11,
                    fontWeight: '600',
                    color: laneOver
                      ? p.accent
                      : isActive
                        ? p.chip
                        : p.inkMuted,
                  }),
                ],
                [lane.wipLimit !== null ? `${count}/${lane.wipLimit}` : `${count}`],
              ),
            ],
          )
        }),
      ),
      n.view(
        [
          n.Style({
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
            gap: 8,
          }),
        ],
        [
          n.textInput([
            n.TestID('board.search'),
            n.AccessibilityLabel('Search cards'),
            n.Value(model.searchQuery),
            n.Placeholder('Filter cards by title, #tag, code...'),
            n.AutoCorrect(false),
            n.AutoCapitalize('none'),
            n.OnChangeText((text) => Message.ChangedSearchQuery({ text })),
            n.Style({
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.surface,
              color: p.ink,
            }),
          ]),
          n.view(
            [n.Style({ flexDirection: 'row', gap: 6 })],
            PRIORITY_FILTERS.map((opt) => {
              const active = model.priorityFilter === opt.value
              return n.pressable(
                [
                  n.Key(opt.value),
                  n.TestID(`filter.${opt.value}`),
                  n.OnPress(
                    Message.SelectedPriorityFilter({ priority: opt.value }),
                  ),
                  n.Style({
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 6,
                    alignItems: 'center',
                    backgroundColor: active ? p.accent : p.surface,
                    borderWidth: 1,
                    borderColor: active ? p.accent : p.border,
                  }),
                ],
                [
                  n.text(
                    [
                      n.Style({
                        fontSize: 12,
                        fontWeight: '700',
                        color: active ? p.accentInk : p.inkSoft,
                      }),
                    ],
                    [opt.label],
                  ),
                ],
              )
            }),
          ),
        ],
      ),
      n.view(
        [
          n.Style({
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingBottom: 10,
            gap: 8,
          }),
        ],
        [
          n.textInput([
            n.TestID('quick.input'),
            n.AccessibilityLabel(`New card in ${activeLaneMeta.label}`),
            n.Value(model.quickTitle),
            n.Placeholder(`Quick add to ${activeLaneMeta.label}...`),
            n.AutoCorrect(true),
            n.AutoCapitalize('sentences'),
            n.OnChangeText((text) => Message.ChangedQuickTitle({ text })),
            n.Style({
              flex: 1,
              fontSize: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.surface,
              color: p.ink,
            }),
          ]),
          n.pressable(
            [
              n.TestID('quick.submit'),
              n.AccessibilityLabel('Add card'),
              n.OnPress(Message.SubmittedQuickCard()),
              n.Style({
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 8,
                backgroundColor: p.accent,
                justifyContent: 'center',
              }),
            ],
            [
              n.text(
                [n.Style({ fontSize: 13, fontWeight: '700', color: p.accentInk })],
                ['+ Add'],
              ),
            ],
          ),
        ],
      ),
      overWip
        ? n.view(
            [
              n.TestID('lane.wipWarning'),
              n.Style({
                marginHorizontal: 16,
                marginBottom: 8,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 6,
                backgroundColor: p.accentSoft,
              }),
            ],
            [
              n.text(
                [n.Style({ fontSize: 12, fontWeight: '700', color: p.accent })],
                [
                  `WIP limit exceeded in ${activeLaneMeta.label} (${laneAllCards.length}/${activeLaneMeta.wipLimit})`,
                ],
              ),
            ],
          )
        : null,
      model.statusBanner.length > 0
        ? n.pressable(
            [
              n.TestID('status.banner'),
              n.OnPress(Message.DismissedBanner()),
              n.Style({
                marginHorizontal: 16,
                marginBottom: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 6,
                backgroundColor: p.pineSoft,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }),
            ],
            [
              n.text(
                [n.Style({ fontSize: 12, fontWeight: '600', color: p.pine })],
                [model.statusBanner],
              ),
              n.text(
                [n.Style({ fontSize: 11, fontWeight: '700', color: p.pine })],
                ['OK'],
              ),
            ],
          )
        : null,
      n.scrollView(
        [
          n.TestID('board.scroll'),
          n.Style({ flex: 1, paddingHorizontal: 16 }),
        ],
        visibleCards.length === 0
          ? [
              n.view(
                [
                  n.TestID('board.empty'),
                  n.Style({
                    padding: 28,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: p.border,
                    backgroundColor: p.surface,
                    alignItems: 'center',
                  }),
                ],
                [
                  n.text(
                    [n.Style({ fontSize: 14, fontWeight: '600', color: p.inkMuted })],
                    [`No cards in ${activeLaneMeta.label}`],
                  ),
                ],
              ),
            ]
          : visibleCards.map((card) => cardRow(card, p, n)),
      ),
    ],
  )
}

export const view = (model: Model, n: NativeBuilder<Message>): Html => {
  const p = paletteFor(model.theme)
  return n.view(
    [
      n.Style({
        flex: 1,
        paddingTop: 56,
        backgroundColor: p.canvas,
      }),
    ],
    [
      model.screen._tag === 'Board'
        ? boardView(model, p, n)
        : detailView(model.screen.draft, model.statusBanner, p, n),
    ],
  )
}
