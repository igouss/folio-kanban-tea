const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const { withTailwind } = require('@ng-native/tailwind/config.cjs')

const sharedCore = path.resolve(__dirname, '../../packages/kanban-core')
const config = getDefaultConfig(__dirname)
config.watchFolders = [...(config.watchFolders ?? []), sharedCore]

// Resolve @effect/ui Node subpath imports (#dev / #hot) for Hermes/Metro
const effectUiDir = path.resolve(__dirname, 'node_modules/@effect/ui/dist')
const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '#dev') {
    return {
      type: 'sourceFile',
      filePath: path.join(effectUiDir, 'internal', 'devOff.js'),
    }
  }
  if (moduleName === '#hot') {
    return {
      type: 'sourceFile',
      filePath: path.join(effectUiDir, 'html', 'internal', 'hotOff.js'),
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withTailwind(config, {
  input: './src/styles.css',
  output: './.tailwind/app.tailwind.js',
})
