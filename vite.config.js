import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/avatar-studio/',
  server: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: './build',
  },
  resolve: {
    alias: {
      buffer: 'buffer/'
    }
  }
})
