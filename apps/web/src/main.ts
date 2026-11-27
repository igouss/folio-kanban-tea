import "./styles.css"
import { TaskStore } from "#services/TaskStore"
import { TraceBus } from "#services/TraceBus"
import { Router } from "@effect/ui"
import { BrowserHost, BrowserRouter } from "@effect/ui/html"
import { Effect, Layer } from "effect"
import { App } from "./App.ts"
import { AppRoute } from "./routes.ts"

const { busLayer, messageLogLayer } = TraceBus.makeLive()

const Main = BrowserHost.mount(
  App,
  Router.props(AppRoute),
  document.getElementById("app")!
).pipe(
  Layer.provide([
    BrowserRouter.layerHash({ routes: AppRoute }),
    TaskStore.layerBrowser,
    busLayer,
    messageLogLayer
  ])
)

Layer.launch(Main).pipe(Effect.runFork)
