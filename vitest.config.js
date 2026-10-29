import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default defineConfig((environment) => mergeConfig(
  viteConfig(environment),
  defineConfig({
    test: {
      environment: 'node',
      setupFiles: ['./tests/setup.js'],
    },
  }),
))
