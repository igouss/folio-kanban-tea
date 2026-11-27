import 'expo'

import { registerApp } from 'foldkit-native'
import tailwind from '../.tailwind/app.tailwind.js'
import { makeKanbanMobile } from './app'

// Drives React Native Fabric directly via @ng-native/fabric with no React reconciler.
registerApp(makeKanbanMobile, { styleSheet: tailwind })
