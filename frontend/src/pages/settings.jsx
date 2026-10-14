import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getSessionUser, getToken, saveSession, api } from '../api'
import './settings.css'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']

const NAV = [
  { id: 'sv-sec-profile', icon: '👤', label: 'Profile' },
  { id: 'sv-sec-security', icon: '🔒', label: 'Security' },
  { id: 'sv-sec-appearance', icon: '🎨', label: 'Appearance' },
  { id: 'sv-sec-notifications', icon: '🔔', label: 'Notifications' },
  { id: 'sv-sec-about', icon: 'ⓘ', label: 'About' },
]

const PW_RULES = [
  { label: 'At least 8 characters', regex: /.{8,}/ },
  { label: 'Upper & lower case', regex: /(?=.*[a-z])(?=.*[A-Z])/ },
  { label: 'One number', regex: /\d/ },
  { label: 'One symbol (e.g. ! @ # - _)', regex: /[^A-Za-z0-9]/ },
]

export default function Settings() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system')
  const [user, setUser] = useState(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState("")

  // Profile update form
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [college, setCollege] = useState("");
  const [country, setCountry] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [activeNav, setActiveNav] = useState('sv-sec-profile')
  const initialRef = useRef(null)

  const resetForm = (u) => {
    if (!u) return;
    const snapshot = {
      name: u.name || "", bio: u.bio || "", mobile_number: u.mobile_number || "",
      college: u.college || "", country: u.country || "", dob: u.dob || "", gender: u.gender || "",
    }
    setName(snapshot.name);
    setBio(snapshot.bio);
    setMobileNumber(snapshot.mobile_number);
    setCollege(snapshot.college);
    setCountry(snapshot.country);
    setDob(snapshot.dob);
    setGender(snapshot.gender);
    initialRef.current = snapshot
    setProfileMsg("");
  };

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    resetForm(u);
  }, [])

  useEffect(() => {
    // Apply theme
    const root = window.document.documentElement

    if (theme === 'system') {
      localStorage.removeItem('theme')
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    } else {
      localStorage.setItem('theme', theme)
      if (theme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const u = await api.updateMe({
        name,
        bio,
        college,
        country,
        mobile_number: mobileNumber,
        dob: dob || null,
        gender: gender || null
      });
      setUser(u);
      resetForm(u);
      // Persist so the navbar and a re-opened Settings page show the new values.
      saveSession(getToken(), u);
      window.dispatchEvent(new Event('skillverse_user_updated'));
      setProfileMsg("Profile updated successfully.");
    } catch (err) {
      setProfileMsg("Error: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setSavingPassword(true)
    setPasswordMsg("")
    try {
      await api.changePassword(currentPassword, newPassword)
      setPasswordMsg("Password updated successfully.")
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      setPasswordMsg("Error: " + err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarMsg("");
    try {
      const u = await api.uploadAvatar(file);
      setUser(u);
      setAvatarMsg("Avatar updated.");
    } catch (err) {
      setAvatarMsg("Error: " + err.message);
    } finally {
      setUploadingAvatar(false);
      e.target.value = null;
    }
  };

  const handleAvatarRemove = async () => {
    setRemovingAvatar(true);
    setAvatarMsg("");
    try {
      const u = await api.removeAvatar();
      setUser(u);
      setAvatarMsg("Avatar removed.");
    } catch (err) {
      setAvatarMsg("Error: " + err.message);
    } finally {
      setRemovingAvatar(false);
      setConfirmRemove(false);
    }
  };

  const goTo = (id) => {
    setActiveNav(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const init = initialRef.current
  const dirty = !!init && (
    name !== init.name || bio !== init.bio || mobileNumber !== init.mobile_number ||
    college !== init.college || country !== init.country || dob !== init.dob || gender !== init.gender
  )

  const savedOk = profileMsg && !profileMsg.startsWith('Error')
  const saveErr = profileMsg && profileMsg.startsWith('Error')

  const SectionHead = ({ id, title, sub }) => (
    <div style={{ padding: '20px 26px', borderBottom: '2px solid #29251F', background: '#F0E5D2' }}>
      <h2 id={id} style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{title}</h2>
      {sub && <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>{sub}</span>}
    </div>
  )

  return (
    <div className="sv-settings">
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 28 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/profile" aria-label="Back to profile" style={{ width: 42, height: 42, borderRadius: 10, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 0 #29251F', textDecoration: 'none', fontWeight: 900 }}>‹</Link>
          <div>
            <span className="eb">ACCOUNT</span>
            <h1 style={{ margin: '2px 0 0', fontSize: 44, fontWeight: 900, lineHeight: 1 }}>Settings</h1>
          </div>
        </div>

        <div className="layout">
          <nav className="nav" aria-label="Settings sections" style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'sticky', top: 24 }}>
            {NAV.map(n => (
              <button
                key={n.id}
                type="button"
                className={activeNav === n.id ? 'on' : ''}
                aria-current={activeNav === n.id ? 'true' : undefined}
                onClick={() => goTo(n.id)}
              >
                <span aria-hidden="true">{n.icon}</span>{n.label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, minWidth: 0 }}>

            {/* PROFILE */}
            <section className="card" aria-labelledby="sv-sec-profile" style={{ overflow: 'hidden' }}>
              <SectionHead id="sv-sec-profile" title="Profile" sub="Shown to learning partners on Discover and your profile." />

              <div className="avr" style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: '2px dashed #E2D3BB' }}>
                <span style={{
                  width: 92, height: 92, flex: 'none', borderRadius: 999, border: '3px solid #29251F',
                  background: user?.profile_picture_url ? `#D2BEA0 url(${user.profile_picture_url}) center/cover no-repeat` : '#D2BEA0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 900, boxShadow: '0 4px 0 #29251F'
                }}>
                  {user?.profile_picture_url ? '' : (user?.name || '?')[0].toUpperCase()}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <strong>Profile photo</strong>
                  <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>JPG or PNG, square works best.</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label className="btn btn-s" style={{ minHeight: 40, position: 'relative', overflow: 'hidden' }}>
                      📷 {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar || removingAvatar}
                      />
                    </label>
                    {user?.profile_picture_url && (
                      <button type="button" className="btn btn-q" disabled={uploadingAvatar || removingAvatar} onClick={() => setConfirmRemove(true)}>
                        Remove
                      </button>
                    )}
                  </div>
                  {avatarMsg && <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{avatarMsg}</span>}
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="row2">
                  <label className="f"><span className="fl">Full Name</span>
                    <input className="in" value={name} onChange={e => setName(e.target.value)} required />
                  </label>
                  <label className="f">
                    <span className="fl">Email <span className="muted" style={{ fontWeight: 600, fontSize: 12 }}>· can’t be changed</span></span>
                    <input className="in" value={user?.email || ''} disabled />
                  </label>
                </div>

                <div className="row2">
                  <label className="f"><span className="fl">Date of Birth</span>
                    <input className="in" type="date" value={dob} onChange={e => setDob(e.target.value)} onClick={(e) => { if (e.target.showPicker) e.target.showPicker() }} />
                  </label>
                  <label className="f"><span className="fl">Gender</span>
                    <select className="in" value={gender} onChange={e => setGender(e.target.value)}>
                      <option value="">Select Gender</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                </div>

                <div className="row2">
                  <label className="f"><span className="fl">Mobile Number</span>
                    <input className="in" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} />
                  </label>
                  <label className="f"><span className="fl">College / Organization</span>
                    <input className="in" value={college} onChange={e => setCollege(e.target.value)} />
                  </label>
                </div>

                <label className="f"><span className="fl">Country</span>
                  <input className="in" value={country} onChange={e => setCountry(e.target.value)} />
                </label>

                <label className="f">
                  <span className="fl" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Bio <span className="mono muted" style={{ fontSize: 12 }}>{bio.length} / 500</span>
                  </span>
                  <textarea className="in" value={bio} maxLength={500} onChange={e => setBio(e.target.value)} />
                </label>

                {savedOk && <div className="alert" role="status" style={{ background: '#D6F3EA' }}><span className="ai">✓</span>{profileMsg}</div>}
                {saveErr && <div className="alert" role="alert" style={{ background: '#F6DDD8' }}><span className="ai">!</span>{profileMsg}</div>}

                <div style={{ position: 'sticky', bottom: 0, margin: '0 -26px -26px', padding: '14px 26px', borderTop: '2px solid #29251F', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: dirty ? 'var(--accl)' : '#FFFDF8' }}>
                  {dirty ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--acc)', border: '2px solid #29251F' }} />
                      You have unsaved changes
                    </span>
                  ) : (
                    <span className="muted" style={{ fontWeight: 700, fontSize: 14 }}>All changes saved</span>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                    {dirty && <button type="button" className="btn btn-s" onClick={() => resetForm(user)}>Discard</button>}
                    <button type="submit" className="btn btn-p" disabled={savingProfile || !dirty}>
                      {savingProfile ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* SECURITY */}
            <section className="card" aria-labelledby="sv-sec-security" style={{ overflow: 'hidden' }}>
              <SectionHead id="sv-sec-security" title="Security" sub="Change the password you use to log in." />
              <div style={{ padding: 26 }}>
                {user?.provider === 'google' ? (
                  <span className="muted" style={{ fontWeight: 600, fontSize: 14 }}>Password changes are managed by Google for this account.</span>
                ) : (
                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
                    <label className="f"><span className="fl">Current password</span>
                      <input className="in" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
                    </label>
                    <label className="f"><span className="fl">New password</span>
                      <input className="in" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" />
                    </label>

                    {newPassword && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', padding: '12px 14px', border: '2px solid #E2D3BB', borderRadius: 10, background: '#F8F3E9' }} aria-live="polite">
                        {PW_RULES.map(r => {
                          const ok = r.regex.test(newPassword)
                          return (
                            <span className="rule" key={r.label} style={ok ? undefined : { fontWeight: 800 }}>
                              <span className="dot" style={{ background: ok ? '#D6F3EA' : '#FFFDF8' }}>{ok ? '✓' : '✕'}</span>
                              {r.label}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {passwordMsg && (
                      <div className="alert" role="status" style={{ background: passwordMsg.startsWith('Error') ? '#F6DDD8' : '#D6F3EA' }}>
                        <span className="ai">{passwordMsg.startsWith('Error') ? '!' : '✓'}</span>{passwordMsg}
                      </div>
                    )}

                    <button type="submit" className="btn btn-s" style={{ alignSelf: 'flex-start' }} disabled={savingPassword || !currentPassword || !newPassword}>
                      {savingPassword ? 'Updating…' : 'Update password'}
                    </button>
                  </form>
                )}
              </div>
            </section>

            {/* APPEARANCE — kept from the existing Settings page; the artboard
                does not draw it, but the theme switcher is a working feature. */}
            <section className="card" aria-labelledby="sv-sec-appearance" style={{ overflow: 'hidden' }}>
              <SectionHead id="sv-sec-appearance" title="Appearance" sub="Applies to pages that have not been redesigned yet." />
              <div style={{ padding: 26, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[['light', '☀', 'Light'], ['dark', '🌙', 'Dark'], ['system', '🖥', 'System']].map(([key, icon, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn ${theme === key ? 'btn-p' : 'btn-s'}`}
                    onClick={() => setTheme(key)}
                    aria-pressed={theme === key}
                  >
                    <span aria-hidden="true">{icon}</span>{label}
                  </button>
                ))}
              </div>
            </section>

            {/* NOTIFICATIONS */}
            <section className="card" aria-labelledby="sv-sec-notifications" style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 id="sv-sec-notifications" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Notifications</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '2px dashed #B9AE9C', borderRadius: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <strong>Email notifications</strong>
                  <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Emails for new requests and messages.</div>
                </div>
                <span style={{ padding: '3px 10px', border: '2px solid #29251F', borderRadius: 999, background: '#FBEFC4', fontSize: 11, fontWeight: 800 }}>COMING SOON</span>
                <span className="sw" aria-hidden="true"><span /></span>
              </div>
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                In-app notifications are always on — find them under <Link to="/notifications" style={{ fontWeight: 800 }}>the bell</Link> in the top bar.
              </span>
            </section>

            {/* ABOUT */}
            <section className="card" aria-labelledby="sv-sec-about" style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, border: '2px solid #29251F', background: 'var(--acc)', boxShadow: '0 3px 0 #29251F' }} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <h2 id="sv-sec-about" style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>About SkillVerse</h2>
                <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>A peer-to-peer skill learning and collaboration platform.</span>
              </div>
              <Link to="/about-skillverse" className="btn btn-s" style={{ minHeight: 40 }}>Learn more</Link>
              <span className="mono" style={{ padding: '4px 10px', border: '2px solid #29251F', borderRadius: 8, fontSize: 12 }}>v1.0.0 · Phase 2</span>
            </section>

          </div>
        </div>
      </div>

      {/* remove-photo confirm */}
      {confirmRemove && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(41,37,31,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 }}>
          <div className="card" role="alertdialog" aria-labelledby="sv-rm" style={{ maxWidth: 420, width: '100%', padding: 28, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center' }}>
            <span style={{
              width: 80, height: 80, borderRadius: 999, border: '3px solid #29251F',
              background: user?.profile_picture_url ? `#D2BEA0 url(${user.profile_picture_url}) center/cover no-repeat` : '#D2BEA0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, boxShadow: '0 4px 0 #29251F'
            }}>
              {user?.profile_picture_url ? '' : (user?.name || '?')[0].toUpperCase()}
            </span>
            <h3 id="sv-rm" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Remove your profile photo?</h3>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>Partners will see your initial instead. You can upload a new one any time.</p>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button type="button" className="btn btn-s" style={{ flex: 1 }} onClick={() => setConfirmRemove(false)}>Keep it</button>
              <button type="button" className="btn btn-d" style={{ flex: 1 }} disabled={removingAvatar} onClick={handleAvatarRemove}>
                {removingAvatar ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
