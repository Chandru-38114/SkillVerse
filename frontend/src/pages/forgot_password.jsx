import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import SkillVerseLogo from '../components/SkillVerseLogo'
import OTPInput from '../components/OTPInput'

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
      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message)
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <SkillVerseLogo />
        <div className="mb-6 text-center"><p className="text-ink/50 text-sm">Password Recovery</p></div>

        <div className="card p-5 sm:p-8">
          {error && <p className="alert-error mb-4">{error}</p>}
          {message && <p className="p-3 text-sm bg-moss/10 text-moss rounded-md mb-4 border border-moss/20 font-medium">{message}</p>}

          {stage === 'request' && (
            <form onSubmit={handleRequestOTP} className="space-y-5">
              <div>
                <label className="field-label" htmlFor="email">Registered Email</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="btn-primary w-full py-3"
              >
                {loading ? 'Sending OTP...' : 'Send Reset Code'}
              </button>
            </form>
          )}

          {stage === 'verify' && (
            <>
              {devOtp && (
                <div className="mb-6 p-4 border border-dashed border-clay rounded-md bg-clay/5 text-center">
                  <p className="text-xs font-semibold text-clay uppercase tracking-wider mb-2">Development OTP</p>
                  <p className="text-3xl font-display tracking-[0.2em] text-ink">{devOtp}</p>
                  <p className="text-xs text-ink/60 mt-2">Use this code to continue.</p>
                </div>
              )}
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                <label className="field-label text-ink/70" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="input bg-gray-50 text-ink/50"
                  type="email"
                  value={email}
                  disabled
                />
              </div>
              <div className="flex flex-col items-center">
                <label className="field-label w-full" htmlFor="otp">Enter 6-digit Code</label>
                <div className="w-full">
                  <OTPInput value={otp} onChange={setOtp} disabled={loading} />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="new_password">New Password</label>
                <input
                  id="new_password"
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length < 6 || !newPassword}
                className="btn-primary w-full py-3"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
            </>
          )}

          <p className="mt-6 pt-6 border-t border-line text-center text-sm text-ink/60">
            Remember your password?{' '}
            <Link to="/login" className="text-moss font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
