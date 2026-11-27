import "./styles.css"
import {
  FolioApp,
  kanbanCommandsLayer,
  keyValueBoardRepositoryLayer,
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

const AppLayer = Layer.provideMerge(
  kanbanCommandsLayer,
  Layer.mergeAll(
    BoardRepoLayer,
    browserLifecycleLayer,
    browserViewportLayer,
    browserIdGeneratorLayer
  )
)

const Main = WebHost.mount(
  FolioApp,
  loadFolioProps({
    runtimeTag: "web",
    platformLabel: "Web · DOM Host"
  }),
  document.getElementById("app")!
).pipe(Layer.provide(AppLayer))

Layer.launch(Main).pipe(Effect.runFork)
