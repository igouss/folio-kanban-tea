import { Array, Equal, Option, String, flow } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { Button, DragAndDrop, Input } from '@foldkit/ui'
import {
  ADD_CARD_INPUT_ID,
  SEARCH_INPUT_ID,
  matchesFilter,
  type Column,
  type PriorityFilter,
} from './domain.ts'
import { Message } from './message.ts'
import type { Model } from './model.ts'
import { ghostElement, laneCardElements } from './view/card.ts'
import { editorModal } from './view/editorModal.ts'

const PRIORITY_FILTERS: ReadonlyArray<{
  readonly value: PriorityFilter
  readonly label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const addCardSection = (
  model: Model,
  column: Column,
  h: HtmlBuilder<Message>,
): Html => {
  const isAdding = Option.exists(
    model.maybeNewCardColumnId,
    (id) => id === column.id,
  )

  if (!isAdding) {
    return Button.view(
      {
        onClick: Message.ClickedAddCard({ columnId: column.id }),
        toView: (attributes) =>
          h.button(
            [...attributes.button, h.Class('add-trigger')],
            ['+ Add card'],
          ),
      },
      h,
    )
  }

  return h.form(
    [h.Class('add-form'), h.OnSubmit(Message.SubmittedNewCard())],
    [
      Input.view(
        {
          id: ADD_CARD_INPUT_ID,
          onInput: (value) => Message.ChangedNewCardTitle({ value }),
          value: model.newCardTitle,
          placeholder: `New card in ${column.name}...`,
          toView: (attributes) =>
            h.input([
              ...attributes.input,
              h.Class('add-input'),
              h.OnKeyDownPreventDefault(
                flow(
                  Option.liftPredicate(Equal.equals('Escape')),
                  Option.map(() => Message.CancelledNewCard()),
                ),
              ),
            ]),
        },
        h,
      ),
      h.div(
        [h.Class('add-actions')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('btn'),
              h.OnClick(Message.CancelledNewCard()),
            ],
            ['Cancel'],
          ),
          h.button(
            [h.Type('submit'), h.Class('btn btn-primary')],
            ['Add'],
          ),
        ],
      ),
    ],
  )
}

const laneView = (
  model: Model,
  column: Column,
  columnIndex: number,
  h: HtmlBuilder<Message>,
): Html => {
  const filteredCards = Array.filter(column.cards, (card) =>
    matchesFilter(card, model.searchQuery, model.priorityFilter),
  )
  const lanePoints = filteredCards.reduce((sum, c) => sum + c.points, 0)
  const overWip =
    column.wipLimit !== null && column.cards.length > column.wipLimit
  const maybeDropTarget = DragAndDrop.maybeDropTarget(model.dragAndDrop)
  const isDropTarget =
    DragAndDrop.isDragging(model.dragAndDrop) &&
    Option.exists(maybeDropTarget, (t) => t.containerId === column.id)

  const laneClass = [
    'lane',
    isDropTarget ? 'lane-drop-target' : '',
    overWip ? 'lane-over-wip' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return h.keyed('div')(
    column.id,
    [h.Role('region'), h.AriaLabel(column.name), h.Class(laneClass)],
    [
      h.div(
        [h.Class('lane-header')],
        [
          h.div(
            [h.Class('lane-title-row')],
            [
              h.div(
                [h.Class('lane-title-left')],
                [
                  h.span([h.Class('lane-code')], [column.code]),
                  h.h2([h.Class('lane-title')], [column.name]),
                ],
              ),
              h.span(
                [
                  h.Class(
                    overWip ? 'lane-count lane-count-over' : 'lane-count',
                  ),
                ],
                [
                  column.wipLimit !== null
                    ? `${filteredCards.length}/${column.wipLimit}`
                    : `${filteredCards.length}`,
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('lane-meta')],
            [
              h.span([h.Class('lane-pts')], [`${lanePoints} pt`]),
              overWip
                ? h.span([h.Class('wip-alert')], ['WIP LIMIT EXCEEDED'])
                : h.empty,
            ],
          ),
        ],
      ),
      h.ul(
        [
          h.Class('lane-list'),
          ...DragAndDrop.droppable(column.id, column.name),
        ],
        laneCardElements(model, column, columnIndex, filteredCards, h),
      ),
      h.div(
        [h.Class('lane-footer')],
        [addCardSection(model, column, h)],
      ),
    ],
  )
}

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const allCards = model.columns.flatMap((col) => col.cards)
  const totalPoints = allCards.reduce((sum, card) => sum + card.points, 0)
  const donePoints =
    model.columns
      .find((col) => col.id === 'done')
      ?.cards.reduce((sum, card) => sum + card.points, 0) ?? 0
  const pct = totalPoints === 0 ? 0 : Math.round((donePoints / totalPoints) * 100)

  return {
    title: 'Folio Kanban · GPUI Native',
    body: h.div(
      [h.Class('app')],
      [
        h.div(
          [h.Class('topbar')],
          [
            h.div(
              [h.Class('topbar-left')],
              [
                h.div([h.Class('brand-dot')], []),
                h.h1([h.Class('brand-title')], ['Folio Kanban']),
                h.span([h.Class('brand-badge')], ['foldkit-native']),
                h.span([h.Class('gpu-badge')], ['GPUI · Native GPU']),
              ],
            ),
            h.div(
              [h.Class('topbar-right')],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn'),
                    h.OnClick(Message.ClickedToggleTheme()),
                  ],
                  [
                    model.theme === 'paper'
                      ? 'Theme: Paper -> Graphite'
                      : 'Theme: Graphite -> Paper',
                  ],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn'),
                    h.OnClick(Message.ClickedResetDemo()),
                  ],
                  ['Reset demo'],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn btn-primary'),
                    h.OnClick(Message.ClickedAddCard({ columnId: 'backlog' })),
                  ],
                  ['+ New card'],
                ),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('subbar')],
          [
            h.div(
              [h.Class('filter-row')],
              [
                h.input([
                  h.Id(SEARCH_INPUT_ID),
                  h.Class('search-input'),
                  h.Placeholder('Filter by code, title, #tag, assignee...'),
                  h.Value(model.searchQuery),
                  h.OnInput((value) => Message.ChangedSearchQuery({ value })),
                ]),
                h.div(
                  [h.Class('segmented')],
                  Array.map(PRIORITY_FILTERS, (opt) =>
                    h.keyed('button')(
                      opt.value,
                      [
                        h.Type('button'),
                        h.Class(
                          model.priorityFilter === opt.value
                            ? 'seg-btn is-active'
                            : 'seg-btn',
                        ),
                        h.OnClick(
                          Message.SelectedPriorityFilter({
                            priority: opt.value,
                          }),
                        ),
                      ],
                      [opt.label],
                    ),
                  ),
                ),
              ],
            ),
            h.div(
              [h.Class('stats-row')],
              [
                h.div(
                  [h.Class('stat-pill')],
                  [
                    h.span([h.Class('stat-label')], ['Cards']),
                    h.span([h.Class('stat-val')], [`${allCards.length}`]),
                  ],
                ),
                h.div(
                  [h.Class('stat-pill')],
                  [
                    h.span([h.Class('stat-label')], ['Done']),
                    h.span(
                      [h.Class('stat-val')],
                      [`${donePoints}/${totalPoints}pt`],
                    ),
                  ],
                ),
                h.div(
                  [h.Class('progress-wrap')],
                  [
                    h.div(
                      [h.Class('progress-track')],
                      [
                        h.div(
                          [
                            h.Class('progress-fill'),
                            h.Style({ width: `${pct}%` }),
                          ],
                          [],
                        ),
                      ],
                    ),
                    h.span([h.Class('stat-val')], [`${pct}%`]),
                  ],
                ),
              ],
            ),
          ],
        ),
        String.isNonEmpty(model.notice)
          ? h.div(
              [h.Class('notice-bar')],
              [
                h.span([], [model.notice]),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('notice-dismiss'),
                    h.OnClick(Message.DismissedNotice()),
                  ],
                  ['Dismiss'],
                ),
              ],
            )
          : h.empty,
        h.div(
          [h.Class('board')],
          Array.map(model.columns, (column, columnIndex) =>
            laneView(model, column, columnIndex, h),
          ),
        ),
        h.div(
          [h.Class('statusbar')],
          [
            h.span(
              [],
              [
                'Drag cards with pointer or keyboard (Space to lift, Arrows/Tab to move) · Click any title to edit',
              ],
            ),
            h.span(
              [h.Class('status-strong')],
              [`TEA dispatches: ${model.dispatchCount}`],
            ),
          ],
        ),
        ghostElement(model, h),
        Option.match(model.maybeEditDraft, {
          onNone: () => h.empty,
          onSome: (draft) => editorModal(model, draft, h),
        }),
      ],
    ),
  }
}
