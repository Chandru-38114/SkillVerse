import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import AuthShell, { Alert, AuthField, PwField, OtpBoxes } from '../components/auth/AuthShell'

export default function ForgotPassword() {
  const navigate = useNavigate()

  // Stages: 'request' (enter email) -> 'verify' (enter otp & new pass)
  const [stage, setStage] = useState('request')

  // Form fields
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequestOTP(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await api.forgotPassword(email)
      setMessage(res.detail || 'OTP sent.')
      if (res.dev_otp) {
        setDevOtp(res.dev_otp)
      }
      setStage('verify')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await api.resetPassword({ email, otp, new_password: newPassword })
      setMessage(res.detail || 'Password reset successful.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message)
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  const onStep2 = stage === 'verify'

  const Progress = () => (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ flex: 1, height: 6, borderRadius: 3, background: '#29251F' }} />
      <span style={{ flex: 1, height: 6, borderRadius: 3, background: onStep2 ? '#29251F' : '#E2D3BB' }} />
    </div>
  )

  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Locked out? It happens."
      text="Get a code by email and set a new password in two steps."
      steps={['Enter your email', 'Enter code + new password', 'Log in again']}
      current={onStep2 ? 1 : 0}
    >
      {!onStep2 ? (
        <form className="card" onSubmit={handleRequestOTP} style={{ width: '100%', maxWidth: 460, padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Progress />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>PASSWORD RECOVERY · STEP 1 OF 2</span>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Forgot your password?</h2>
            <span className="muted" style={{ fontSize: 15 }}>We’ll send a 6-digit code to your registered email.</span>
          </div>

          {error && <Alert kind="err">{error}</Alert>}

          <AuthField
            id="email"
            label="Registered Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            invalid={!!error}
            required
          />

          <button type="submit" className="btn btn-p full" disabled={loading || !email}>
            {loading ? 'Sending code…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form className="card" onSubmit={handleResetPassword} style={{ width: '100%', maxWidth: 460, padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Progress />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>PASSWORD RECOVERY · STEP 2 OF 2</span>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Set a new password</h2>
          </div>

          {message && <Alert kind="ok">{message}</Alert>}
          {error && <Alert kind="err">{error}</Alert>}

          {devOtp && (
            <Alert kind="info">
              <strong>Development OTP:</strong>{' '}
              <span style={{ font: "700 16px 'JetBrains Mono', ui-monospace, monospace" }}>{devOtp}</span> — use this code to continue.
            </Alert>
          )}

          <AuthField id="email-locked" label="Email" type="email" value={email} onChange={() => {}} disabled />

          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend className="fl" style={{ padding: '0 0 10px' }}>Enter 6-digit Code</legend>
            <OtpBoxes value={otp} onChange={setOtp} disabled={loading} invalid={!!error} />
          </fieldset>

          <PwField
            id="new_password"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            minLength={8}
            required
          />

          <button type="submit" className="btn btn-p full" disabled={loading || otp.length < 6 || !newPassword}>
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}

      <Link to="/login" style={{ fontSize: 14, fontWeight: 800 }}>← Back to Log In</Link>
    </AuthShell>
  )
}
