import { Crypto, Effect, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { Command, Dom } from 'foldkit'
import { BrowserCrypto, BrowserKeyValueStore } from '@effect/platform-browser'
import {
  ADD_CARD_INPUT_ID,
  Column,
  STORAGE_KEY,
  SavedBoardJsonString,
  ThemeMode,
} from './domain.ts'
import { Message } from './message.ts'

let themeApplier: (theme: ThemeMode) => void = () => {}

export const setThemeApplier = (applier: (theme: ThemeMode) => void): void => {
  themeApplier = applier
}

export const ApplyTheme = Command.define('ApplyTheme', {
  args: { theme: ThemeMode },
  messages: [Message.AppliedTheme],
  execute: ({ theme }) =>
    Effect.sync(() => themeApplier(theme)).pipe(
      Effect.as(Message.AppliedTheme()),
    ),
})

export const GenerateCardId = Command.define('GenerateCardId', {
  args: { columnId: Schema.String, title: Schema.String },
  messages: [Message.CompletedGenerateCardId],
  execute: ({ columnId, title }) =>
    Effect.gen(function* () {
      const crypto = yield* Crypto.Crypto
      const cardId = yield* Effect.orDie(crypto.randomUUIDv4)
      return Message.CompletedGenerateCardId({ cardId, columnId, title })
    }).pipe(Effect.provide(BrowserCrypto.layer)),
})

export const SaveBoard = Command.define('SaveBoard', {
  args: { columns: Schema.Array(Column), theme: ThemeMode },
  messages: [Message.CompletedSaveBoard],
  execute: ({ columns, theme }) =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore
      yield* store.set(
        STORAGE_KEY,
        Schema.encodeSync(SavedBoardJsonString)({ columns, theme }),
      )
      return Message.CompletedSaveBoard()
    }).pipe(
      Effect.catch(() => Effect.succeed(Message.CompletedSaveBoard())),
      Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    ),
})

export const FocusAddCardInput = Command.define('FocusAddCardInput', {
  messages: [Message.CompletedFocusAddCardInput],
  execute: Dom.focus(`#${ADD_CARD_INPUT_ID}`).pipe(
    Effect.ignore,
    Effect.as(Message.CompletedFocusAddCardInput()),
  ),
})
