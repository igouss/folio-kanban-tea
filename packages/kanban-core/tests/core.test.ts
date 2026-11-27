import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_CARDS,
  adjacentLanes,
  applyDeleteCard,
  applyMoveCard,
  applyQuickCreate,
  applyResetBoard,
  applySaveDraft,
  boardVelocity,
  canRedoHistory,
  canUndoHistory,
  cardToDraft,
  cardsInLane,
  createCard,
  deleteCard,
  emptyHistory,
  filterCards,
  isCardDirty,
  laneStats,
  moveCard,
  redoHistory,
  undoHistory,
  updateCard,
  type BoardSessionSlice,
} from '../src/index.ts'

describe('@folio/kanban-core (shared pure domain)', () => {
  it('computes velocity and WIP limits consistently across platforms', () => {
    const velocity = boardVelocity(DEFAULT_CARDS)
    assert.equal(velocity.totalCards, DEFAULT_CARDS.length)
    assert.ok(velocity.totalPoints > 0)
    assert.ok(velocity.donePoints > 0)

    const active = laneStats(DEFAULT_CARDS, 'in_progress')
    assert.equal(active.overWip, false)

    // Move two more cards into in_progress to exceed WIP limit of 3
    let cards = moveCard(DEFAULT_CARDS, 'card-103', 'in_progress')
    cards = moveCard(cards, 'card-105', 'in_progress')
    assert.equal(laneStats(cards, 'in_progress').overWip, true)
  })

  it('creates, updates, filters, and deletes cards purely', () => {
    const { card, cards } = createCard(
      DEFAULT_CARDS,
      {
        title: '  Multi-platform sync  ',
        notes: 'Works on web, desktop GPUI, and mobile Fabric',
        lane: 'backlog',
        priority: 'high',
        assignee: 'al',
        points: 5,
        tags: ['core', 'shared'],
      },
      { id: 'card-new', createdAt: '2026-11-26T15:00:00Z' },
    )
    assert.equal(card.code, 'FOL-109')
    assert.equal(card.assignee, 'AL')
    assert.equal(filterCards(cards, 'fabric', 'high').length, 2)

    const updated = updateCard(cards, card.id, { lane: 'done', points: 8 })
    assert.equal(updated.find((c) => c.id === card.id)?.lane, 'done')
    assert.equal(updated.find((c) => c.id === card.id)?.points, 8)

    const removed = deleteCard(updated, card.id)
    assert.equal(removed.some((c) => c.id === card.id), false)
  })

  it('computes adjacent lanes accurately', () => {
    assert.deepEqual(adjacentLanes('backlog'), { prev: undefined, next: 'in_progress' })
    assert.deepEqual(adjacentLanes('in_progress'), { prev: 'backlog', next: 'review' })
    assert.deepEqual(adjacentLanes('done'), { prev: 'review', next: undefined })
  })

  it('drives pure board session mutations and immutable undo/redo history', () => {
    let session: BoardSessionSlice = { cards: [...DEFAULT_CARDS], history: emptyHistory() }
    assert.equal(canUndoHistory(session.history), false)
    assert.equal(canRedoHistory(session.history), false)

    // Quick create rejects short titles
    const invalid = applyQuickCreate(session, {
      title: 'A',
      lane: 'backlog',
      id: 'c-bad',
      tag: 'test',
    })
    assert.equal(invalid.ok, false)

    // Quick create records undo snapshot
    const created = applyQuickCreate(session, {
      title: 'Shared board session',
      lane: 'backlog',
      id: 'c-session-1',
      tag: 'core',
    })
    assert.equal(created.ok, true)
    session = { cards: created.cards, history: created.history }
    assert.equal(canUndoHistory(session.history), true)
    assert.equal(cardsInLane(session.cards, 'backlog')[0]?.id, 'c-session-1')

    // Move card records history and reports destination total
    const moved = applyMoveCard(session, 'c-session-1', 'review')
    assert.ok(moved)
    session = { cards: moved.cards, history: moved.history }
    assert.equal(cardsInLane(session.cards, 'review')[0]?.id, 'c-session-1')

    // Edit draft & save across lanes
    const draft = cardToDraft(moved.card)
    assert.equal(isCardDirty(draft, moved.card), false)
    const editedDraft = { ...draft, title: 'Shared session saved', lane: 'done' as const }
    assert.equal(isCardDirty(editedDraft, moved.card), true)
    const saved = applySaveDraft(session, editedDraft)
    assert.equal(saved.ok, true)
    session = { cards: saved.cards, history: saved.history }
    assert.equal(cardsInLane(session.cards, 'done')[0]?.title, 'Shared session saved')

    // Undo and redo purely
    const undone = undoHistory(session.history, session.cards)
    assert.ok(undone)
    session = undone
    assert.equal(cardsInLane(session.cards, 'review')[0]?.id, 'c-session-1')
    assert.equal(canRedoHistory(session.history), true)

    const redone = redoHistory(session.history, session.cards)
    assert.ok(redone)
    session = redone
    assert.equal(cardsInLane(session.cards, 'done')[0]?.title, 'Shared session saved')

    // Delete & reset
    const deleted = applyDeleteCard(session, 'c-session-1')
    assert.ok(deleted)
    session = { cards: deleted.cards, history: deleted.history }
    assert.equal(session.cards.some((c) => c.id === 'c-session-1'), false)

    const reset = applyResetBoard(session)
    assert.equal(reset.cards.length, DEFAULT_CARDS.length)
  })
})
