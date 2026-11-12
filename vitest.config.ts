import path from 'path'
import { defineConfig } from 'vitest/config'

// Configuração de testes unitários (vitest). Testes rodam em ambiente "dom"
// e usam o mesmo alias "@" do vite.config.ts.
export default defineConfig({
  test: {
    environment: 'dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
})
