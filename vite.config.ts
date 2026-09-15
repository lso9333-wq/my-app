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
      // hand-pose-detection statically imports this for the MediaPipeHands
      // "mediapipe" runtime, which this app doesn't use ("tfjs" runtime only)
      // — see the shim file.
      '@mediapipe/hands': path.resolve(import.meta.dirname, 'src/shims/mediapipe-hands-shim.ts'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
