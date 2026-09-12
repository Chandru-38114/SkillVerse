import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  
  // Stages: 'request' (enter email) -> 'verify' (enter otp & new pass)
  const [stage, setStage] = useState('request')
  
  // Form fields
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-4 sm:px-6 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <SkillVerseLogo />
          <div className="mb-6 text-center"><p className="text-ink/50 text-sm">Password Recovery</p></div>

        <div className="card p-4 sm:p-6 sm:p-5 sm:p-8">
          {error && <p className="alert-error mb-4">{error}</p>}
          {message && <p className="p-3 text-sm bg-green-50 text-green-700 rounded-md mb-4 border border-green-200">{message}</p>}

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
                className="btn-primary w-full"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {stage === 'verify' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
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
              <div>
                <label className="field-label" htmlFor="otp">Enter 6-digit OTP</label>
                <input
                  id="otp"
                  className="input tracking-widest text-center text-lg"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
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
                disabled={loading || !otp || !newPassword}
                className="btn-primary w-full"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink/60">
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
