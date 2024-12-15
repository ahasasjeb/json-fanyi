import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 根据依赖包名进行切割
            const packageName = id.split('node_modules/')[1].split('/')[0]
            return `vendor_${packageName}`
          }
          if (id.includes('src/components')) {
            return 'components'
          }
          if (id.includes('src/utils')) {
            return 'utils'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
