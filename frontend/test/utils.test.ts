import { describe, it, expect } from 'vitest'
import { sum } from '../src/utils'

describe('sum function', () => {
  it('adds two positive numbers correctly', () => {
    expect(sum(1, 2)).toBe(3)
  })

  it('handles negative numbers', () => {
    expect(sum(-1, -2)).toBe(-3)
    expect(sum(-1, 2)).toBe(1)
  })

  it('handles zero', () => {
    expect(sum(0, 0)).toBe(0)
    expect(sum(5, 0)).toBe(5)
  })
})
