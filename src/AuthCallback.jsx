import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, LoaderCircle } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '/api' : '')).replace(/\/+$/, '')
const messages = {
  google_cancelled: 'Google sign-in was cancelled. You can try again or use email or phone instead.',
  invalid_state: 'This sign-in attempt expired or could not be verified. Please start again.',
  oauth_unavailable: 'Google sign-in is temporarily unavailable. Please try another sign-in method or try again later.',
  google_failed: 'Google could not complete sign-in. Please try again.',
  account_unavailable: 'This account is not active. Contact support if you believe this is a mistake.'
}

async function readResponse(response) {
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) throw new Error('Unexpected sign-in service response.')
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data.error || `Sign-in failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

function safePostAuthPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/profile'
  try {
    const url = new URL(path, window.location.origin)
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/profile'
  } catch {
    return '/profile'
  }
}

export default function AuthCallback({ setUser }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const processed = useRef(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const code = new URLSearchParams(window.location.hash.slice(1)).get('code')
  const oauthError = params.get('oauth_error')

  useEffect(() => {
    if (processed.current) return
    processed.current = true
    window.history.replaceState(window.history.state, '', window.location.pathname)

    const fail = message => {
      localStorage.removeItem('campuskart-token')
      localStorage.removeItem('campuskart-user')
      setUser(null)
      setError(message)
      setBusy(false)
    }
    if (oauthError) {
      fail(messages[oauthError] || 'Google sign-in could not be completed. Please try again.')
      return
    }
    if (!code) {
      fail('This sign-in link is missing its one-time code. Please start sign-in again.')
      return
    }

    localStorage.removeItem('campuskart-token')
    localStorage.removeItem('campuskart-user')
    setUser(null)
    fetch(`${API_BASE}/auth/google/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
      .then(readResponse)
      .then(data => {
        if (typeof data.token !== 'string' || !data.token || !data.user ||
            typeof data.user.id !== 'string' || !data.user.id ||
            typeof data.user.name !== 'string' || !data.user.name || data.user.status !== 'active') {
          throw new Error('The sign-in response could not be validated.')
        }
        localStorage.setItem('campuskart-token', data.token)
        localStorage.setItem('campuskart-user', JSON.stringify(data.user))
        const requested = sessionStorage.getItem('campuskart-after-auth')
        sessionStorage.removeItem('campuskart-after-auth')
        setUser(data.user)
        nav(requested ? safePostAuthPath(requested) : '/profile', { replace: true })
      })
      .catch(exchangeError => {
        if (exchangeError instanceof TypeError) fail('We could not reach the sign-in service. Check your connection and try again.')
        else if (exchangeError.status === 503) fail('The sign-in service is temporarily unavailable. Please try again later.')
        else if (exchangeError.status === 401) fail('This sign-in code has expired or was already used. Please start sign-in again.')
        else if (exchangeError.status === 403) fail('This account is not active. Contact support if you believe this is a mistake.')
        else fail('We could not validate this sign-in. Please try again.')
      })
  }, [code, oauthError, nav, setUser])

  return <div className="oauth-callback-page"><div className="oauth-callback-panel">
    {busy
      ? <><LoaderCircle size={20} className="oauth-callback-spinner" aria-hidden="true"/><h1>Confirming your sign-in</h1><p>Your account is not signed in until the server confirms it.</p></>
      : <><span className="eyebrow">Sign-in needs attention</span><h1>We couldn’t complete that.</h1><div role="alert" className="notice notice-error mt-4"><AlertCircle size={18}/><div className="notice-copy"><span>{error}</span></div></div><div className="oauth-callback-actions"><Link to="/login" className="button-dark px-4 py-3 text-sm font-semibold">Try again</Link><Link to="/" className="button-outline px-4 py-3 text-sm font-semibold">Return home</Link></div></>}
  </div></div>
}
