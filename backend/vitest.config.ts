import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        './*.js',  // Exclude any root-level compiled JS files
        '**/vitest.config.ts',
        '**/*.d.ts',
        'coverage/**',  // Exclude coverage reports
        'test/**',      // Exclude test files from coverage calculation
        'src/blockchain.ts'  // Exclude blockchain helper (requires deployed contract) // TODO
      ],
      // Set minimum threshold levels to prevent coverage regression
      thresholds: {
        // statements: 60,
        // branches: 60,
        // functions: 60,
        lines: 60
      }
    }
  }
})
