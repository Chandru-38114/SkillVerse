import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, getSessionUser, saveSession } from '../api'
import PasswordInput from '../components/PasswordInput'

export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getSessionUser()
  const onboardingToken = location.state?.onboardingToken

  const [form, setForm] = useState({
    name: '', mobile_number: '', college: '', country: '', 
    dob: '', gender: '', bio: '', password: '', confirm_password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!onboardingToken) {
      if (!user) {
        navigate('/login')
      } else if (user.college && user.college.trim() !== '') {
        navigate('/dashboard')
      }
    }
  }, [user, navigate, onboardingToken])

  const passwordRules = [
    { label: 'Minimum 6 characters', regex: /.{6,}/ },
    { label: 'One uppercase letter', regex: /[A-Z]/ },
    { label: 'One lowercase letter', regex: /[a-z]/ },
    { label: 'One number', regex: /\d/ },
    { label: 'One special character', regex: /[!@#$%^&*(),.?":{}|<>`]/ }
  ]

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (onboardingToken) {
      if (form.password !== form.confirm_password) {
        setError("Passwords do not match.")
        return
      }
      const isValid = passwordRules.every(r => r.regex.test(form.password))
      if (!isValid) {
        setError("Please satisfy all password rules.")
        return
      }
    }

    if (!form.college.trim()) {
      setError('College/Organization is required.')
      return
    }
    
    setError('')
    setLoading(true)
    
    try {
      if (onboardingToken) {
        const { access_token, user: newUser } = await api.completeGoogle(onboardingToken, form)
        saveSession(access_token, newUser)
        navigate('/dashboard')
      } else {
        const updatedUser = await api.updateMe({
          mobile_number: form.mobile_number,
          college: form.college,
          country: form.country,
          dob: form.dob,
          gender: form.gender,
          bio: form.bio
        })
        const token = localStorage.getItem('skillverse_token')
        saveSession(token, updatedUser)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!user && !onboardingToken) return null

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16 bg-surface">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-ink">
            {onboardingToken ? 'Complete your account' : `Welcome, ${user?.name}!`}
          </h1>
          <p className="text-ink/60 text-sm mt-2">Let's finish setting up your profile.</p>
        </div>

        <div className="card p-4 sm:p-6 sm:p-8 bg-white rounded-xl shadow-sm border border-line">
          {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {onboardingToken && (
              <Field id="name" label="Full name" value={form.name} onChange={(v) => update('name', v)} required />
            )}
            
            <Field id="mobile_number" label="Mobile Number" type="tel" value={form.mobile_number} onChange={(v) => update('mobile_number', v)} />
            <Field id="college" label="College / Organization" value={form.college} onChange={(v) => update('college', v)} required />
            
            <Field id="dob" label="Date of Birth" type="date" value={form.dob} onChange={(v) => update('dob', v)} />
            <div>
              <label className="field-label">Gender</label>
              <select className="input" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="" disabled>Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            
            <Field id="country" label="Country" value={form.country} onChange={(v) => update('country', v)} />
            <Field id="bio" label="Bio" value={form.bio} onChange={(v) => update('bio', v)} />

            {onboardingToken && (
              <>
                <div className="pt-2 pb-2 border-t border-line" />
                <Field id="password" label="Create Password" type="password" value={form.password} onChange={(v) => update('password', v)} required />
                
                {form.password && (
                  <div className="bg-paper/80 border border-line p-3 rounded-lg text-sm space-y-1">
                    {passwordRules.map((rule, idx) => (
                      <div key={idx} className={`flex items-center space-x-2 ${rule.regex.test(form.password) ? 'text-moss' : 'text-ink/40'}`}>
                        <span>{rule.regex.test(form.password) ? '✓' : '○'}</span>
                        <span>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <Field id="confirm_password" label="Confirm Password" type="password" value={form.confirm_password} onChange={(v) => update('confirm_password', v)} required />
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-base mt-4">
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}{required && <span className="text-clay ml-1">*</span>}</label>
      {type === 'password' ? (
        <PasswordInput id={id} value={value} required={required} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="input" type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
