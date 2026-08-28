/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { apiAutomationPlugin } from './vite/apiAutomation.ts'

export default defineConfig(({ mode }) => {
  // Load the whole .env (not just VITE_*) into process.env so the automation
  // plugin can read GITHUB_TOKEN. The empty prefix is deliberate: these values
  // stay on the dev server and are never exposed to the client bundle, which
  // is the point — a token in the bundle would be readable by any visitor.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), tailwindcss(), apiAutomationPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: false,
    },
  }
})
