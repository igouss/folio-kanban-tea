import "./styles.css"
import {
  FolioApp,
  loadInitialBoard,
  makeKanbanLayerFromStore,
  webAppProps
} from "@folio/kanban-app"
import {
  WebHost,
  browserLifecycleLayer,
  browserStoreLayer
} from "@universal-ui/host-web"
import { Effect, Layer } from "effect"

const STORAGE_KEY = "folio.unified.kanban.v1"

const initialProps = Effect.map(loadInitialBoard, (saved) => ({
  ...webAppProps(saved),
  layout:
    typeof window !== "undefined" && window.innerWidth < 820
      ? ("tabs" as const)
      : ("columns" as const)
}))

const Main = WebHost.mount(
  FolioApp,
  initialProps,
  document.getElementById("app")!
).pipe(
  Layer.provide(
    makeKanbanLayerFromStore({
      storageKey: STORAGE_KEY,
      store: browserStoreLayer,
      lifecycle: browserLifecycleLayer
    })
  )
)

Layer.launch(Main).pipe(Effect.runFork)
