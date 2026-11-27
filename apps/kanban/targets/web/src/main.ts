import "./styles.css"
import {
  FolioApp,
  keyValueBoardRepositoryLayer,
  liveInspectorLayer,
  loadFolioProps
} from "@folio/kanban-app"
import { WebHost } from "@universal-ui/host-web"
import {
  browserIdGeneratorLayer,
  browserLifecycleLayer,
  browserViewportLayer
} from "@universal-ui/platform/browser"
import { browserStoreLayer } from "@universal-ui/storage/browser"
import { Effect, Layer } from "effect"

const BoardRepoLayer = keyValueBoardRepositoryLayer("folio.unified.kanban.v1").pipe(
  Layer.provide(browserStoreLayer)
)

const PlatformLayer = Layer.mergeAll(
  BoardRepoLayer,
  liveInspectorLayer,
  browserLifecycleLayer,
  browserViewportLayer,
  browserIdGeneratorLayer
)

const Main = WebHost.mount(
  FolioApp,
  loadFolioProps({
    runtimeTag: "web",
    platformLabel: "Web · DOM Host"
  }),
  document.getElementById("app")!
).pipe(Layer.provide(PlatformLayer))

Layer.launch(Main).pipe(Effect.runFork)
