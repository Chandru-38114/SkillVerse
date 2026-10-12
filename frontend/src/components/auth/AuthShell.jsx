import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import '../../pages/auth.css'

/*
 * The two-column auth shell from the AuthV2 design: a dark brand panel on the
 * left (hidden under 900px, where a small logo header takes over) and the form
 * area on the right. All five auth pages render through this.
 */
export default function AuthShell({ eyebrow, title, text, steps = [], current = -1, children }) {
  return (
    <div className="sv-auth">
      <aside className="side" style={{ flex: '0 0 44%', padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#FFFDF8', fontSize: 22, fontWeight: 900 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, border: '2px solid #FFFDF8', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M14 34 L14 18 C14 13 20 12 24 16 C28 20 34 19 34 14 L34 30" stroke="#29251F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 34 L24 44 L34 30" stroke="#29251F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          SkillVerse
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', zIndex: 1 }}>
          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px', borderRadius: 999, border: '2px solid #FFFDF8', color: '#FFFDF8', fontSize: 12, fontWeight: 800, letterSpacing: '.06em' }}>{eyebrow}</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(40px, 4.4vw, 60px)', lineHeight: 1.02, fontWeight: 900, letterSpacing: '-1.2px' }}>{title}</h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: '#D9CBB2', maxWidth: 440 }}>{text}</p>
          <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {steps.map((label, i) => {
              const done = i < current
              const now = i === current
              return (
                <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{
                    width: 34, height: 34, flex: 'none', borderRadius: 999, border: '2px solid #FFFDF8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14,
                    ...(now ? { background: 'var(--acc)', color: '#29251F' }
                      : done ? { background: '#FFFDF8', color: '#29251F' }
                        : { background: 'transparent', color: '#FFFDF8' }),
                  }}>{done ? '✓' : String(i + 1)}</span>
                  <span style={{ fontSize: 16, fontWeight: now ? 800 : 600, color: now ? '#FFFDF8' : '#D9CBB2' }}>{label}</span>
                </li>
              )
            })}
          </ol>
        </div>

        <span style={{ fontSize: 13, color: '#B9AE9C' }}>Your password is securely hashed and never shown to other learners.</span>

        <span className="stk" aria-hidden="true" style={{ right: 48, top: 120, width: 70, height: 70, borderRadius: 18, background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, transform: 'rotate(8deg)', '--rot': '8deg' }}>★</span>
        <span className="stk" aria-hidden="true" style={{ right: 120, bottom: 120, padding: '10px 14px', borderRadius: 12, background: '#D6F3EA', fontSize: 15, transform: 'rotate(-6deg)', '--rot': '-6deg' }}>Learn ⇄ Teach</span>
      </aside>

      <main style={{ flex: 1, padding: '48px clamp(16px, 5vw, 72px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <div className="mobhead" style={{ alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 900 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, border: '2px solid #29251F', background: 'var(--acc)', boxShadow: '0 3px 0 #29251F' }} />
          SkillVerse
        </div>
        {children}
      </main>
    </div>
  )
}

// ── Shared field pieces ──────────────────────────────────────────────────────

export function Alert({ kind = 'err', children }) {
  const icon = kind === 'ok' ? '✓' : kind === 'info' ? 'i' : '!'
  return (
    <div className={`alert a-${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <span className="ai">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

export function AuthField({ id, label, value, onChange, type = 'text', required = false, placeholder = '', invalid = false, disabled = false }) {
  return (
    <label className="f" htmlFor={id}>
      <span className="fl">{label}{required && <span className="req"> *</span>}</span>
      <input
        id={id}
        className={`in${invalid ? ' err' : ''}`}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { if (type === 'date' && e.target.showPicker) e.target.showPicker() }}
      />
    </label>
  )
}

export function SelectField({ id, label, value, onChange, required = false, options = [], placeholder = 'Select' }) {
  return (
    <label className="f" htmlFor={id}>
      <span className="fl">{label}{required && <span className="req"> *</span>}</span>
      <select id={id} className="in" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

export function TextAreaField({ id, label, value, onChange, placeholder = '' }) {
  return (
    <label className="f" htmlFor={id}>
      <span className="fl">{label}</span>
      <textarea id={id} className="in" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

const EyeIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {!open && <path d="M3 3l18 18" />}
  </svg>
)

export function PwField({ id, label, value, onChange, required = false, placeholder = '********', invalid = false, right = null, minLength }) {
  const [show, setShow] = useState(false)
  return (
    <label className="f" htmlFor={id}>
      <span className="fl" style={right ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } : undefined}>
        <span>{label}{required && <span className="req"> *</span>}</span>
        {right}
      </span>
      <span className="pw">
        <input
          id={id}
          className={`in${invalid ? ' err' : ''}`}
          type={show ? 'text' : 'password'}
          value={value}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={id === 'password' ? 'current-password' : 'new-password'}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(s => !s)}>
          <EyeIcon open={show} />
        </button>
      </span>
    </label>
  )
}

/*
 * Six boxed digits, as the design draws them. Same value/onChange contract as
 * the old OTPInput component, so the pages' logic did not change.
 */
export function OtpBoxes({ length = 6, value = '', onChange, disabled = false, invalid = false }) {
  const [digits, setDigits] = useState(Array(length).fill(''))
  const inputsRef = useRef([])

  useEffect(() => {
    if (value === '') setDigits(Array(length).fill(''))
  }, [value, length])

  const updateValue = (next) => {
    setDigits(next)
    onChange(next.join(''))
  }

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (digits[index] !== '') {
        next[index] = ''
        updateValue(next)
      } else if (index > 0) {
        next[index - 1] = ''
        updateValue(next)
        inputsRef.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleChange = (e, index) => {
    const val = e.target.value
    if (!/^\d*$/.test(val)) return
    const char = val.slice(-1)
    const next = [...digits]
    next[index] = char
    updateValue(next)
    if (char && index < length - 1) inputsRef.current[index + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = [...digits]
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    updateValue(next)
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }} onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputsRef.current[index] = el }}
          className={`in otp${invalid ? ' err' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={2}
          value={digit}
          disabled={disabled}
          autoComplete="one-time-code"
          aria-label={`Digit ${index + 1}`}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
        />
      ))}
    </div>
  )
}

const GLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12.1c-.2 2-1.5 5-4.4 7l-.1.3 6.4 5 .4.1c4.1-3.8 6.7-9.4 6.7-16z" />
    <path fill="#34A853" d="M24 46c5.9 0 10.8-1.9 14.4-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.5 2.2-5.8 0-10.7-3.8-12.4-9.1l-.3.1-6.6 5.1-.1.3C8.1 41 15.5 46 24 46z" />
    <path fill="#FBBC05" d="M11.6 28.5A13.6 13.6 0 0 1 10.8 24c0-1.6.3-3.1.8-4.5v-.3l-6.9-5.4-.2.1A22 22 0 0 0 2 24c0 3.5.9 6.9 2.5 9.9l7.1-5.4z" />
    <path fill="#EA4335" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.8 4.3 29.9 2 24 2 15.5 2 8.1 7 4.5 14.1l7.1 5.4C13.3 14.3 18.2 10.5 24 10.5z" />
  </svg>
)

/*
 * The design draws its own bordered "Continue with Google" button. Google's
 * real button is rendered inside an iframe and CANNOT be restyled, so the only
 * way to have both the design and the ID-token flow the backend expects is to
 * lay Google's button over ours, invisible, and let it take the click.
 *
 * `width` must be >= the rendered width of this button, or part of it will not
 * be clickable. Google caps it at 400px.
 */
export function GoogleButton({ onSuccess, onError, label = 'Continue with Google', width = 380, disabled = false }) {
  return (
    <div className="gbtn" style={{ position: 'relative', width: '100%' }}>
      <GLogo />
      {label}
      {!disabled && (
        <span
          style={{
            position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 10,
            opacity: 0.0001, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <GoogleLogin onSuccess={onSuccess} onError={onError} width={width} />
        </span>
      )}
    </div>
  )
}

export function PasswordRules({ rules, password }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 14px', padding: 14, borderRadius: 10, border: '2px solid #E2D3BB', background: '#F8F3E9' }} aria-live="polite">
      {rules.map((rule) => {
        const ok = rule.regex.test(password)
        return (
          <span className="rule" key={rule.label} style={ok ? undefined : { fontWeight: 800 }}>
            <span className="dot" style={{ background: ok ? '#D6F3EA' : '#FFFDF8' }}>{ok ? '✓' : '✕'}</span>
            {rule.label}
          </span>
        )
      })}
    </div>
  )
}
