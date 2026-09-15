import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getSessionUser, saveSession } from '../api'

export default function Onboarding() {
  const navigate = useNavigate()
  const user = getSessionUser()
  const [mobileNumber, setMobileNumber] = useState('')
  const [college, setCollege] = useState('')
  const [country, setCountry] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If they somehow land here but aren't logged in
    if (!user) {
      navigate('/login')
    } else if (user.college && user.college.trim() !== '') {
      // If they already completed onboarding
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!college.trim()) {
      setError('College/Organization is required.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const updatedUser = await api.updateMe({
        mobile_number: mobileNumber,
        college: college,
        country: country
      })
      // Update local storage session with new user data
      const token = localStorage.getItem('skillverse_token')
      saveSession(token, updatedUser)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16 bg-surface">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-ink">Welcome to SkillVerse, {user.name}!</h1>
          <p className="text-ink/60 text-sm mt-2">Let's complete your profile to get started.</p>
        </div>

        <div className="card p-4 sm:p-6 sm:p-8 bg-white rounded-xl shadow-sm border border-line">
          {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Mobile Number</label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={e => setMobileNumber(e.target.value)}
                className="input-field w-full"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">College / Organization <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={college}
                onChange={e => setCollege(e.target.value)}
                className="input-field w-full"
                placeholder="Enter your college or organization"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Country</label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="input-field w-full"
                placeholder="Optional"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base mt-2"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
