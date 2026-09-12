import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import SkillVerseLogo from '../components/SkillVerseLogo'
import { api, saveSession } from '../api'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ 
    name: '', email: '', mobile_number: '', dob: '', gender: '', 
    password: '', confirm_password: '', 
    college: '', country: '', bio: '' 
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Password validation state
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.")
      return
    }

    // Check all rules
    const isValid = passwordRules.every(r => r.regex.test(form.password))
    if (!isValid) {
      setError("Please satisfy all password rules.")
      return
    }

    setLoading(true)
    try {
      const { access_token, user, dev_otp } = await api.signup(form)
      saveSession(access_token, user)
      navigate('/verify-email', { state: { devOtp: dev_otp } }) // Go to verification stage
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
        <div className="mb-6 text-center"><p className="text-ink/50 text-sm">Create your profile</p></div>

        <div className="card p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
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
            
            {/* Password Strength Indicator */}
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
              {loading ? 'Creating account...' : 'Create account & Verify'}
            </button>
          </form>
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
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
