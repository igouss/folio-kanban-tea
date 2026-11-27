import { parseCardId, parseCardTitle } from '../rules/operations.ts'
import type { CardId, CardTitle, KanbanCard } from './types.ts'

const seedCardId = (raw: string): CardId => {
  const parsed = parseCardId(raw)
  if (parsed === undefined) throw new Error(`Invalid seed CardId: "${raw}"`)
  return parsed
}

const seedCardTitle = (raw: string): CardTitle => {
  const parsed = parseCardTitle(raw)
  if (parsed === undefined) throw new Error(`Invalid seed CardTitle: "${raw}"`)
  return parsed
}

export const DEFAULT_CARDS: ReadonlyArray<KanbanCard> = [
  {
    id: seedCardId('card-101'),
    code: 'FOL-101',
    title: seedCardTitle('Share pure TEA domain across Web, Desktop GPU & Mobile'),
    notes:
      'Keep models, WIP rules, velocity metrics, and card transitions in @folio/kanban-domain with zero platform coupling.',
    lane: 'in_progress',
    priority: 'high',
    assignee: 'AL',
    points: 5,
    tags: ['architecture', 'tea'],
    createdAt: '2026-11-26T09:10:00Z',
  },
  {
    id: seedCardId('card-102'),
    code: 'FOL-102',
    title: seedCardTitle('Deliver Web DOM via @effect/ui Queries & View Transitions'),
    notes:
      'Use Query.Tag invalidation, Validation.make forms, native <dialog>, and live MessageLog tracing in the browser.',
    lane: 'done',
    priority: 'high',
    assignee: 'MK',
    points: 3,
    tags: ['web', 'effect-ui'],
    createdAt: '2026-11-26T09:40:00Z',
  },
  {
    id: seedCardId('card-103'),
    code: 'FOL-103',
    title: seedCardTitle('Deliver Desktop GPU via @effect/ui + Zed GPUI'),
    notes:
      'Custom @effect/ui Renderer.Host driving @gpuix/native directly on Wayland/Metal with live Paper/Graphite themes.',
    lane: 'review',
    priority: 'medium',
    assignee: 'SR',
    points: 5,
    tags: ['desktop', 'gpui'],
    createdAt: '2026-11-26T10:15:00Z',
  },
  {
    id: seedCardId('card-104'),
    code: 'FOL-104',
    title: seedCardTitle('Deliver Mobile iOS/Android via @effect/ui + Fabric'),
    notes:
      'Custom @effect/ui Renderer.Host patching directly onto @ng-native/fabric with controlled TextInputs and AppState subscriptions.',
    lane: 'in_progress',
    priority: 'high',
    assignee: 'AL',
    points: 5,
    tags: ['mobile', 'fabric'],
    createdAt: '2026-11-26T11:00:00Z',
  },
  {
    id: seedCardId('card-105'),
    code: 'FOL-105',
    title: seedCardTitle('Enforce WIP limits across all delivery targets'),
    notes:
      'Highlight Active (>3) and Review (>2) columns consistently in Web, Desktop GPUI, and Mobile Fabric views.',
    lane: 'backlog',
    priority: 'medium',
    assignee: 'JD',
    points: 2,
    tags: ['kanban', 'rules'],
    createdAt: '2026-11-26T11:45:00Z',
  },
  {
    id: seedCardId('card-106'),
    code: 'FOL-106',
    title: seedCardTitle('Verify pure logic with Story, HtmlScene, and fakeFabric'),
    notes:
      'Run deterministic tests across every target without requiring a browser, GPU window, or simulator.',
    lane: 'review',
    priority: 'medium',
    assignee: 'SR',
    points: 3,
    tags: ['testing', 'ci'],
    createdAt: '2026-11-26T12:20:00Z',
  },
  {
    id: seedCardId('card-107'),
    code: 'FOL-107',
    title: seedCardTitle('Unify Paper & Graphite editorial color palettes'),
    notes:
      'Warm archival paper (#F4EFE6) + vermilion (#D43C1E) and deep graphite (#141311) shared across platforms.',
    lane: 'done',
    priority: 'low',
    assignee: 'MK',
    points: 2,
    tags: ['design', 'tokens'],
    createdAt: '2026-11-26T13:10:00Z',
  },
  {
    id: seedCardId('card-108'),
    code: 'FOL-108',
    title: seedCardTitle('Add terminal delivery target with @effect/ui-opentui'),
    notes:
      'Optional future delivery adapter consuming the exact same @folio/kanban-domain package.',
    lane: 'backlog',
    priority: 'low',
    assignee: 'JD',
    points: 3,
    tags: ['tui', 'future'],
    createdAt: '2026-11-26T14:00:00Z',
  },
]
