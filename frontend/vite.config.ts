import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { getDevServerConfig } from './config/dev-server.ts'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  return {
    plugins: [react()],
    server: getDevServerConfig(env, command),
    preview: { host: 'localhost', strictPort: true },
  }
})
