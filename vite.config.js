import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/vue-compound-interest-calculator/' : '/',
  plugins: [vue()],
}))
