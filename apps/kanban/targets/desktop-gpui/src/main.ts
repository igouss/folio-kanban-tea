import {
  FolioApp,
  keyValueBoardRepositoryLayer,
  liveInspectorLayer,
  loadFolioProps
} from "@folio/kanban-app"
import { GpuiHost } from "@universal-ui/host-gpui"
import {
  nodeIdGeneratorLayer,
  staticLifecycleLayer,
  staticViewportLayer
} from "@universal-ui/platform/node"
import { makeFileStoreLayer } from "@universal-ui/storage/fs"
import { Effect, Layer } from "effect"

const BoardRepoLayer = keyValueBoardRepositoryLayer("board").pipe(
  Layer.provide(makeFileStoreLayer({ appDirName: "folio-kanban-gpui" }))
)

const PlatformLayer = Layer.mergeAll(
  BoardRepoLayer,
  liveInspectorLayer,
  staticLifecycleLayer("active"),
  staticViewportLayer({ width: 1280, height: 800, topInset: 0 }),
  nodeIdGeneratorLayer
)

const program = GpuiHost.run(
  FolioApp,
  loadFolioProps({
    runtimeTag: "desktop",
    platformLabel: "GPUI · Native GPU"
  }),
  {
    title: "Folio Kanban · @effect/ui (GPUI)",
    appId: "dev.folio.kanban",
    width: 1280,
    height: 800
  }
).pipe(Effect.provide(PlatformLayer))

Effect.runPromise(program).catch((error) => {
  console.error("[folio-kanban-desktop]", error)
  process.exit(1)
})
