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
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-1">Create your profile</h1>
      <p className="text-ink/60 mb-8 text-sm">You'll assess a skill right after this.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" value={form.name} onChange={(v) => update('name', v)} required />
        <Field label="Email" type="email" value={form.email} onChange={(v) => update('email', v)} required />
        <Field label="Password" type="password" value={form.password} onChange={(v) => update('password', v)} required />
        <Field label="College (optional)" value={form.college} onChange={(v) => update('college', v)} />
        <Field label="Country (optional)" value={form.country} onChange={(v) => update('country', v)} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="text-sm text-ink/50 mt-6">
        Already have an account? <Link to="/login" className="text-moss font-medium">Log in</Link>
      </p>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="label-eyebrow block mb-1.5">{label}</span>
      <input
        className="input"
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}