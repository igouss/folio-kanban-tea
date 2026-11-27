import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as Schema from 'effect/Schema'
import {
  DEFAULT_CARDS,
  STORY_POINTS,
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
  parseCardId,
  parseCardTitle,
  parseLaneId,
  parseStoryPoints,
  redoHistory,
  undoHistory,
  updateCard,
  type BoardSessionSlice,
  type CardId,
  type CardTitle,
} from '../src/index.ts'
import {
  CardIdSchema,
  CardTitleSchema,
  LaneId as LaneIdSchema,
  StoryPoints as StoryPointsSchema,
} from '../src/model/schema.ts'

const mustCardId = (raw: string): CardId => {
  const parsed = parseCardId(raw)
  assert.ok(parsed !== undefined, `Expected valid CardId: ${raw}`)
  return parsed
}

const mustCardTitle = (raw: string): CardTitle => {
  const parsed = parseCardTitle(raw)
  assert.ok(parsed !== undefined, `Expected valid CardTitle: ${raw}`)
  return parsed
}

describe('@folio/kanban-domain (pure domain hexagon)', () => {
  it('computes velocity and WIP limits consistently across platforms', () => {
    const velocity = boardVelocity(DEFAULT_CARDS)
    assert.equal(velocity.totalCards, DEFAULT_CARDS.length)
    assert.ok(velocity.totalPoints > 0)
    assert.ok(velocity.donePoints > 0)

    const active = laneStats(DEFAULT_CARDS, 'in_progress')
    assert.equal(active.overWip, false)

    // Move two more cards into in_progress to exceed WIP limit of 3
    let cards = moveCard(DEFAULT_CARDS, mustCardId('card-103'), 'in_progress')
    cards = moveCard(cards, mustCardId('card-105'), 'in_progress')
    assert.equal(laneStats(cards, 'in_progress').overWip, true)
  })

  it('creates, updates, filters, and deletes cards purely', () => {
    const { card, cards } = createCard(
      DEFAULT_CARDS,
      {
        title: mustCardTitle('  Multi-platform sync  '),
        notes: 'Works on web, desktop GPUI, and mobile Fabric',
        lane: 'backlog',
        priority: 'high',
        assignee: 'al',
        points: 5,
        tags: ['core', 'shared'],
      },
      { id: mustCardId('card-new'), createdAt: '2026-11-26T15:00:00Z' },
    )
    assert.equal(card.code, 'FOL-109')
    assert.equal(card.title, 'Multi-platform sync')
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
      id: mustCardId('c-bad'),
      tag: 'test',
      createdAt: '2026-11-26T15:00:00Z',
    })
    assert.equal(invalid.ok, false)

    // Quick create records undo snapshot
    const sessionCardId = mustCardId('c-session-1')
    const created = applyQuickCreate(session, {
      title: 'Shared board session',
      lane: 'backlog',
      id: sessionCardId,
      tag: 'core',
      createdAt: '2026-11-26T15:00:00Z',
    })
    assert.equal(created.ok, true)
    session = { cards: created.cards, history: created.history }
    assert.equal(canUndoHistory(session.history), true)
    assert.equal(cardsInLane(session.cards, 'backlog')[0]?.id, sessionCardId)

    // Move card records history and reports destination total
    const moved = applyMoveCard(session, sessionCardId, 'review')
    assert.ok(moved)
    session = { cards: moved.cards, history: moved.history }
    assert.equal(cardsInLane(session.cards, 'review')[0]?.id, sessionCardId)

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
    assert.equal(cardsInLane(session.cards, 'review')[0]?.id, sessionCardId)
    assert.equal(canRedoHistory(session.history), true)

    const redone = redoHistory(session.history, session.cards)
    assert.ok(redone)
    session = redone
    assert.equal(cardsInLane(session.cards, 'done')[0]?.title, 'Shared session saved')

    // Delete & reset
    const deleted = applyDeleteCard(session, sessionCardId)
    assert.ok(deleted)
    session = { cards: deleted.cards, history: deleted.history }
    assert.equal(session.cards.some((c) => c.id === sessionCardId), false)

    const reset = applyResetBoard(session)
    assert.equal(reset.cards.length, DEFAULT_CARDS.length)
  })

  it('refines and brands CardId, CardTitle, StoryPoints, and LaneId at schema & type boundaries', () => {
    // CardIdSchema rejects empty, whitespace, and untrimmed strings
    assert.throws(() => Schema.decodeUnknownSync(CardIdSchema)(''))
    assert.throws(() => Schema.decodeUnknownSync(CardIdSchema)('   '))
    assert.throws(() => Schema.decodeUnknownSync(CardIdSchema)(' card-1 '))
    assert.equal(Schema.decodeUnknownSync(CardIdSchema)('card-1'), 'card-1')
    assert.equal(parseCardId(''), undefined)
    assert.equal(parseCardId(' card-1 '), undefined)

    // CardTitleSchema rejects blank, 1-char, and untrimmed titles
    assert.throws(() => Schema.decodeUnknownSync(CardTitleSchema)(''))
    assert.throws(() => Schema.decodeUnknownSync(CardTitleSchema)('A'))
    assert.throws(() => Schema.decodeUnknownSync(CardTitleSchema)('  Valid  '))
    assert.equal(Schema.decodeUnknownSync(CardTitleSchema)('Valid title'), 'Valid title')

    // StoryPoints only accepts Fibonacci points
    for (const pt of STORY_POINTS) {
      assert.equal(Schema.decodeUnknownSync(StoryPointsSchema)(pt), pt)
      assert.equal(parseStoryPoints(pt), pt)
    }
    assert.throws(() => Schema.decodeUnknownSync(StoryPointsSchema)(0))
    assert.throws(() => Schema.decodeUnknownSync(StoryPointsSchema)(4))
    assert.throws(() => Schema.decodeUnknownSync(StoryPointsSchema)(-1))
    assert.equal(parseStoryPoints(4), undefined)

    // LaneId rejects unknown lanes
    assert.equal(Schema.decodeUnknownSync(LaneIdSchema)('review'), 'review')
    assert.throws(() => Schema.decodeUnknownSync(LaneIdSchema)('archived'))
    assert.equal(parseLaneId('archived'), undefined)

    // Compile-time guardrails: CardId and LaneId cannot be swapped, raw strings cannot masquerade
    const id = mustCardId('card-101')
    const lane = 'review' as const
    const _compileChecks = () => {
      // @ts-expect-error CardId and LaneId cannot be swapped
      moveCard(DEFAULT_CARDS, lane, id)
      // @ts-expect-error raw unbranded string is not assignable to CardId
      moveCard(DEFAULT_CARDS, 'card-101', lane)
      // @ts-expect-error invalid story points literal rejected
      updateCard(DEFAULT_CARDS, id, { points: 4 })
      // @ts-expect-error raw unvalidated string is not assignable to CardTitle
      updateCard(DEFAULT_CARDS, id, { title: 'unvalidated' })
    }
    assert.equal(typeof _compileChecks, 'function')
  })
})
