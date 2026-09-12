import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SkillVerseLogo from '../components/SkillVerseLogo'
import { api, getSessionUser, saveSession, getToken } from '../api'

export default function VerifyMobile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(getSessionUser())

  useEffect(() => {
    const handleUpdate = () => setUser(getSessionUser())
    window.addEventListener('skillverse_user_updated', handleUpdate)
    return () => window.removeEventListener('skillverse_user_updated', handleUpdate)
  }, [])
  const [otp, setOtp] = useState('')
  const [newMobile, setNewMobile] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!user || !getToken()) {
      navigate('/login')
    } else if (user.is_mobile_verified) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  async function handleUpdateMobile(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const updatedUser = await api.updateMe({ mobile_number: newMobile })
      saveSession(getToken(), updatedUser)
      window.dispatchEvent(new Event('skillverse_user_updated'))
      setMessage('Mobile number updated. You can now request an OTP.')
      // After updating, we can clear newMobile or let it stay to show we updated it.
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestOTP() {
    if (cooldown > 0) return
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await api.requestMobileVerification()
      setMessage(res.detail || 'OTP sent via SMS.')
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
      const res = await api.confirmMobileVerification(otp)
      setMessage(res.detail || 'Mobile verified successfully.')
      const updatedUser = await api.me()
      saveSession(getToken(), updatedUser)
      window.dispatchEvent(new Event('skillverse_user_updated'))
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  if (!user.mobile_number) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <SkillVerseLogo />
          <div className="card p-5 sm:p-8 text-center">
            <h2 className="text-2xl font-display mb-2">Complete your profile</h2>
            <p className="text-ink/60 mb-6 text-sm">
              Please enter your mobile number to proceed with verification.
            </p>
            {error && <p className="alert-error mb-4">{error}</p>}
            {message && <p className="p-3 bg-moss/10 text-moss rounded-md mb-4 text-sm">{message}</p>}
            <form onSubmit={handleUpdateMobile} className="space-y-4">
              <div>
                <input
                  className="input w-full text-center tracking-wider text-lg"
                  type="text"
                  placeholder="+1234567890"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading || !newMobile} className="btn-primary w-full py-3">
                {loading ? 'Saving...' : 'Save Mobile Number'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <SkillVerseLogo />
        <div className="card p-5 sm:p-8 text-center">
        <h2 className="text-2xl font-display mb-2">Verify your mobile</h2>
        <p className="text-ink/60 mb-6 text-sm">
          We need to verify your mobile number {user.mobile_number} before you can continue.
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
            {loading ? 'Verifying...' : 'Verify Mobile'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-line">
          <p className="text-sm text-ink/60 mb-3">Didn't receive the SMS?</p>
          <button 
            onClick={handleRequestOTP} 
            disabled={loading || cooldown > 0} 
            className="btn-secondary w-full"
          >
            {cooldown > 0 ? "Resend SMS in " + cooldown + "s" : 'Send SMS'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

