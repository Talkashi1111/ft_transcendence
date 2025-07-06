import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { server } from '../src/index'
import { counterOperations } from '../src/db'

// Mock the db module
vi.mock('../src/db', () => ({
  counterOperations: {
    getValue: vi.fn(),
    setValue: vi.fn()
  }
}))

describe('API Server', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Clean up after all tests
  afterAll(async () => {
    await server.close()
  })

  describe('User endpoint', () => {
    it('should create a user successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'Test User',
          mail: 'test@example.com'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload)).toEqual({
        name: 'Test User',
        mail: 'test@example.com'
      })
    })

    it('should validate user schema', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: {
          // Missing required name field
          mail: 'invalid@example.com'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should validate email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: {
          name: 'Invalid Email User',
          mail: 'not-an-email'
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('Counter endpoint', () => {
    it('should get counter value', async () => {
      // Mock the getValue operation
      vi.mocked(counterOperations.getValue).mockReturnValue({ value: 42 })

      const response = await server.inject({
        method: 'GET',
        url: '/api/counter'
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload)).toEqual({ value: 42 })
      expect(counterOperations.getValue).toHaveBeenCalledTimes(1)
    })

    it('should return 0 when counter not found', async () => {
      // Mock the getValue operation returning null
      vi.mocked(counterOperations.getValue).mockReturnValue(null)

      const response = await server.inject({
        method: 'GET',
        url: '/api/counter'
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload)).toEqual({ value: 0 })
    })

    it('should handle error when getting counter', async () => {
      // Mock the getValue operation throwing an error
      vi.mocked(counterOperations.getValue).mockImplementation(() => {
        throw new Error('Database error')
      })

      const response = await server.inject({
        method: 'GET',
        url: '/api/counter'
      })

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.payload)).toEqual({ value: 0 })
    })

    it('should update counter value', async () => {
      // Mock the setValue operation
      vi.mocked(counterOperations.setValue).mockReturnValue({ value: 100 })

      const response = await server.inject({
        method: 'PUT',
        url: '/api/counter',
        payload: {
          value: 100
        }
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload)).toEqual({ value: 100 })
      expect(counterOperations.setValue).toHaveBeenCalledWith(100)
    })

    it('should validate counter schema', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/counter',
        payload: {
          // Should be an integer, not a string
          value: "not a number"
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle error when updating counter', async () => {
      // Mock the setValue operation throwing an error
      vi.mocked(counterOperations.setValue).mockImplementation(() => {
        throw new Error('Database error')
      })

      const response = await server.inject({
        method: 'PUT',
        url: '/api/counter',
        payload: {
          value: 200
        }
      })

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.payload)).toEqual({ value: -1 })
    })
  })
})
