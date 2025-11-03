import './index.css'

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('root')
  if (!app) return

  // Create the main app structure
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div class="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 class="text-4xl font-bold text-center text-gray-800 mb-8">
          ft_transcendence
        </h1>

        <div class="space-y-4">
          <div class="p-4 bg-blue-50 rounded-lg">
            <h2 class="text-xl font-semibold text-blue-800 mb-2">Counter Demo</h2>
            <div class="flex items-center justify-between">
              <button id="decrement" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">
                -
              </button>
              <span id="counter" class="text-3xl font-bold text-gray-800">0</span>
              <button id="increment" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition">
                +
              </button>
            </div>
            <div id="error" class="mt-2 text-red-600 text-sm hidden"></div>
          </div>

          <div class="p-4 bg-gray-50 rounded-lg">
            <h2 class="text-xl font-semibold text-gray-800 mb-2">Technologies</h2>
            <ul class="list-disc list-inside text-gray-600 space-y-1">
              <li>TypeScript</li>
              <li>Tailwind CSS</li>
              <li>Vite</li>
              <li>Fastify Backend</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `

  // Get DOM elements
  const counterEl = document.getElementById('counter')
  const incrementBtn = document.getElementById('increment')
  const decrementBtn = document.getElementById('decrement')
  const errorEl = document.getElementById('error')

  if (!counterEl || !incrementBtn || !decrementBtn || !errorEl) return

  let count = 0

  // Fetch initial counter value
  const fetchCounter = async () => {
    try {
      const response = await fetch('/api/counter')
      if (!response.ok) {
        throw new Error('Failed to fetch counter')
      }
      const data = await response.json()
      count = data.value
      counterEl.textContent = count.toString()
    } catch (err) {
      showError('Failed to load counter from server')
      console.error(err)
    }
  }

  // Update counter on server
  const updateCounter = async (newValue: number) => {
    try {
      const response = await fetch('/api/counter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      })
      if (!response.ok) {
        throw new Error('Failed to update counter')
      }
      count = newValue
      counterEl.textContent = count.toString()
      hideError()
    } catch (err) {
      showError('Failed to update counter on server')
      console.error(err)
    }
  }

  const showError = (message: string) => {
    errorEl.textContent = message
    errorEl.classList.remove('hidden')
  }

  const hideError = () => {
    errorEl.classList.add('hidden')
  }

  // Event listeners
  incrementBtn.addEventListener('click', () => {
    updateCounter(count + 1)
  })

  decrementBtn.addEventListener('click', () => {
    updateCounter(count - 1)
  })

  // Initialize
  fetchCounter()
})

