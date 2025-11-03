import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      // Set minimum coverage thresholds (only lines enforced)
      thresholds: {
        // statements: 60,
        // branches: 60,
        // functions: 60,
        lines: 60,
      },
      exclude: [
        '**/*.config.js',        // Excludes all config files like postcss.config.js, tailwind.config.js
        '**/*.config.ts',        // Excludes TypeScript config files
        '**/node_modules/**',    // Standard exclusion
        '**/dist/**',            // Build output
        '**/vite-env.d.ts',      // TypeScript declaration files
        '**/main.ts',            // Entry point file with DOM manipulation
        '**/test/**',            // Test directory
        '**/*.test.{js,jsx,ts,tsx}', // Test files
        '**/*.spec.{js,jsx,ts,tsx}', // Spec files
      ],
    },
  },
})
