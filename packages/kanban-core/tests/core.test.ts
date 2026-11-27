import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_CARDS,
  adjacentLanes,
  boardVelocity,
  createCard,
  deleteCard,
  filterCards,
  laneStats,
  moveCard,
  updateCard,
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
})
