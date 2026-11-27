import "expo"

import {
  FolioApp,
  makeKanbanLayer,
  mobileAppProps
} from "@folio/kanban-app"
import { fabricLifecycleLayer } from "@universal-ui/host-fabric"
import { registerApp } from "@universal-ui/host-fabric/register"

// Drives React Native Fabric directly from @folio/kanban-app via @universal-ui/host-fabric.
registerApp(FolioApp, mobileAppProps(), {
  layer: makeKanbanLayer({ lifecycle: fabricLifecycleLayer })
})
