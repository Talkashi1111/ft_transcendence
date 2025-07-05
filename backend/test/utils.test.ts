import { describe, it, expect } from 'vitest'

// A simple utility function to test
export function sum(a: number, b: number): number {
  return a + b
}

describe('Backend tests', () => {
  describe('sum function', () => {
    it('adds two numbers correctly', () => {
      expect(sum(1, 2)).toBe(3)
    })

    it('handles negative numbers', () => {
      expect(sum(-1, -2)).toBe(-3)
    })
  })
})
