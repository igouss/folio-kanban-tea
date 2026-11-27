const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const workspaceRoot = path.resolve(__dirname, '../../../..')
const config = getDefaultConfig(__dirname)
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Resolve Node subpath imports for @effect/ui (#dev, #hot) and @ui-sdk/core (#dev, #name-check)
const effectUiDir = path.join(
  path.dirname(require.resolve('@effect/ui/package.json')),
  'dist',
)
const uiSdkDir = path.join(
  path.dirname(require.resolve('@ui-sdk/core/package.json')),
  'dist',
)
const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromUiSdk =
    typeof context.originModulePath === 'string' &&
    context.originModulePath.includes('@ui-sdk/core')
  if (moduleName === '#dev') {
    return {
      type: 'sourceFile',
      filePath: fromUiSdk
        ? path.join(uiSdkDir, 'foundation', 'kernel', 'dev-stub.js')
        : path.join(effectUiDir, 'internal', 'devOff.js'),
    }
  }
  if (moduleName === '#name-check') {
    return {
      type: 'sourceFile',
      filePath: path.join(uiSdkDir, 'foundation', 'text', 'name-check-stub.js'),
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

module.exports = config
