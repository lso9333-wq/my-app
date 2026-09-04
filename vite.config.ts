import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // pose-detection statically imports this for the BlazePose "mediapipe"
      // runtime, which this app doesn't use (MoveNet only) — see the shim file.
      '@mediapipe/pose': path.resolve(import.meta.dirname, 'src/shims/mediapipe-pose-shim.ts'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
