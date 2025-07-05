import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      // Set moderate coverage thresholds that encourage good testing practices
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 80,
        lines: 70,
      },
      exclude: [
        '**/*.config.js',        // Excludes all config files like postcss.config.js, tailwind.config.js
        '**/*.config.ts',        // Excludes TypeScript config files
        '**/node_modules/**',    // Standard exclusion
        '**/dist/**',            // Build output
        '**/vite-env.d.ts',      // TypeScript declaration files
        '**/main.tsx',           // Entry point file that just renders the App
        '**/test/**',            // Test directory
        '**/*.test.{js,jsx,ts,tsx}', // Test files
        '**/*.spec.{js,jsx,ts,tsx}', // Spec files
      ],
    },
  },
})
