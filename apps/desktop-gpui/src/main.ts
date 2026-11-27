import { GpuiHost } from "@folio/effect-ui-gpui"
import {
  FolioApp,
  desktopAppProps,
  loadInitialBoard,
  makeAppLayer
} from "@folio/folio-app"
import { Effect } from "effect"
import { makeFileStorageLayer } from "./storage.ts"

const initialProps = Effect.map(loadInitialBoard, (saved) =>
  desktopAppProps(saved)
)

const program = GpuiHost.run(FolioApp, initialProps, {
  title: "Folio Kanban · @effect/ui (GPUI)",
  appId: "dev.folio.kanban",
  width: 1280,
  height: 800
}).pipe(
  Effect.provide(makeAppLayer({ storage: makeFileStorageLayer() }))
)

Effect.runPromise(program).catch((error) => {
  console.error("[folio-desktop-gpui]", error)
  process.exit(1)
})
