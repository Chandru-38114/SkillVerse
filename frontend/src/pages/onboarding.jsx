import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, getSessionUser, saveSession } from '../api'
import AuthShell, { Alert, AuthField, SelectField, TextAreaField, PwField, PasswordRules } from '../components/auth/AuthShell'

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

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
  }, [user?.id, navigate, onboardingToken])

  const passwordRules = [
    { label: 'Minimum 8 characters', regex: /.{8,}/ },
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

  const displayName = onboardingToken ? (form.name || 'there') : (user?.name || 'there')
  const collegeMissing = !!error && !form.college.trim()

  return (
    <AuthShell
      eyebrow="ALMOST THERE"
      title="Tell peers who you are."
      text="A complete profile helps the right learning partners find you."
      steps={['Sign in', 'Finish your profile', 'Find your first match']}
      current={1}
    >
      <form className="card" onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 620, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 64, height: 64, flex: 'none', borderRadius: 999, border: '2px solid #29251F', background: '#D2BEA0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, boxShadow: '0 4px 0 #29251F' }}>
            {(displayName || '?')[0].toUpperCase()}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
              {onboardingToken ? 'Complete your account' : `Welcome, ${displayName}!`}
            </h2>
            <span className="muted">Let’s finish setting up your profile.</span>
          </div>
        </div>

        {error && <Alert kind="err">{error}</Alert>}

        <div className="grp">
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>ABOUT YOU</span>
          <div className="row2">
            {onboardingToken
              ? <AuthField id="name" label="Full name" value={form.name} onChange={(v) => update('name', v)} required />
              : <AuthField id="name-locked" label="Full name" value={user?.name || ''} onChange={() => {}} disabled />}
            <AuthField id="mobile_number" label="Mobile Number" type="tel" placeholder="+91…" value={form.mobile_number} onChange={(v) => update('mobile_number', v)} />
          </div>
          <div className="row2">
            <AuthField id="dob" label="Date of Birth" type="date" value={form.dob} onChange={(v) => update('dob', v)} />
            <SelectField id="gender" label="Gender" value={form.gender} onChange={(v) => update('gender', v)} options={GENDERS} placeholder="Select Gender" />
          </div>
        </div>

        <div className="grp">
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>WHERE YOU LEARN</span>
          <div className="row2">
            <AuthField id="college" label="College / Organization" value={form.college} onChange={(v) => update('college', v)} invalid={collegeMissing} required />
            <AuthField id="country" label="Country" value={form.country} onChange={(v) => update('country', v)} />
          </div>
          <TextAreaField id="bio" label="Bio" placeholder="What you teach and what you’re learning" value={form.bio} onChange={(v) => update('bio', v)} />
        </div>

        {onboardingToken && (
          <div className="grp">
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>SECURITY · ONLY FOR GOOGLE SIGN-UPS</span>
            <div className="row2">
              <PwField id="password" label="Create Password" value={form.password} onChange={(v) => update('password', v)} required />
              <PwField id="confirm_password" label="Confirm Password" value={form.confirm_password} onChange={(v) => update('confirm_password', v)} invalid={!!form.confirm_password && form.password !== form.confirm_password} required />
            </div>
            {form.password && <PasswordRules rules={passwordRules} password={form.password} />}
          </div>
        )}

        <button type="submit" className="btn btn-p full" disabled={loading}>
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </AuthShell>
  )
}
