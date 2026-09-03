import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'))
  }, [])

  return (
    <section id="center">
      <h1>MoneyControl</h1>
      <p>
        API status:{' '}
        {apiStatus === 'checking' && 'checking...'}
        {apiStatus === 'ok' && '✅ connected'}
        {apiStatus === 'error' && '❌ unreachable'}
      </p>
    </section>
  )
}

export default App
