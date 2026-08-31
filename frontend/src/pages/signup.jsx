import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, saveSession } from '../api'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', college: '', country: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { access_token, user } = await api.signup(form)
      saveSession(access_token, user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="mb-8 text-center">
          <p className="font-display text-2xl">
            Skill<span className="text-clay">Verse</span>
          </p>
          <p className="text-ink/50 text-sm mt-1">Create your profile — takes 2 minutes</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="name" label="Full name" placeholder="Alex Johnson" value={form.name} onChange={(v) => update('name', v)} required />
            <Field id="email" label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={(v) => update('email', v)} required />
            <Field id="password" label="Password" type="password" placeholder="At least 8 characters" value={form.password} onChange={(v) => update('password', v)} required />

            <div className="pt-1 pb-1 border-t border-line" />

            <Field id="college" label="College or institution" placeholder="Optional" value={form.college} onChange={(v) => update('college', v)} />
            <Field id="country" label="Country" placeholder="Optional" value={form.country} onChange={(v) => update('country', v)} />

            {error && <p className="alert-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Creating account…' : 'Create account →'}
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
      <label className="field-label" htmlFor={id}>{label}</label>
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