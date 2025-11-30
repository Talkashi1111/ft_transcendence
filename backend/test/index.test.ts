import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { buildApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify'

let server: FastifyInstance

describe('API Server', () => {
  // Setup before all tests
  beforeAll(async () => {
    server = await buildApp()
  })

  // Clean up after all tests
  afterAll(async () => {
    await server.close()
  })

  describe('Health check', () => {
    it('should return ok status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/healthcheck'
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload)).toEqual({ status: 'ok' })
    })
  })

  describe('User registration', () => {
    const testUser = {
      email: 'test@example.com',
      alias: 'testuser',
      password: 'password123'
    }

    it('should register a new user', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser
      })

      // Could be 201 (created) or 409 (already exists from previous test run)
      expect([201, 409]).toContain(response.statusCode)

      if (response.statusCode === 201) {
        const body = JSON.parse(response.payload)
        expect(body).toHaveProperty('id')
        expect(body.email).toBe(testUser.email)
        expect(body.alias).toBe(testUser.alias)
        expect(body).toHaveProperty('createdAt')
        // Password should not be returned
        expect(body).not.toHaveProperty('password')
      }
    })

    it('should reject duplicate email', async () => {
      // First, ensure user exists
      await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser
      })

      // Try to register with same email
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser
      })

      expect(response.statusCode).toBe(409)
    })

    it('should validate email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'not-an-email',
          alias: 'testuser2',
          password: 'password123'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should validate password minimum length', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'test2@example.com',
          alias: 'testuser2',
          password: 'short'  // Less than 8 characters
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should validate alias minimum length', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'test3@example.com',
          alias: 'ab',  // Less than 3 characters
          password: 'password123'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should require all fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'test4@example.com'
          // Missing alias and password
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('User login', () => {
    const testUser = {
      email: 'logintest@example.com',
      alias: 'loginuser',
      password: 'password123'
    }

    beforeAll(async () => {
      // Register user for login tests
      await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser
      })
    })

    it('should login with valid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: testUser.password
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body).toHaveProperty('accessToken')
      expect(typeof body.accessToken).toBe('string')
    })

    it('should reject invalid password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: 'wrongpassword'
        }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject non-existent email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123'
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('Protected routes', () => {
    let accessToken: string

    beforeAll(async () => {
      const testUser = {
        email: 'protected@example.com',
        alias: 'protecteduser',
        password: 'password123'
      }

      // Register user
      await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser
      })

      // Login to get token
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: testUser.password
        }
      })

      accessToken = JSON.parse(loginResponse.payload).accessToken
    })

    it('should get users list with valid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(Array.isArray(body)).toBe(true)
    })

    it('should reject request without token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject request with invalid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should get current user profile', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body).toHaveProperty('id')
      expect(body.email).toBe('protected@example.com')
      expect(body.alias).toBe('protecteduser')
    })
  })
})
