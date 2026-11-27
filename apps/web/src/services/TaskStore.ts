import {
  DEFAULT_CARDS,
  createCard,
  deleteCard,
  findCard,
  moveCard,
  nextCardCode,
  saveCard,
  validateCardTitle
} from "@folio/kanban-core"
import {
  type ColumnId,
  type NewTaskInput,
  Task,
  TaskNotFound,
  TaskSaveError
} from "#domain/Task"
import { Context, Effect, Layer, Schema } from "effect"

const STORAGE_KEY = "folio.effect-ui.kanban.v3"

export const defaultSeedTasks: ReadonlyArray<Task> = DEFAULT_CARDS

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
    let items: ReadonlyArray<Task> = [...initial]

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
            const found = findCard(items, id)
            return found === undefined
              ? Effect.fail(new TaskNotFound({ id }))
              : Effect.succeed(found)
          })
        ),
      create: (input) =>
        withDelay(
          Effect.suspend(() => {
            const titleCheck = validateCardTitle(input.title, 3)
            if (!titleCheck.ok) {
              return Effect.fail(
                new TaskSaveError({
                  reason: "Card title must be at least 3 characters."
                })
              )
            }
            const code = nextCardCode(items)
            const created = createCard(items, input, {
              id: `card-${code.toLowerCase()}`,
              createdAt: new Date().toISOString()
            })
            items = created.cards
            syncPersist()
            return Effect.succeed(created.card)
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
            if (findCard(items, task.id) === undefined) {
              return Effect.fail(
                new TaskSaveError({ reason: `Card ${task.code} no longer exists.` })
              )
            }
            items = saveCard(items, task.id, {
              title,
              notes: task.notes,
              lane: task.lane,
              priority: task.priority,
              assignee: task.assignee,
              points: task.points,
              tags: task.tags
            })
            const updated = findCard(items, task.id) ?? { ...task, title }
            syncPersist()
            return Effect.succeed(updated)
          })
        ),
      move: (id, column) =>
        withDelay(
          Effect.suspend(() => {
            const existing = findCard(items, id)
            if (existing === undefined) {
              return Effect.fail(new TaskNotFound({ id }))
            }
            if (existing.lane === column) {
              return Effect.succeed(existing)
            }
            items = moveCard(items, id, column)
            const updated = findCard(items, id) ?? { ...existing, lane: column }
            syncPersist()
            return Effect.succeed(updated)
          })
        ),
      remove: (id) =>
        withDelay(
          Effect.suspend(() => {
            if (findCard(items, id) === undefined) {
              return Effect.fail(new TaskNotFound({ id }))
            }
            items = deleteCard(items, id)
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
