import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, saveSession } from '../api'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ 
    name: '', email: '', mobile_number: '', 
    password: '', confirm_password: '', 
    college: '', country: '', bio: '' 
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Password validation state
  const passwordRules = [
    { label: 'Minimum 8 characters', regex: /.{8,}/ },
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
      const { access_token, user } = await api.signup(form)
      saveSession(access_token, user)
      navigate('/verify-email') // Go to verification stage
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl">
            Skill<span className="text-clay">Verse</span>
          </p>
          <p className="text-ink/50 text-sm mt-1">Create your profile</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="name" label="Full name" placeholder="Alex Johnson" value={form.name} onChange={(v) => update('name', v)} required />
            <Field id="email" label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={(v) => update('email', v)} required />
            <Field id="mobile_number" label="Mobile Number" type="tel" placeholder="+1234567890" value={form.mobile_number} onChange={(v) => update('mobile_number', v)} required />
            
            <div className="pt-1 pb-1 border-t border-line" />

            <Field id="college" label="College or organization" placeholder="Required" value={form.college} onChange={(v) => update('college', v)} required />
            <Field id="country" label="Country" placeholder="Optional" value={form.country} onChange={(v) => update('country', v)} />
            <Field id="bio" label="Bio" placeholder="Optional" value={form.bio} onChange={(v) => update('bio', v)} />

            <div className="pt-1 pb-1 border-t border-line" />

            <Field id="password" label="Password" type="password" placeholder="Strong password" value={form.password} onChange={(v) => update('password', v)} required />
            
            {/* Password Strength Indicator */}
            {form.password && (
              <div className="bg-sand/30 p-3 rounded-lg text-sm space-y-1">
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
