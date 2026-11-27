import {
  FolioApp,
  desktopAppProps,
  loadInitialBoard,
  makeKanbanLayerFromStore
} from "@folio/kanban-app"
import { GpuiHost, makeFileStoreLayer } from "@universal-ui/host-gpui"
import { Effect } from "effect"

const initialProps = Effect.map(loadInitialBoard, (saved) =>
  desktopAppProps(saved)
)

const program = GpuiHost.run(FolioApp, initialProps, {
  title: "Folio Kanban · @effect/ui (GPUI)",
  appId: "dev.folio.kanban",
  width: 1280,
  height: 800
}).pipe(
  Effect.provide(
    makeKanbanLayerFromStore({
      storageKey: "board",
      store: makeFileStoreLayer({ appDirName: "folio-kanban-gpui" })
    })
  )
)

Effect.runPromise(program).catch((error) => {
  console.error("[folio-kanban-desktop]", error)
  process.exit(1)
})
