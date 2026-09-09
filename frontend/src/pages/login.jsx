import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
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

  async function handleGoogleSuccess(credentialResponse) {
    try {
      const { access_token, user } = await api.googleAuth(credentialResponse.credential)
      saveSession(access_token, user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Google authentication failed')
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-16">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="mb-8 text-center">
          <p className="font-display text-2xl">
            Skill<span className="text-clay">Verse</span>
          </p>
          <p className="text-ink/50 text-sm mt-1">Welcome back</p>
        </div>

        <div className="card p-6 sm:p-8">
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
              <div className="flex justify-between items-center mb-1">
                <label className="field-label mb-0" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="text-xs text-moss hover:underline">
                  Forgot Password?
                </Link>
              </div>
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-6 relative">
              <hr className="w-full border-line" />
              <span className="px-3 text-xs text-ink/40 bg-white absolute left-1/2 -translate-x-1/2">OR</span>
            </div>
            
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login failed')}
              useOneTap
              theme="outline"
              size="large"
              shape="pill"
            />
          </div>

          <p className="mt-6 text-center text-sm text-ink/60">
            Don't have an account?{' '}
            <Link to="/signup" className="text-moss font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}