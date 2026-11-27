import "expo"

import { registerApp } from "@folio/effect-ui-fabric/register"
import tailwind from "../.tailwind/app.tailwind.js"
import { KanbanMobile } from "./app"

// Drives React Native Fabric directly from @effect/ui via @ng-native/fabric with no React reconciler.
registerApp(KanbanMobile, {}, { styleSheet: tailwind })
