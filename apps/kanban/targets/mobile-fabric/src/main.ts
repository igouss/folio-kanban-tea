import "expo"

import {
  FolioApp,
  keyValueBoardRepositoryLayer,
  loadFolioProps,
  noopInspectorLayer
} from "@folio/kanban-app"
import { fabricLifecycleLayer } from "@universal-ui/host-fabric"
import { registerApp } from "@universal-ui/host-fabric/register"
import {
  cryptoIdGeneratorLayer,
  staticViewportLayer
} from "@universal-ui/platform/memory"
import { makeMemoryKeyValueStore } from "@universal-ui/storage/memory"
import { Layer } from "effect"

const BoardRepoLayer = keyValueBoardRepositoryLayer("folio.mobile.board.v1").pipe(
  Layer.provide(makeMemoryKeyValueStore().layer)
)

const PlatformLayer = Layer.mergeAll(
  BoardRepoLayer,
  noopInspectorLayer,
  fabricLifecycleLayer,
  staticViewportLayer({ width: 390, height: 844, topInset: 56 }),
  cryptoIdGeneratorLayer
)

// Drives React Native Fabric directly from @folio/kanban-app via @universal-ui/host-fabric.
registerApp(
  FolioApp,
  loadFolioProps({
    runtimeTag: "mobile",
    platformLabel: "Fabric · Native Mobile"
  }),
  { layer: PlatformLayer }
)
