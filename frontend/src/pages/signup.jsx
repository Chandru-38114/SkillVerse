import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, saveSession } from '../api'
import AuthShell, { Alert, AuthField, SelectField, TextAreaField, PwField, PasswordRules, GoogleButton } from '../components/auth/AuthShell'

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

export default function Signup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1 = Form, 2 = Google Verification
  const [signupToken, setSignupToken] = useState(null)

  const [form, setForm] = useState({
    name: '', email: '', mobile_number: '', dob: '', gender: '',
    password: '', confirm_password: '',
    college: '', country: '', bio: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordRules = [
    { label: 'Minimum 6 characters', regex: /.{6,}/ },
    { label: 'One uppercase letter', regex: /[A-Z]/ },
    { label: 'One lowercase letter', regex: /[a-z]/ },
    { label: 'One number', regex: /\d/ },
    { label: 'One special character', regex: /[!@#$%^&*(),.?":{}|<>`]/ }
  ]

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleFormSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.")
      return
    }

    const isValid = passwordRules.every(r => r.regex.test(form.password))
    if (!isValid) {
      setError("Please satisfy all password rules.")
      return
    }

    setLoading(true)
    try {
      const res = await api.signup(form)
      setSignupToken(res.signup_token)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('')
    setLoading(true)
    try {
      const { access_token, user } = await api.verifyGoogleSignup(signupToken, credentialResponse.credential)
      saveSession(access_token, user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const mismatch = !!form.confirm_password && form.password !== form.confirm_password

  // ── Step 2: verify with Google ──
  if (step === 2) {
    return (
      <AuthShell
        eyebrow="JOIN THE EXCHANGE"
        title="One quick check."
        text="Verifying with Google confirms the email is really yours."
        steps={['Create your profile', 'Verify with Google', 'Take your first assessment']}
        current={1}
      >
        <div className="card" style={{ width: '100%', maxWidth: 480, padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
          <span style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 999, border: '2px solid #29251F', background: 'var(--accl)', fontSize: 12, fontWeight: 800 }}>Step 2 of 2</span>

          <span style={{ width: 76, height: 76, borderRadius: 20, border: '2px solid #29251F', background: 'var(--accl)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 0 #29251F', transform: 'rotate(-4deg)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8l7.9 5.3a2 2 0 0 0 2.2 0L21 8" />
              <rect x="3" y="5" width="18" height="14" rx="2" />
            </svg>
          </span>

          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Verify your email</h2>
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
            To complete your registration for <strong style={{ color: '#29251F' }}>{form.email}</strong>, please verify your email address using Google.
          </p>

          {error && <div style={{ width: '100%', textAlign: 'left' }}><Alert kind="err">{error}</Alert></div>}

          <div style={{ width: '100%', maxWidth: 320 }}>
            <GoogleButton
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google verification failed. Please try again.')}
              label="Verify with Google"
              width={320}
            />
          </div>

          <button type="button" onClick={() => setStep(1)} style={{ fontSize: 14, fontWeight: 800, background: 'transparent', border: 'none', cursor: 'pointer', color: '#29251F' }}>
            ← Back to edit details
          </button>
        </div>
      </AuthShell>
    )
  }

  // ── Step 1: the profile form ──
  return (
    <AuthShell
      eyebrow="JOIN THE EXCHANGE"
      title="Teach what you know. Learn what you need."
      text="Create your profile in about a minute."
      steps={['Create your profile', 'Verify with Google', 'Take your first assessment']}
      current={0}
    >
      <form className="card" onSubmit={handleFormSubmit} style={{ width: '100%', maxWidth: 620, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>Create your profile</h2>
            <span className="muted">Fields marked <span className="req">*</span> are required.</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 999, border: '2px solid #29251F', background: 'var(--accl)', fontSize: 12, fontWeight: 800 }}>Step 1 of 2</span>
        </div>

        {error && <Alert kind="err">{error}</Alert>}

        <div className="grp">
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>ABOUT YOU</span>
          <AuthField id="name" label="Full name" placeholder="Alex Johnson" value={form.name} onChange={(v) => update('name', v)} required />
          <div className="row2">
            <AuthField id="email" label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={(v) => update('email', v)} required />
            <AuthField id="mobile_number" label="Mobile Number" type="tel" placeholder="+1234567890" value={form.mobile_number} onChange={(v) => update('mobile_number', v)} required />
          </div>
          <div className="row2">
            <AuthField id="dob" label="Date of Birth" type="date" value={form.dob} onChange={(v) => update('dob', v)} required />
            <SelectField id="gender" label="Gender" value={form.gender} onChange={(v) => update('gender', v)} options={GENDERS} placeholder="Select Gender" required />
          </div>
        </div>

        <div className="grp">
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>WHERE YOU LEARN</span>
          <div className="row2">
            <AuthField id="college" label="College or organization" placeholder="Required" value={form.college} onChange={(v) => update('college', v)} required />
            <AuthField id="country" label="Country" placeholder="Optional" value={form.country} onChange={(v) => update('country', v)} />
          </div>
          <TextAreaField id="bio" label="Bio" placeholder="Optional — what you teach and what you’re learning" value={form.bio} onChange={(v) => update('bio', v)} />
        </div>

        <div className="grp">
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#6E6455' }}>SECURITY</span>
          <div className="row2">
            <PwField id="password" label="Password" value={form.password} onChange={(v) => update('password', v)} required />
            <PwField id="confirm_password" label="Confirm Password" value={form.confirm_password} onChange={(v) => update('confirm_password', v)} invalid={mismatch} required />
          </div>
          {form.password && <PasswordRules rules={passwordRules} password={form.password} />}
        </div>

        <button type="submit" className="btn btn-p full" disabled={loading}>
          {loading ? 'Processing…' : 'Continue to verification'}
        </button>
      </form>

      <span style={{ fontSize: 15 }}>
        Already have an account? <Link to="/login" style={{ fontWeight: 800 }}>Log in</Link>
      </span>
    </AuthShell>
  )
}
