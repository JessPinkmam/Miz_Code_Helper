/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 部署在 https://<user>.github.io/Miz_Code_Helper/ 下，
// 因此构建时 base 需为仓库名。本地 dev / preview 用 './' 即可。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/Miz_Code_Helper/' : './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
