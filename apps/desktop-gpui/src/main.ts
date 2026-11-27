import { GpuiHost } from "@folio/effect-ui-gpui"
import { Effect, Layer, Option } from "effect"
import { KanbanDesktop, SaveBoard } from "./components/KanbanDesktop.ts"
import { BoardStorage, makeFileStorageLayer } from "./services/storage.ts"

const loadInitialProps = Effect.gen(function* () {
  const storage = yield* BoardStorage
  const saved = yield* storage.load
  return { initialBoard: Option.fromUndefinedOr(saved) }
})

const storageLayer = makeFileStorageLayer()
const appLayer = Layer.merge(
  storageLayer,
  SaveBoard.layer.pipe(Layer.provide(storageLayer))
)

const program = GpuiHost.run(KanbanDesktop, loadInitialProps, {
  title: "Folio Kanban · @effect/ui (GPUI)",
  appId: "dev.folio.kanban",
  width: 1280,
  height: 800
}).pipe(Effect.provide(appLayer))

Effect.runPromise(program).catch((error) => {
  console.error("[folio-desktop-gpui]", error)
  process.exit(1)
})
