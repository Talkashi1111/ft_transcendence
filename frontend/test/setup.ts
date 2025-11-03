// Test setup for vanilla TypeScript tests
// No special setup needed for jsdom

// This file runs before all tests and sets up the testing environment

// Example: Global fetch mock setup (commented out as an example)
// import { vi } from 'vitest'
//
// // Mock fetch globally for all tests (just an example)
// global.fetch = vi.fn()

// Example: Suppress console errors during tests (commented out as an example)
// const originalConsoleError = console.error
// console.error = (...args) => {
//   // Ignore specific error messages or just disable during tests
//   if (args[0]?.includes('some known warning to ignore')) {
//     return
//   }
//   originalConsoleError(...args)
// }

// Example: Add custom matchers (commented out as an example)
// expect.extend({
//   toBeWithinRange(received, floor, ceiling) {
//     const pass = received >= floor && received <= ceiling
//     return {
//       pass,
//       message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
//     }
//   },
// })
