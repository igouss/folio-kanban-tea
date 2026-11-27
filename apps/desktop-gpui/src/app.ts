import { Effect, Option, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { Runtime } from 'foldkit'
import { BrowserKeyValueStore } from '@effect/platform-browser'
import { DragAndDrop } from '@foldkit/ui'
import { mountGpuix } from 'foldkit-gpuix'
import { setThemeApplier } from './command.ts'
import {
  DEFAULT_COLUMNS,
  STORAGE_KEY,
  SavedBoard,
  SavedBoardJsonString,
} from './domain.ts'
import type { Message } from './message.ts'
import { Model } from './model.ts'
import { subscriptions } from './subscription.ts'
import { kanbanCss, paperTokens, tokensFor } from './theme.ts'
import { update } from './update.ts'
import { view } from './view.ts'

const Flags = Schema.Struct({
  maybeSavedBoard: Schema.Option(SavedBoard),
})
type Flags = typeof Flags.Type

const app = mountGpuix({
  title: 'Folio Kanban · FoldKit Native (GPUI)',
  appId: 'dev.folio.kanban',
  width: 1280,
  height: 800,
  css: kanbanCss,
  tokens: paperTokens,
})

setThemeApplier((theme) => app.setTokens(tokensFor(theme)))

const flags: Effect.Effect<Flags> = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore
  const json = yield* Effect.fromOption(
    Option.fromNullishOr(yield* store.get(STORAGE_KEY)),
  )
  const decoded = yield* Schema.decodeEffect(SavedBoardJsonString)(json)
  return Flags.make({ maybeSavedBoard: Option.some(decoded) })
}).pipe(
  Effect.catch(() =>
    Effect.succeed(Flags.make({ maybeSavedBoard: Option.none() })),
  ),
  Effect.provide(BrowserKeyValueStore.layerLocalStorage),
)

const init: Runtime.ApplicationInit<Model, Message, Flags> = (loadedFlags) => {
  const saved = Option.getOrUndefined(loadedFlags.maybeSavedBoard)
  const theme = saved?.theme ?? 'paper'
  app.setTokens(tokensFor(theme))

  return {
    model: {
      columns: saved?.columns ?? DEFAULT_COLUMNS,
      dragAndDrop: DragAndDrop.init({ id: 'folio-kanban' }),
      theme,
      searchQuery: '',
      priorityFilter: 'all',
      maybeNewCardColumnId: Option.none(),
      newCardTitle: '',
      maybeEditDraft: Option.none(),
      notice: '',
      announcement: '',
      dispatchCount: 0,
    },
  }
}

app.own(
  Runtime.embed(
    Runtime.makeApplication({
      Model,
      Flags,
      init,
      update,
      view,
      subscriptions,
      container: app.container,
    }),
    { flags },
  ),
)
