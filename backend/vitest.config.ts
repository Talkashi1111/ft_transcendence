import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    // Run tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        './*.js', // Exclude any root-level compiled JS files
        '**/vitest.config.ts',
        '**/*.d.ts',
        'coverage/**', // Exclude coverage reports
        'test/**', // Exclude test files from coverage calculation
        'src/index.ts', // Exclude entry point (just starts server)
        'src/modules/blockchain/**', // Exclude blockchain module (requires deployed contract)
        'src/generated/**', // Exclude Prisma generated files
        'prisma.config.ts', // Exclude Prisma config
      ],
      // Set minimum threshold levels to prevent coverage regression
      thresholds: {
        // statements: 58,
        // branches: 58,
        // functions: 58,
        lines: 58,
      },
    },
  },
});
