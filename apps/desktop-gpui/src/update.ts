import { Array, Match, Option, String, pipe } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'
import { DragAndDrop } from '@foldkit/ui'
import {
  ApplyTheme,
  FocusAddCardInput,
  GenerateCardId,
  SaveBoard,
} from './command.ts'
import {
  DEFAULT_COLUMNS,
  appendCard,
  findCardWithColumn,
  insertCard,
  nextCardCode,
  removeCard,
  reorder,
  type Column,
} from './domain.ts'
import { Message } from './message.ts'
import type { Model } from './model.ts'

type UpdateReturn = Update.Return<Model, Message>

const findCardTitle = (
  columns: ReadonlyArray<Column>,
  cardId: string,
): string =>
  pipe(
    columns,
    Array.flatMap(({ cards }) => cards),
    Array.findFirst(({ id }) => id === cardId),
    Option.match({
      onNone: () => cardId,
      onSome: ({ title }) => title,
    }),
  )

const findColumnName = (
  columns: ReadonlyArray<Column>,
  columnId: string,
): string =>
  pipe(
    columns,
    Array.findFirst(({ id }) => id === columnId),
    Option.match({
      onNone: () => columnId,
      onSome: ({ name }) => name,
    }),
  )

const announceKeyboardDrag = (
  model: Model,
  nextDragAndDrop: DragAndDrop.Model,
): string =>
  Match.value(nextDragAndDrop.dragState).pipe(
    Match.withReturnType<string>(),
    Match.tag('KeyboardDragging', (nextState) => {
      if (model.dragAndDrop.dragState._tag === 'Idle') {
        const title = findCardTitle(model.columns, nextState.itemId)
        return `Picked up "${title}". Arrows move in lane, Tab switches lane, Space drops, Escape cancels.`
      }
      if (model.dragAndDrop.dragState._tag !== 'KeyboardDragging') {
        return model.announcement
      }
      const prevState = model.dragAndDrop.dragState
      const columnName = findColumnName(model.columns, nextState.targetContainerId)
      if (prevState.targetContainerId !== nextState.targetContainerId) {
        return `Moved to ${columnName}, slot ${nextState.targetIndex + 1}.`
      }
      if (prevState.targetIndex !== nextState.targetIndex) {
        return `Position ${nextState.targetIndex + 1} in ${columnName}.`
      }
      return model.announcement
    }),
    Match.orElse(() => model.announcement),
  )

const foldDragAndDropOutMessage =
  (previousModel: Model) =>
  (outMessage: DragAndDrop.OutMessage): Update.Step<Model, Message> =>
  (model) =>
    DragAndDrop.OutMessage.match<UpdateReturn>(outMessage, {
      Reordered: ({ itemId, fromContainerId, toContainerId, toIndex }) => {
        const nextColumns = reorder(
          model.columns,
          itemId,
          fromContainerId,
          toContainerId,
          toIndex,
        )
        const title = findCardTitle(previousModel.columns, itemId)
        const columnName = findColumnName(previousModel.columns, toContainerId)
        const msg = `Moved "${title}" → ${columnName} (#${toIndex + 1}).`
        return {
          model: modifyFields(model, {
            columns: () => nextColumns,
            announcement: () => msg,
            notice: () => msg,
          }),
          commands: [SaveBoard({ columns: nextColumns, theme: model.theme })],
        }
      },
      Cancelled: () => ({
        model: modifyFields(model, {
          announcement: () => 'Drag cancelled.',
        }),
      }),
    })

const foldDragAndDrop = (previousModel: Model) =>
  Update.foldChild({
    update: DragAndDrop.update,
    read: (model: Model) => Option.some(model.dragAndDrop),
    write: (model, nextDragAndDrop) =>
      modifyFields(model, {
        dragAndDrop: () => nextDragAndDrop,
        announcement: () => announceKeyboardDrag(model, nextDragAndDrop),
      }),
    toParentMessage: (message) => Message.GotDragAndDropMessage({ message }),
    foldOutMessage: foldDragAndDropOutMessage(previousModel),
  })

const bumpCount = (result: UpdateReturn): UpdateReturn => ({
  ...result,
  model: modifyFields(result.model, {
    dispatchCount: (n) => n + 1,
  }),
})

export const update = (model: Model, message: Message): UpdateReturn =>
  bumpCount(
    Message.match<UpdateReturn>(message, {
      GotDragAndDropMessage: ({ message: dndMessage }) =>
        foldDragAndDrop(model)(model, dndMessage),

      ChangedSearchQuery: ({ value }) => ({
        model: modifyFields(model, { searchQuery: () => value }),
      }),

      SelectedPriorityFilter: ({ priority }) => ({
        model: modifyFields(model, { priorityFilter: () => priority }),
      }),

      ClickedToggleTheme: () => {
        const nextTheme = model.theme === 'paper' ? 'graphite' as const : 'paper' as const
        return {
          model: modifyFields(model, {
            theme: () => nextTheme,
            notice: () =>
              `Switched GPUI token theme to ${nextTheme === 'paper' ? 'Paper (Light)' : 'Graphite (Dark)'}.`,
          }),
          commands: [
            ApplyTheme({ theme: nextTheme }),
            SaveBoard({ columns: model.columns, theme: nextTheme }),
          ],
        }
      },

      AppliedTheme: () => ({ model }),

      ClickedAddCard: ({ columnId }) => ({
        model: modifyFields(model, {
          maybeNewCardColumnId: () => Option.some(columnId),
          newCardTitle: () => '',
        }),
        commands: [FocusAddCardInput()],
      }),

      ChangedNewCardTitle: ({ value }) => ({
        model: modifyFields(model, { newCardTitle: () => value }),
      }),

      SubmittedNewCard: () =>
        Option.match(model.maybeNewCardColumnId, {
          onNone: () => ({ model }),
          onSome: (columnId) => {
            const title = String.trim(model.newCardTitle)
            if (title.length < 2) {
              return {
                model: modifyFields(model, {
                  notice: () => 'Card title must be at least 2 characters.',
                }),
              }
            }
            return {
              model,
              commands: [GenerateCardId({ columnId, title })],
            }
          },
        }),

      CompletedGenerateCardId: ({ cardId, columnId, title }) => {
        const code = nextCardCode(model.columns)
        const nextColumns = Array.map(model.columns, (column) =>
          column.id !== columnId
            ? column
            : appendCard(column, {
                id: cardId,
                code,
                title,
                notes: '',
                priority: 'medium',
                assignee: 'ME',
                points: 2,
                tags: ['native'],
                sortKey: '',
              }),
        )
        const laneName = findColumnName(model.columns, columnId)
        return {
          model: modifyFields(model, {
            columns: () => nextColumns,
            maybeNewCardColumnId: () => Option.none(),
            newCardTitle: () => '',
            notice: () => `Added ${code} "${title}" to ${laneName}.`,
          }),
          commands: [SaveBoard({ columns: nextColumns, theme: model.theme })],
        }
      },

      CancelledNewCard: () => ({
        model: modifyFields(model, {
          maybeNewCardColumnId: () => Option.none(),
          newCardTitle: () => '',
        }),
      }),

      ClickedMoveCard: ({ cardId, fromColumnId, toColumnId }) => {
        const nextColumns = reorder(
          model.columns,
          cardId,
          fromColumnId,
          toColumnId,
          0,
        )
        const title = findCardTitle(model.columns, cardId)
        const laneName = findColumnName(model.columns, toColumnId)
        return {
          model: modifyFields(model, {
            columns: () => nextColumns,
            notice: () => `Moved "${title}" → ${laneName}.`,
          }),
          commands: [SaveBoard({ columns: nextColumns, theme: model.theme })],
        }
      },

      ClickedDeleteCard: ({ cardId, columnId }) => {
        const title = findCardTitle(model.columns, cardId)
        const nextColumns = Array.map(model.columns, (column) =>
          column.id === columnId ? removeCard(column, cardId).column : column,
        )
        return {
          model: modifyFields(model, {
            columns: () => nextColumns,
            maybeEditDraft: () => Option.none(),
            notice: () => `Deleted "${title}".`,
          }),
          commands: [SaveBoard({ columns: nextColumns, theme: model.theme })],
        }
      },

      ClickedOpenEditor: ({ cardId }) =>
        Option.match(findCardWithColumn(model.columns, cardId), {
          onNone: () => ({ model }),
          onSome: ({ column, card }) => ({
            model: modifyFields(model, {
              maybeEditDraft: () =>
                Option.some({
                  cardId: card.id,
                  columnId: column.id,
                  code: card.code,
                  title: card.title,
                  notes: card.notes,
                  priority: card.priority,
                  assignee: card.assignee,
                  points: card.points,
                }),
            }),
          }),
        }),

      ChangedEditTitle: ({ value }) => ({
        model: modifyFields(model, {
          maybeEditDraft: Option.map((d) => ({ ...d, title: value })),
        }),
      }),

      ChangedEditNotes: ({ value }) => ({
        model: modifyFields(model, {
          maybeEditDraft: Option.map((d) => ({ ...d, notes: value })),
        }),
      }),

      ChangedEditPriority: ({ priority }) => ({
        model: modifyFields(model, {
          maybeEditDraft: Option.map((d) => ({ ...d, priority })),
        }),
      }),

      ChangedEditColumn: ({ columnId }) => ({
        model: modifyFields(model, {
          maybeEditDraft: Option.map((d) => ({ ...d, columnId })),
        }),
      }),

      ChangedEditAssignee: ({ value }) => ({
        model: modifyFields(model, {
          maybeEditDraft: Option.map((d) => ({
            ...d,
            assignee: value.toUpperCase().slice(0, 3),
          })),
        }),
      }),

      ChangedEditPoints: ({ points }) => ({
        model: modifyFields(model, {
          maybeEditDraft: Option.map((d) => ({ ...d, points })),
        }),
      }),

      SubmittedEditCard: () =>
        Option.match(model.maybeEditDraft, {
          onNone: () => ({ model }),
          onSome: (draft) => {
            const trimmedTitle = String.trim(draft.title)
            if (trimmedTitle.length < 2) {
              return {
                model: modifyFields(model, {
                  notice: () => 'Card title must be at least 2 characters.',
                }),
              }
            }
            const existing = findCardWithColumn(model.columns, draft.cardId)
            if (Option.isNone(existing)) {
              return {
                model: modifyFields(model, {
                  maybeEditDraft: () => Option.none(),
                }),
              }
            }
            const { column: originalCol, card: originalCard } = existing.value
            const updatedCard = {
              ...originalCard,
              title: trimmedTitle,
              notes: String.trim(draft.notes),
              priority: draft.priority,
              assignee: draft.assignee.trim() || 'ME',
              points: draft.points,
            }

            const nextColumns =
              originalCol.id === draft.columnId
                ? Array.map(model.columns, (col) =>
                    col.id !== originalCol.id
                      ? col
                      : modifyFields(col, {
                          cards: () =>
                            Array.map(col.cards, (c) =>
                              c.id === draft.cardId ? updatedCard : c,
                            ),
                        }),
                  )
                : Array.map(model.columns, (col) => {
                    if (col.id === originalCol.id) {
                      return removeCard(col, draft.cardId).column
                    }
                    if (col.id === draft.columnId) {
                      return insertCard(col, updatedCard, 0)
                    }
                    return col
                  })

            return {
              model: modifyFields(model, {
                columns: () => nextColumns,
                maybeEditDraft: () => Option.none(),
                notice: () => `Saved ${updatedCard.code}.`,
              }),
              commands: [SaveBoard({ columns: nextColumns, theme: model.theme })],
            }
          },
        }),

      CancelledEditCard: () => ({
        model: modifyFields(model, { maybeEditDraft: () => Option.none() }),
      }),

      ClickedResetDemo: () => ({
        model: modifyFields(model, {
          columns: () => DEFAULT_COLUMNS,
          searchQuery: () => '',
          priorityFilter: () => 'all' as const,
          maybeNewCardColumnId: () => Option.none(),
          maybeEditDraft: () => Option.none(),
          notice: () => 'Reset Kanban board to default cards.',
        }),
        commands: [SaveBoard({ columns: DEFAULT_COLUMNS, theme: model.theme })],
      }),

      DismissedNotice: () => ({
        model: modifyFields(model, { notice: () => '' }),
      }),

      CompletedSaveBoard: () => ({ model }),
      CompletedFocusAddCardInput: () => ({ model }),
    }),
  )
