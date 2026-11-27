import {
  DEFAULT_CARDS,
  nextCardCode,
  normalizeAssignee,
  type KanbanCard
} from "@folio/kanban-core"
import {
  type ColumnId,
  type NewTaskInput,
  Task,
  TaskNotFound,
  TaskSaveError
} from "#domain/Task"
import { Context, Effect, Layer, Schema } from "effect"

const STORAGE_KEY = "folio.effect-ui.kanban.v2"

const toTask = (card: KanbanCard): Task => ({
  id: card.id,
  key: card.code,
  title: card.title,
  notes: card.notes,
  column: card.lane,
  priority: card.priority,
  assignee: card.assignee,
  points: card.points,
  tags: card.tags,
  createdAt: card.createdAt
})

export const defaultSeedTasks: ReadonlyArray<Task> = DEFAULT_CARDS.map(toTask)

const decodeTasks = Schema.decodeUnknownOption(Schema.Array(Task))

const readFromStorage = (): Array<Task> => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return [...defaultSeedTasks]
    const parsed: unknown = JSON.parse(raw)
    const decoded = decodeTasks(parsed)
    return decoded._tag === "Some" && decoded.value.length > 0
      ? [...decoded.value]
      : [...defaultSeedTasks]
  } catch {
    return [...defaultSeedTasks]
  }
}

const writeToStorage = (tasks: ReadonlyArray<Task>): void => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // Ignore storage unavailability
  }
}

export class TaskStore extends Context.Service<TaskStore, {
  readonly list: Effect.Effect<ReadonlyArray<Task>>
  get(id: string): Effect.Effect<Task, TaskNotFound>
  create(input: NewTaskInput): Effect.Effect<Task, TaskSaveError>
  save(task: Task): Effect.Effect<Task, TaskSaveError>
  move(id: string, column: ColumnId): Effect.Effect<Task, TaskNotFound>
  remove(id: string): Effect.Effect<void, TaskNotFound>
  readonly resetSeed: Effect.Effect<ReadonlyArray<Task>>
}>()("folio/TaskStore") {
  static readonly makeService = (
    initial: ReadonlyArray<Task>,
    options: { readonly persist: boolean; readonly latencyMs: number }
  ) => {
    let items: Array<Task> = [...initial]

    const syncPersist = () => {
      if (options.persist) writeToStorage(items)
    }

    const withDelay = <A, E>(eff: Effect.Effect<A, E>): Effect.Effect<A, E> =>
      options.latencyMs > 0
        ? Effect.sleep(`${options.latencyMs} millis`).pipe(Effect.andThen(eff))
        : eff

    return TaskStore.of({
      list: withDelay(Effect.sync(() => [...items])),
      get: (id) =>
        withDelay(
          Effect.suspend(() => {
            const found = items.find((item) => item.id === id)
            return found === undefined
              ? Effect.fail(new TaskNotFound({ id }))
              : Effect.succeed(found)
          })
        ),
      create: (input) =>
        withDelay(
          Effect.suspend(() => {
            const title = input.title.trim()
            if (title.length < 3) {
              return Effect.fail(
                new TaskSaveError({
                  reason: "Card title must be at least 3 characters."
                })
              )
            }
            const code = nextCardCode(items.map((item) => ({ code: item.key })))
            const created: Task = {
              id: `card-${code.toLowerCase()}`,
              key: code,
              title,
              notes: input.notes.trim(),
              column: input.column,
              priority: input.priority,
              assignee: normalizeAssignee(input.assignee),
              points: input.points,
              tags: input.tags,
              createdAt: new Date().toISOString()
            }
            items = [created, ...items]
            syncPersist()
            return Effect.succeed(created)
          })
        ),
      save: (task) =>
        withDelay(
          Effect.suspend(() => {
            const title = task.title.trim()
            if (title.length === 0) {
              return Effect.fail(
                new TaskSaveError({ reason: "A card cannot have an empty title." })
              )
            }
            const exists = items.some((item) => item.id === task.id)
            if (!exists) {
              return Effect.fail(
                new TaskSaveError({ reason: `Card ${task.key} no longer exists.` })
              )
            }
            const updated: Task = { ...task, title }
            items = items.map((item) => (item.id === task.id ? updated : item))
            syncPersist()
            return Effect.succeed(updated)
          })
        ),
      move: (id, column) =>
        withDelay(
          Effect.suspend(() => {
            const existing = items.find((item) => item.id === id)
            if (existing === undefined) {
              return Effect.fail(new TaskNotFound({ id }))
            }
            if (existing.column === column) {
              return Effect.succeed(existing)
            }
            const updated: Task = { ...existing, column }
            items = [updated, ...items.filter((item) => item.id !== id)]
            syncPersist()
            return Effect.succeed(updated)
          })
        ),
      remove: (id) =>
        withDelay(
          Effect.suspend(() => {
            const exists = items.some((item) => item.id === id)
            if (!exists) {
              return Effect.fail(new TaskNotFound({ id }))
            }
            items = items.filter((item) => item.id !== id)
            syncPersist()
            return Effect.void
          })
        ),
      resetSeed: withDelay(
        Effect.sync(() => {
          items = [...defaultSeedTasks]
          syncPersist()
          return [...items]
        })
      )
    })
  }

  static readonly layerBrowser = Layer.sync(TaskStore, () =>
    TaskStore.makeService(readFromStorage(), { persist: true, latencyMs: 70 })
  )

  static readonly layerMemory = (seed: ReadonlyArray<Task> = defaultSeedTasks) =>
    Layer.sync(TaskStore, () =>
      TaskStore.makeService(seed, { persist: false, latencyMs: 0 })
    )
}
