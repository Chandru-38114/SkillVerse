import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import SkillVerseLogo from '../components/SkillVerseLogo'
import PasswordInput from '../components/PasswordInput'
import { GoogleLogin } from '@react-oauth/google'
import { api, saveSession } from '../api'

export default function Login() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    console.log('[LOGIN] handleSubmit triggered, preventing default')
    setError('')
    setLoading(true)
    try {
      const isEmail = identifier.includes('@')
      const payload = {
        email: isEmail ? identifier : null,
        mobile_number: isEmail ? null : identifier,
        password
      }
      console.log('[LOGIN] Payload prepared, calling api.login...')
      const { access_token, user } = await api.login(payload)
      console.log('[LOGIN] api.login succeeded, saving session...')
      saveSession(access_token, user)
      if (!user.is_email_verified) {
        console.log('[LOGIN] Navigating to /verify-email')
        navigate('/verify-email')
      } else {
        console.log('[LOGIN] Navigating to /dashboard')
        if (!user.college || user.college.trim() === '') {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }
      }
    } catch (err) {
      console.error('[LOGIN] Error caught in handleSubmit:', err)
      setError(err.message || 'Login failed')
    } finally {
      console.log('[LOGIN] Finally block reached, setting loading false')
      setLoading(false)
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    try {
      const res = await api.googleAuth(credentialResponse.credential)
      
      if (res.onboarding_required) {
        navigate('/onboarding', { state: { onboardingToken: res.onboarding_token } })
      } else {
        const { access_token, user } = res
        saveSession(access_token, user)
        if (!user.college || user.college.trim() === '') {
          navigate('/onboarding')
        } else {
          navigate('/dashboard')
        }
      }
    } catch (err) {
      setError(err.message || 'Google authentication failed')
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-4 sm:px-6 py-10 sm:py-16">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <SkillVerseLogo />
        <div className="mb-6 text-center"><p className="text-ink/50 text-sm">Welcome back</p></div>

        <div className="card p-4 sm:p-6 sm:p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label" htmlFor="identifier">Email or Mobile Number</label>
              <input
                id="identifier"
                className="input"
                type="text"
                placeholder="you@example.com or +1234567890"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="field-label mb-0" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="text-xs text-moss hover:underline">
                  Forgot Password?
                </Link>
              </div>
                <PasswordInput
                  id="password"
                  placeholder="********"
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