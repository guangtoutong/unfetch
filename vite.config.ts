import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // MAS / Mac App Store 构建标志。build-mas.sh 跑前设 VITE_APP_STORE_BUILD=1
    // 用来切第三方广告显示(MAS 版只显示自家官网链接,不挂任何第三方)。
    __APP_STORE_BUILD__: JSON.stringify(process.env.VITE_APP_STORE_BUILD === '1'),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1421,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}))
