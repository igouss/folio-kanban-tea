import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Option } from 'effect'
import { DragAndDrop } from '@foldkit/ui'
import { sheetFromCss } from 'foldkit-gpuix'
import { DEFAULT_COLUMNS, matchesFilter } from '../src/domain.ts'
import { Message } from '../src/message.ts'
import type { Model } from '../src/model.ts'
import { kanbanCss } from '../src/theme.ts'
import { update } from '../src/update.ts'

const initialModel = (): Model => ({
  columns: DEFAULT_COLUMNS,
  dragAndDrop: DragAndDrop.init({ id: 'folio-kanban' }),
  theme: 'paper',
  searchQuery: '',
  priorityFilter: 'all',
  maybeNewCardColumnId: Option.none(),
  newCardTitle: '',
  maybeEditDraft: Option.none(),
  notice: '',
  announcement: '',
  dispatchCount: 0,
})

describe('Folio Kanban Native (foldkit-gpuix / GPUI)', () => {
  it('kanbanCss has zero unsupported CSS rules for foldkit-gpuix', () => {
    const sheet = sheetFromCss(kanbanCss)
    assert.deepEqual(sheet.unsupported, [])
  })

  it('moves a card across lanes and increments TEA dispatch counter', () => {
    const m0 = initialModel()
    const step = update(
      m0,
      Message.ClickedMoveCard({
        cardId: 'card-101',
        fromColumnId: 'in_progress',
        toColumnId: 'review',
      }),
    )
    const inProgress = step.model.columns.find((c) => c.id === 'in_progress')!
    const review = step.model.columns.find((c) => c.id === 'review')!

    assert.equal(
      inProgress.cards.some((c) => c.id === 'card-101'),
      false,
    )
    assert.equal(review.cards[0]?.id, 'card-101')
    assert.equal(step.model.dispatchCount, 1)
    assert.ok(step.commands && step.commands.length === 1)
  })

  it('toggles Paper / Graphite token theme and emits ApplyTheme + SaveBoard commands', () => {
    const m0 = initialModel()
    const step = update(m0, Message.ClickedToggleTheme())
    assert.equal(step.model.theme, 'graphite')
    assert.equal(step.commands?.length, 2)
  })

  it('adds a card to Backlog via CompletedGenerateCardId and filters by priority/query', () => {
    const m0 = initialModel()
    const step = update(
      m0,
      Message.CompletedGenerateCardId({
        cardId: 'card-new',
        columnId: 'backlog',
        title: 'Ship GPUI window',
      }),
    )
    const backlog = step.model.columns.find((c) => c.id === 'backlog')!
    const created = backlog.cards.find((c) => c.id === 'card-new')
    assert.ok(created)
    assert.equal(created.code, 'FOL-109')
    assert.equal(matchesFilter(created, 'gpui', 'medium'), true)
    assert.equal(matchesFilter(created, 'gpui', 'high'), false)
  })

  it('opens editor modal, saves updated title/lane, and closes modal', () => {
    const m0 = initialModel()
    const opened = update(
      m0,
      Message.ClickedOpenEditor({ cardId: 'card-104' }),
    )
    assert.ok(Option.isSome(opened.model.maybeEditDraft))

    const edited = update(
      opened.model,
      Message.ChangedEditTitle({ value: 'Refined GPUI keyboard move' }),
    )
    const moved = update(
      edited.model,
      Message.ChangedEditColumn({ columnId: 'done' }),
    )
    const saved = update(moved.model, Message.SubmittedEditCard())

    assert.ok(Option.isNone(saved.model.maybeEditDraft))
    const done = saved.model.columns.find((c) => c.id === 'done')!
    assert.equal(done.cards[0]?.title, 'Refined GPUI keyboard move')
  })
})
