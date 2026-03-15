import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'simulation',
          include: ['src/simulation/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'ui',
          include: ['src/ui/**/*.spec.ts'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'renderer',
          include: ['src/renderer/**/*.spec.ts'],
          environment: 'jsdom',
        },
      },
    ],
  },
})
