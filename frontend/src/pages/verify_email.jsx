import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, getSessionUser, saveSession, getToken } from '../api'
import AuthShell, { Alert, OtpBoxes } from '../components/auth/AuthShell'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getSessionUser()
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!user || !getToken()) {
      navigate('/login')
    } else if (user.is_email_verified) {
      navigate('/dashboard')
    }
  }, [user?.id, navigate])

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  async function handleRequestOTP() {
    if (cooldown > 0) return
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await api.requestEmailVerification()
      setMessage(res.detail || 'OTP sent to your email.')
      if (res.dev_otp) {
        setDevOtp(res.dev_otp)
      }
      setCooldown(60)
    } catch (err) {
      setError(err.message)
      if (err.message.includes('60 seconds')) setCooldown(60)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await api.confirmEmailVerification(otp)
      setMessage(res.detail || 'Email verified successfully.')
      const updatedUser = { ...user, is_email_verified: true }
      saveSession(getToken(), updatedUser)
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.message)
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <AuthShell
      eyebrow="ALMOST IN"
      title="Confirm it’s you."
      text="Enter the 6-digit code we emailed you to unlock your account."
      steps={['Log in', 'Verify your email', 'Go to your dashboard']}
      current={1}
    >
      <form className="card" onSubmit={handleVerify} style={{ width: '100%', maxWidth: 480, padding: 36, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <span style={{ width: 64, height: 64, borderRadius: 16, border: '2px solid #29251F', background: 'var(--accl)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 0 #29251F' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8l7.9 5.3a2 2 0 0 0 2.2 0L21 8" />
            <rect x="3" y="5" width="18" height="14" rx="2" />
          </svg>
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Verify your email</h2>
          <span className="muted" style={{ fontSize: 15 }}>
            We sent a verification code to <strong style={{ color: '#29251F' }}>{user.email}</strong>
          </span>
        </div>

        {devOtp && (
          <Alert kind="info">
            <strong>Development OTP</strong><br />
            <span style={{ font: "700 18px 'JetBrains Mono', ui-monospace, monospace" }}>{devOtp}</span><br />
            <span style={{ fontSize: 13 }}>Use this code to continue.</span>
          </Alert>
        )}

        {error && <Alert kind="err">{error}</Alert>}
        {message && <Alert kind="ok">{message}</Alert>}

        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <legend className="fl" style={{ padding: '0 0 10px' }}>Enter 6-digit code</legend>
          <OtpBoxes value={otp} onChange={setOtp} disabled={loading} invalid={!!error} />
        </fieldset>

        <button type="submit" className="btn btn-p full" disabled={loading || otp.length < 6}>
          {loading ? 'Verifying…' : 'Verify email'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, fontSize: 14, flexWrap: 'wrap' }}>
          <span className="muted">Didn’t receive the code?</span>
          <button
            type="button"
            onClick={handleRequestOTP}
            disabled={loading || cooldown > 0}
            style={{ fontWeight: 800, background: 'transparent', border: 'none', cursor: cooldown > 0 ? 'not-allowed' : 'pointer', color: cooldown > 0 ? '#6E6455' : '#29251F', padding: 0 }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
