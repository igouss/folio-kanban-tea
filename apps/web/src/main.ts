import "./styles.css"
import * as WebHost from "@folio/effect-ui-universal/web"
import {
  FolioApp,
  loadInitialBoard,
  makeAppLayer,
  webAppProps
} from "@folio/folio-app"
import { Effect, Layer } from "effect"
import { browserLifecycleLayer, browserStorageLayer } from "./storage.ts"

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
    makeAppLayer({
      storage: browserStorageLayer,
      lifecycle: browserLifecycleLayer
    })
  )
)

Layer.launch(Main).pipe(Effect.runFork)
