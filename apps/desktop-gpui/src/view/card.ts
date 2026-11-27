import { Array, Option, String, pipe } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { DragAndDrop } from '@foldkit/ui'
import type { Card, Column, Priority } from '../domain.ts'
import { Message } from '../message.ts'
import type { Model } from '../model.ts'

const priorityLabel = (priority: Priority): string =>
  priority === 'high' ? 'HIGH' : priority === 'medium' ? 'MED' : 'LOW'

export const findDraggedCard = (model: Model): Option.Option<Card> =>
  pipe(
    model.dragAndDrop,
    DragAndDrop.maybeDraggedItemId,
    Option.flatMap((cardId) =>
      pipe(
        model.columns,
        Array.flatMap(({ cards }) => cards),
        Array.findFirst(({ id }) => id === cardId),
      ),
    ),
  )

export const cardInner = (
  card: Card,
  columnId: string,
  prevColumnId: string | undefined,
  nextColumnId: string | undefined,
  interactive: boolean,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.div(
    [h.Class('card-top')],
    [
      h.div(
        [h.Class('card-id-row')],
        [
          h.span([h.Class('card-code')], [card.code]),
          h.span(
            [h.Class(`prio-pill prio-${card.priority}`)],
            [priorityLabel(card.priority)],
          ),
        ],
      ),
      interactive
        ? h.div(
            [h.Class('card-tools')],
            [
              ...(prevColumnId !== undefined
                ? [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('mini-btn'),
                        h.AriaLabel(`Move ${card.title} left`),
                        h.OnClick(
                          Message.ClickedMoveCard({
                            cardId: card.id,
                            fromColumnId: columnId,
                            toColumnId: prevColumnId,
                          }),
                        ),
                      ],
                      ['<'],
                    ),
                  ]
                : []),
              ...(nextColumnId !== undefined
                ? [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('mini-btn'),
                        h.AriaLabel(`Move ${card.title} right`),
                        h.OnClick(
                          Message.ClickedMoveCard({
                            cardId: card.id,
                            fromColumnId: columnId,
                            toColumnId: nextColumnId,
                          }),
                        ),
                      ],
                      ['>'],
                    ),
                  ]
                : []),
              h.button(
                [
                  h.Type('button'),
                  h.Class('mini-btn mini-btn-danger'),
                  h.AriaLabel(`Delete ${card.title}`),
                  h.OnClick(
                    Message.ClickedDeleteCard({
                      cardId: card.id,
                      columnId,
                    }),
                  ),
                ],
                ['x'],
              ),
            ],
          )
        : h.empty,
    ],
  ),
  interactive
    ? h.button(
        [
          h.Type('button'),
          h.Class('card-title-btn'),
          h.OnClick(Message.ClickedOpenEditor({ cardId: card.id })),
        ],
        [card.title],
      )
    : h.span([h.Class('card-title-btn')], [card.title]),
  ...(String.isNonEmpty(card.notes)
    ? [h.p([h.Class('card-notes')], [card.notes])]
    : []),
  h.div(
    [h.Class('card-footer')],
    [
      h.div(
        [h.Class('card-tags')],
        Array.map(card.tags, (tag) =>
          h.keyed('span')(tag, [h.Class('tag-chip')], [`#${tag}`]),
        ),
      ),
      h.div(
        [h.Class('card-meta')],
        [
          h.span([h.Class('pts-label')], [`${card.points}pt`]),
          h.span([h.Class('avatar')], [card.assignee]),
        ],
      ),
    ],
  ),
]

export const cardView = (
  model: Model,
  card: Card,
  columnId: string,
  columnIndex: number,
  index: number,
  h: HtmlBuilder<Message>,
): Html => {
  const isDragged = Option.exists(
    DragAndDrop.maybeDraggedItemId(model.dragAndDrop),
    (id) => id === card.id,
  )
  const isPointerDragged =
    model.dragAndDrop.dragState._tag === 'Dragging' && isDragged
  const isKeyboardDragged =
    model.dragAndDrop.dragState._tag === 'KeyboardDragging' && isDragged

  const prevColumnId =
    columnIndex > 0 ? model.columns[columnIndex - 1]?.id : undefined
  const nextColumnId =
    columnIndex < model.columns.length - 1
      ? model.columns[columnIndex + 1]?.id
      : undefined

  const stateClass = isPointerDragged
    ? 'card-dragging'
    : isKeyboardDragged
      ? 'card-kbd-dragging'
      : ''

  return h.keyed('li')(
    card.id,
    [
      h.Class(`card card-${card.priority} ${stateClass}`.trim()),
      ...DragAndDrop.draggable(
        {
          model: model.dragAndDrop,
          toParentMessage: (message) =>
            Message.GotDragAndDropMessage({ message }),
          itemId: card.id,
          containerId: columnId,
          index,
        },
        h,
      ),
    ],
    cardInner(card, columnId, prevColumnId, nextColumnId, true, h),
  )
}

const dropPlaceholder = (h: HtmlBuilder<Message>): Html =>
  h.keyed('li')(
    'drop-placeholder',
    [h.Class('drop-placeholder'), h.AriaHidden(true)],
    [],
  )

export const laneCardElements = (
  model: Model,
  column: Column,
  columnIndex: number,
  filteredCards: ReadonlyArray<Card>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const renderDefaults = () =>
    filteredCards.length === 0
      ? [h.div([h.Class('lane-empty')], ['Drop a card here or add one below'])]
      : Array.map(filteredCards, (card, index) =>
          cardView(model, card, column.id, columnIndex, index, h),
        )

  if (!DragAndDrop.isDragging(model.dragAndDrop)) {
    return renderDefaults()
  }

  return Option.match(DragAndDrop.maybeDraggedItemId(model.dragAndDrop), {
    onNone: renderDefaults,
    onSome: (draggedId) => {
      const maybeTarget = DragAndDrop.maybeDropTarget(model.dragAndDrop)
      const visible = Array.filter(filteredCards, ({ id }) => id !== draggedId)
      const elements = Array.map(visible, (card, index) =>
        cardView(model, card, column.id, columnIndex, index, h),
      )

      const isTargetColumn = Option.exists(
        maybeTarget,
        (target) => target.containerId === column.id,
      )
      if (!isTargetColumn) {
        return elements.length === 0
          ? [h.div([h.Class('lane-empty')], ['Drop card into lane'])]
          : elements
      }

      const targetIndex = Option.match(maybeTarget, {
        onNone: () => visible.length,
        onSome: (target) => Math.min(target.index, visible.length),
      })

      const isPointerDrag = model.dragAndDrop.dragState._tag === 'Dragging'
      const insertElement = isPointerDrag
        ? dropPlaceholder(h)
        : Option.match(findDraggedCard(model), {
            onNone: () => dropPlaceholder(h),
            onSome: (card) =>
              cardView(model, card, column.id, columnIndex, targetIndex, h),
          })

      return pipe(
        elements,
        Array.insertAt(targetIndex, insertElement),
        Option.getOrElse(() => [...elements, insertElement]),
      )
    },
  })
}

export const ghostElement = (model: Model, h: HtmlBuilder<Message>): Html =>
  pipe(
    DragAndDrop.ghostStyle(model.dragAndDrop),
    Option.flatMap((ghostStyle) =>
      Option.map(findDraggedCard(model), (card) => ({ ghostStyle, card })),
    ),
    Option.match({
      onNone: () => h.empty,
      onSome: ({ ghostStyle, card }) =>
        h.div(
          [h.Style(ghostStyle), h.AriaHidden(true)],
          [
            h.div(
              [h.Class('card-ghost')],
              cardInner(card, '', undefined, undefined, false, h),
            ),
          ],
        ),
    }),
  )
