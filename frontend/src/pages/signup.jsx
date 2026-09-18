import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import SkillVerseLogo from '../components/SkillVerseLogo'
import PasswordInput from '../components/PasswordInput'
import { api, saveSession } from '../api'
import { GoogleLogin } from '@react-oauth/google'

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

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <SkillVerseLogo />
        <div className="mb-6 text-center">
          <p className="text-ink/50 text-sm">
            {step === 1 ? 'Create your profile' : 'Verify your email'}
          </p>
        </div>

        <div className="card">
          {step === 1 && (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <Field id="name" label="Full name" placeholder="Alex Johnson" value={form.name} onChange={(v) => update('name', v)} required />
              <Field id="email" label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={(v) => update('email', v)} required />
              <Field id="mobile_number" label="Mobile Number" type="tel" placeholder="+1234567890" value={form.mobile_number} onChange={(v) => update('mobile_number', v)} required />
              
              <Field id="dob" label="Date of Birth" type="date" value={form.dob} onChange={(v) => update('dob', v)} required />
              <div>
                <label className="field-label">Gender<span className="text-clay ml-1">*</span></label>
                <select className="input" value={form.gender} onChange={(e) => update('gender', e.target.value)} required>
                  <option value="" disabled>Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="pt-1 pb-1 border-t border-line" />

              <Field id="college" label="College or organization" placeholder="Required" value={form.college} onChange={(v) => update('college', v)} required />
              <Field id="country" label="Country" placeholder="Optional" value={form.country} onChange={(v) => update('country', v)} />
              <Field id="bio" label="Bio" placeholder="Optional" value={form.bio} onChange={(v) => update('bio', v)} />

              <div className="pt-1 pb-1 border-t border-line" />

              <Field id="password" label="Password" type="password" placeholder="Strong password" value={form.password} onChange={(v) => update('password', v)} required />
              
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

              <Field id="confirm_password" label="Confirm Password" type="password" placeholder="Confirm password" value={form.confirm_password} onChange={(v) => update('confirm_password', v)} required />

              {error && <p className="alert-error">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-4">
                {loading ? 'Processing...' : 'Continue to Verification'}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="text-center space-y-6">
              <div className="bg-moss/10 text-moss w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">Verify your email</h2>
              <p className="text-ink/70">
                To complete your registration for <strong>{form.email}</strong>, please verify your email address using Google.
              </p>
              
              <div className="flex justify-center pt-4">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google verification failed. Please try again.')}
                  useOneTap={false}
                  text="continue_with"
                />
              </div>
              
              {error && <p className="alert-error mt-4">{error}</p>}
              
              <button 
                onClick={() => setStep(1)} 
                className="text-sm text-ink/50 hover:text-ink hover:underline mt-6 inline-block"
              >
                ← Back to edit details
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-ink/50 mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-moss font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}{required && <span className="text-clay ml-1">*</span>}</label>
      {type === 'password' ? (
        <PasswordInput
          id={id}
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          type={type}
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
