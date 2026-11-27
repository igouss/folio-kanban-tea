import { Stream } from 'effect'
import { makeElement } from 'foldkit/runtime'
import { make, persistent } from 'foldkit/subscription'
import type { NativeHost } from 'foldkit-native/mount'
import { appState } from 'foldkit-native/subscription'
import { nativeView } from 'foldkit-native/view'
import { DEFAULT_CARDS } from './domain'
import { Message } from './message'
import { Model } from './model'
import { update } from './update'
import { view } from './view'

const subscriptions = make<Model, Message>()(() => ({
  appState: persistent(
    appState.pipe(Stream.map((state) => Message.ChangedAppState({ state }))),
  ),
}))

export const makeKanbanMobile = ({ container, platform }: NativeHost) =>
  makeElement({
    Model,
    init: () => ({
      model: {
        cards: [...DEFAULT_CARDS],
        activeLane: 'in_progress' as const,
        screen: { _tag: 'Board' as const },
        searchQuery: '',
        priorityFilter: 'all' as const,
        quickTitle: '',
        theme: 'paper' as const,
        appState: 'active',
        isBackgrounded: false,
        backgroundTrips: 0,
        statusBanner: '',
        nextId: 1,
      },
    }),
    update,
    view: nativeView(view),
    subscriptions,
    container,
    platform,
  })
