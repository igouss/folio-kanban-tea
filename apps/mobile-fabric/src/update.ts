import type { Return } from 'foldkit/update'
import {
  DEFAULT_CARDS,
  createCard,
  deleteCard,
  laneLabel,
  moveCard,
  updateCard,
} from './domain'
import { Message } from './message'
import type { EditDraft, Model } from './model'

type UpdateReturn = Return<Model, Message>

const mapDraft = (model: Model, fn: (draft: EditDraft) => EditDraft): Model =>
  model.screen._tag === 'Detail'
    ? { ...model, screen: { _tag: 'Detail', draft: fn(model.screen.draft) } }
    : model

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    SelectedLane: ({ lane }) => ({
      model: { ...model, activeLane: lane, statusBanner: '' },
    }),

    ChangedSearchQuery: ({ text }) => ({
      model: { ...model, searchQuery: text },
    }),

    SelectedPriorityFilter: ({ priority }) => ({
      model: { ...model, priorityFilter: priority },
    }),

    ChangedQuickTitle: ({ text }) => ({
      model: { ...model, quickTitle: text },
    }),

    SubmittedQuickCard: () => {
      const title = model.quickTitle.trim()
      if (title.length < 2) {
        return {
          model: {
            ...model,
            statusBanner: 'Enter at least 2 characters for a new card.',
          },
        }
      }
      const { card, cards } = createCard(
        model.cards,
        {
          title,
          notes: '',
          lane: model.activeLane,
          priority: 'medium',
          assignee: 'ME',
          points: 2,
          tags: ['mobile'],
        },
        {
          id: `card-m-${model.nextId}`,
          createdAt: new Date().toISOString(),
        },
      )
      return {
        model: {
          ...model,
          cards,
          quickTitle: '',
          nextId: model.nextId + 1,
          statusBanner: `Added ${card.code} to ${laneLabel(model.activeLane)}.`,
        },
      }
    },

    PressedMoveCard: ({ cardId, toLane }) => {
      const target = model.cards.find((c) => c.id === cardId)
      if (target === undefined) return { model }
      return {
        model: {
          ...model,
          cards: moveCard(model.cards, cardId, toLane),
          statusBanner: `Moved ${target.code} to ${laneLabel(toLane)}.`,
        },
      }
    },

    PressedDeleteCard: ({ cardId }) => {
      const target = model.cards.find((c) => c.id === cardId)
      if (target === undefined) return { model }
      return {
        model: {
          ...model,
          cards: deleteCard(model.cards, cardId),
          screen: { _tag: 'Board' },
          statusBanner: `Deleted ${target.code}.`,
        },
      }
    },

    PressedOpenCard: ({ cardId }) => {
      const found = model.cards.find((c) => c.id === cardId)
      if (found === undefined) return { model }
      return {
        model: {
          ...model,
          statusBanner: '',
          screen: {
            _tag: 'Detail',
            draft: {
              cardId: found.id,
              code: found.code,
              title: found.title,
              notes: found.notes,
              lane: found.lane,
              priority: found.priority,
              assignee: found.assignee,
              points: found.points,
            },
          },
        },
      }
    },

    PressedBackToBoard: () => ({
      model: { ...model, screen: { _tag: 'Board' }, statusBanner: '' },
    }),

    ChangedDraftTitle: ({ text }) => ({
      model: mapDraft(model, (d) => ({ ...d, title: text })),
    }),

    ChangedDraftNotes: ({ text }) => ({
      model: mapDraft(model, (d) => ({ ...d, notes: text })),
    }),

    SelectedDraftLane: ({ lane }) => ({
      model: mapDraft(model, (d) => ({ ...d, lane })),
    }),

    SelectedDraftPriority: ({ priority }) => ({
      model: mapDraft(model, (d) => ({ ...d, priority })),
    }),

    ChangedDraftAssignee: ({ text }) => ({
      model: mapDraft(model, (d) => ({
        ...d,
        assignee: text.toUpperCase().slice(0, 3),
      })),
    }),

    SelectedDraftPoints: ({ points }) => ({
      model: mapDraft(model, (d) => ({ ...d, points })),
    }),

    PressedSaveDraft: () => {
      if (model.screen._tag !== 'Detail') return { model }
      const { draft } = model.screen
      const title = draft.title.trim()
      if (title.length < 2) {
        return {
          model: {
            ...model,
            statusBanner: 'Title must be at least 2 characters.',
          },
        }
      }
      const cards = updateCard(model.cards, draft.cardId, {
        title,
        notes: draft.notes,
        lane: draft.lane,
        priority: draft.priority,
        assignee: draft.assignee,
        points: draft.points,
      })
      return {
        model: {
          ...model,
          cards,
          activeLane: draft.lane,
          screen: { _tag: 'Board' },
          statusBanner: `Saved ${draft.code}.`,
        },
      }
    },

    PressedToggleTheme: () => ({
      model: {
        ...model,
        theme: model.theme === 'paper' ? 'graphite' : 'paper',
      },
    }),

    PressedResetDemo: () => ({
      model: {
        ...model,
        cards: [...DEFAULT_CARDS],
        searchQuery: '',
        priorityFilter: 'all',
        quickTitle: '',
        screen: { _tag: 'Board' },
        statusBanner: 'Board reset to sample cards.',
      },
    }),

    DismissedBanner: () => ({
      model: { ...model, statusBanner: '' },
    }),

    ChangedAppState: ({ state }) => {
      if (state === 'background' && !model.isBackgrounded) {
        return {
          model: {
            ...model,
            appState: state,
            isBackgrounded: true,
            backgroundTrips: model.backgroundTrips + 1,
          },
        }
      }
      if (state === 'active' && model.isBackgrounded) {
        return {
          model: {
            ...model,
            appState: state,
            isBackgrounded: false,
          },
        }
      }
      return { model: { ...model, appState: state } }
    },
  })
