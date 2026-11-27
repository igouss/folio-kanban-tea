const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const { withTailwind } = require('@ng-native/tailwind/config.cjs')

const sharedCore = path.resolve(__dirname, '../../packages/kanban-core')
const config = getDefaultConfig(__dirname)
config.watchFolders = [...(config.watchFolders ?? []), sharedCore]

module.exports = withTailwind(config, {
  input: './src/styles.css',
  output: './.tailwind/app.tailwind.js',
})
