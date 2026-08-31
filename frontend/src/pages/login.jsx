import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, saveSession } from '../api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { access_token, user } = await api.login({ email, password })
      saveSession(access_token, user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="mb-8 text-center">
          <p className="font-display text-2xl">
            Skill<span className="text-clay">Verse</span>
          </p>
          <p className="text-ink/50 text-sm mt-1">Welcome back</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <p className="alert-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="text-sm text-ink/50 mt-6 text-center">
          New here?{' '}
          <Link to="/signup" className="text-moss font-medium hover:underline">
            Create a profile
          </Link>
        </p>
      </div>
    </div>
  )
}