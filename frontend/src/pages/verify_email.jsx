import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SkillVerseLogo from '../components/SkillVerseLogo'
import { api, getSessionUser, saveSession, getToken } from '../api'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const user = getSessionUser()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!user || !getToken()) {
      navigate('/login')
    } else if (user.is_email_verified) {
      navigate('/verify-mobile')
    }
  }, [user, navigate])

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
      setTimeout(() => navigate('/verify-mobile'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <SkillVerseLogo />
        <div className="card p-5 sm:p-8 text-center">
        <h2 className="text-2xl font-display mb-2">Verify your email</h2>
        <p className="text-ink/60 mb-6 text-sm">
          We need to verify your email address before you can continue.
        </p>

        {error && <p className="alert-error mb-4">{error}</p>}
        {message && <p className="p-3 bg-moss/10 text-moss rounded-md mb-4 text-sm">{message}</p>}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <input
              className="input text-center tracking-widest text-lg"
              type="text"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading || !otp} className="btn-primary w-full py-3">
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-line">
          <p className="text-sm text-ink/60 mb-3">Didn't receive the code?</p>
          <button 
            onClick={handleRequestOTP} 
            disabled={loading || cooldown > 0} 
            className="btn-secondary w-full"
          >
            {cooldown > 0 ? "Resend OTP in " + cooldown + "s" : 'Send OTP'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

