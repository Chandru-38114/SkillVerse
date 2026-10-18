import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, saveSession, prewarmServer } from '../api'
import AuthShell, { Alert, AuthField, PwField, GoogleButton } from '../components/auth/AuthShell'

export default function Login() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [waitSeconds, setWaitSeconds] = useState(0) // how long the current sign-in has taken

  useEffect(() => {
    prewarmServer()
  }, [])

  // Count the seconds while signing in, so a slow (sleeping) server shows a
  // live counter instead of a frozen button.
  useEffect(() => {
    if (!(loading || googleLoading)) return
    const started = Date.now()
    const timer = setInterval(() => setWaitSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => { clearInterval(timer); setWaitSeconds(0) }
  }, [loading, googleLoading])
  const slowServerMessage = (loading || googleLoading) && waitSeconds >= 5

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const isEmail = identifier.includes('@')
      const payload = {
        email: isEmail ? identifier : null,
        mobile_number: isEmail ? null : identifier,
        password
      }
      const { access_token, user } = await api.login(payload)
      saveSession(access_token, user)
      if (!user.is_email_verified) {
        navigate('/verify-email')
      } else if (!user.college || user.college.trim() === '') {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('')
    setGoogleLoading(true)
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
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="WELCOME BACK"
      title="Pick up where you left off."
      text="Your sessions, requests and progress are waiting for you."
      steps={['Check your requests', 'Join your next session', 'Keep your streak going']}
      current={-1}
    >
      <form className="card" onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 460, padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>Log in</h2>
          <span className="muted">Welcome back</span>
        </div>

        {error && <Alert kind="err">{error}</Alert>}
        {slowServerMessage && (
          <Alert kind="info">
            The server is waking up ({waitSeconds}s). It sleeps when nobody has used SkillVerse
            for a while and can take up to a minute to start. Please don't refresh — you'll be signed in automatically.
          </Alert>
        )}

        <AuthField
          id="identifier"
          label="Email or Mobile Number"
          placeholder="you@example.com or +1234567890"
          value={identifier}
          onChange={setIdentifier}
          invalid={!!error}
          disabled={loading || googleLoading}
          required
        />

        <PwField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          invalid={!!error}
          disabled={loading || googleLoading}
          required
          right={<Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 700 }}>Forgot password?</Link>}
        />

        <button type="submit" className="btn btn-p full" style={{ marginTop: 4 }} disabled={loading || googleLoading}>
          {loading ? 'Signing in…' : 'Log In'}
        </button>

        <div className="divider" style={{ marginTop: 6 }}>or</div>

        <GoogleButton
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Login failed')}
          label={googleLoading ? "Signing you in..." : "Continue with Google"}
          width={396}
          disabled={loading || googleLoading}
        />
      </form>

      <span style={{ fontSize: 15 }}>
        New to SkillVerse? <Link to="/signup" style={{ fontWeight: 800 }}>Create an account</Link>
      </span>
    </AuthShell>
  )
}
