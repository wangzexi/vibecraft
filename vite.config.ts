import { defineConfig } from 'vite'
import { resolve } from 'path'

const opencodeUrl = process.env.VITE_OPENCODE_URL || 'http://localhost:4096'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    // Inject OpenCode URL into frontend at build time
    'import.meta.env.VITE_OPENCODE_URL': JSON.stringify(opencodeUrl),
  },
  server: {
    port: 4002,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
})
