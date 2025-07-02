import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial counter value when component mounts
  useEffect(() => {
    const fetchCounter = async () => {
      try {
        const response = await fetch('/api/counter')
        if (!response.ok) {
          throw new Error('Failed to fetch counter')
        }
        const data = await response.json()
        setCount(data.value)
      } catch (err) {
        setError('Failed to load counter from server')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCounter()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Tailwind example from tutorial */}
      <h1 className="text-3xl font-bold underline text-blue-500 mb-8">
        Hello world!
      </h1>

      {/* Original content with some Tailwind classes */}
      <div className="flex justify-center gap-8 mb-6">
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo h-24" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react h-24" alt="React logo" />
        </a>
      </div>
      <h1 className="text-2xl font-semibold mb-4">Vite + React + Tailwind</h1>
      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg shadow-md mb-4">
        <button
          onClick={async () => {
            const newCount = count + 1;
            setCount(newCount);

            try {
              const response = await fetch('/api/counter', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ value: newCount }),
              });

              if (!response.ok) {
                throw new Error('Failed to update counter on server');
              }
            } catch (err) {
              setError('Failed to save counter to server');
              console.error(err);
            }
          }}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md mb-4 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : `count is ${count}`}
        </button>
        <p className="text-gray-700 dark:text-gray-300">
          Edit <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">src/App.tsx</code> and save to test HMR
        </p>
        {error && (
          <p className="text-red-500 mt-2">{error}</p>
        )}
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App
