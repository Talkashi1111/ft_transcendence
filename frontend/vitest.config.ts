import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary'],
      // Set minimum coverage thresholds (only lines enforced)
      thresholds: {
        // statements: 60,
        // branches: 60,
        // functions: 60,
        lines: 60,
      },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        '**/*.config.js',
        '**/*.config.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/vite-env.d.ts',
        '**/main.ts', // Entry point with DOM manipulation
        '**/test/**',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/types/**', // Type-only files
        '**/game/renderer.ts', // Canvas-dependent (not testable in jsdom)
        '**/game/pong.ts', // Integration class (hard to unit test)
        '**/pages/**', // UI pages (need integration tests)
      ],
    },
  },
});
