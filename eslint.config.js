import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default defineConfig([
  globalIgnores(['dist/**', 'dist-ssr/**', 'coverage/**', 'docs_internal/**']),
  {
    files: ['**/*.{js,mjs,vue}'],
    extends: [js.configs.recommended, vue.configs['flat/essential']],
  },
  {
    files: ['src/**/*.{js,vue}', 'tests/**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
