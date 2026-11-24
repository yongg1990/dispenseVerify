import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [uni.default ? uni.default() : uni()],
    server: {
      host: '0.0.0.0', port: 5173, strictPort: true,
      proxy: {
        '/api/system/user': {
          target: env.VITE_BAAS_PROXY_TARGET || 'https://smadev.simmed.cn',
          changeOrigin: true
        },
        '/api2/axd': {
          target: env.VITE_PRESCRIPTION_PROXY_TARGET || 'https://smadev.simmed.cn',
          changeOrigin: true
        }
      }
    }
  }
})
