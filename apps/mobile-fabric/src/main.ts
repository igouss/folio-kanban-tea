import "expo"

import { registerApp } from "@folio/effect-ui-fabric/register"
import { appState } from "@folio/effect-ui-fabric/subscription"
import {
  FolioApp,
  makeAppLayer,
  makeLifecycleLayer,
  mobileAppProps
} from "@folio/folio-app"
import tailwind from "../.tailwind/app.tailwind.js"

// Drives React Native Fabric directly from the unified @folio/folio-app via @ng-native/fabric.
registerApp(FolioApp, mobileAppProps(), {
  styleSheet: tailwind,
  layer: makeAppLayer({ lifecycle: makeLifecycleLayer(appState) })
})
