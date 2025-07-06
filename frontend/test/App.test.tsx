import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import App from '../src/App'

// Mock the SVG and CSS imports
vi.mock('../src/assets/react.svg', () => ({
  default: 'react-logo.svg'
}))
vi.mock('/vite.svg', () => ({
  default: 'vite-logo.svg'
}))
vi.mock('../src/App.css', () => ({}))

describe('App Component', () => {
  // Setup and teardown
  beforeEach(() => {
    // Mock successful fetch response for GET request
    vi.spyOn(global, 'fetch').mockImplementation((url, options) => {
      if (url === '/api/counter' && !options?.method || options?.method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ value: 42 })
        }) as unknown as Promise<Response>
      }

      // Mock successful response for PUT request
      return Promise.resolve({
        ok: true
      }) as unknown as Promise<Response>
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render without crashing', async () => {
      let container;
      await act(async () => {
        ({ container } = render(<App />));
      });
      expect(container).toBeTruthy()
    })

    it('should display the correct headings', async () => {
      await act(async () => {
        render(<App />);
      });
      expect(screen.getByText('Hello world!')).toBeInTheDocument()
      expect(screen.getByText('Vite + React + Tailwind')).toBeInTheDocument()
    })

    it('should render the Vite and React logos', async () => {
      await act(async () => {
        render(<App />);
      });
      const viteLogoImg = screen.getByAltText('Vite logo')
      const reactLogoImg = screen.getByAltText('React logo')

      expect(viteLogoImg).toBeInTheDocument()
      expect(reactLogoImg).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      // Reset the fetch mock to a delayed resolution to ensure we see loading state
      vi.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ value: 42 })
            } as Response)
          }, 100)
        })
      })

      render(<App />)
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Loading...')
      expect(button).toBeDisabled()
    })

    it('should hide loading state after fetch completes', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      expect(screen.getByRole('button')).toHaveTextContent('count is 42')
    })

    it('should disable the button while loading', () => {
      // Reset the fetch mock to a delayed resolution to ensure we see loading state
      vi.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ value: 42 })
            } as Response)
          }, 100)
        })
      })

      render(<App />)
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Loading...')
      expect(button).toBeDisabled()
    })
  })

  describe('Counter Functionality', () => {
    it('should display the initial counter value from API', async () => {
      render(<App />)

      // Wait for the API call to resolve
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('count is 42')
      })
    })

    it('should increment counter when button is clicked', async () => {
      render(<App />)

      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('count is 42')
      })

      // Click the counter button
      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Check that count has incremented
      expect(screen.getByRole('button')).toHaveTextContent('count is 43')
    })

    it('should update the server with new counter value', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
      render(<App />)

      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('count is 42')
      })

      // Click the counter button
      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Check that fetch was called with the right parameters
      await waitFor(() => {
        const putCalls = fetchSpy.mock.calls.filter(([, options]) => options?.method === 'PUT')
        expect(putCalls.length).toBeGreaterThan(0)
        const [url, options] = putCalls[0]
        expect(url).toBe('/api/counter')
        expect(options).toMatchObject({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        // Parse the body and check it
        const body = JSON.parse(options?.body as string)
        expect(body).toEqual({ value: 43 })
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when initial fetch fails', async () => {
      // Mock console.error to suppress expected errors
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Override the mock to simulate a failed GET request with a proper response
      vi.spyOn(global, 'fetch').mockImplementationOnce(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        }) as unknown as Promise<Response>
      })

      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load counter from server')).toBeInTheDocument()
      })

      // Loading state should be removed even on error
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()

      // Verify error was logged (optional)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should display error message when update fails', async () => {
      // Mock console.error to suppress expected errors
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // First mock the GET request to succeed
      vi.spyOn(global, 'fetch').mockImplementation((_url, options) => {
        if (!options || !options.method || options.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ value: 42 })
          }) as unknown as Promise<Response>
        } else {
          // This is the PUT request - simulate a failed HTTP response rather than a rejected Promise
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
          }) as unknown as Promise<Response>
        }
      })

      render(<App />)

      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('count is 42')
      })

      // Click the counter button (which triggers the failing PUT request)
      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Check that error message appears
      await waitFor(() => {
        expect(screen.getByText('Failed to save counter to server')).toBeInTheDocument()
      })

      // The local counter should still increment even if the server update fails
      expect(screen.getByRole('button')).toHaveTextContent('count is 43')

      // Verify error was logged (optional)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })
})
