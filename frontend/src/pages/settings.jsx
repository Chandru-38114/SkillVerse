import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Monitor, Bell, User, Info, ArrowLeft, Camera } from 'lucide-react'
import { getSessionUser, api } from '../api'
import PasswordInput from "../components/PasswordInput"
import Avatar from '../components/ui/Avatar'

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
  
  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");

  const resetForm = (u) => {
    if (!u) return;
    setName(u.name || "");
    setBio(u.bio || "");
    setMobileNumber(u.mobile_number || "");
    setCollege(u.college || "");
    setCountry(u.country || "");
    setDob(u.dob || "");
    setGender(u.gender || "");
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

  // Listen to system changes if in system mode
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
    if (!window.confirm("Remove your profile picture?")) return;
    
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
    }
  };

  return (
    <div className="page-narrow pb-20">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/profile" className="p-2 hover:bg-ink/5 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-ink/70" />
        </Link>
        <h1 className="text-2xl font-bold font-display text-ink">Settings</h1>
      </div>

      <div className="space-y-8">
        
        {/* Appearance Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-ink/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">Appearance</h2>
          </div>
          
          <div className="card p-1">
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-2 py-4 px-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-brand/10 text-brand' : 'hover:bg-ink/5 text-ink/70'}`}
              >
                <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-brand' : 'opacity-70'}`} />
                <span className="text-xs font-semibold">Light</span>
              </button>
              
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-2 py-4 px-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-brand/10 text-brand' : 'hover:bg-ink/5 text-ink/70'}`}
              >
                <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-brand' : 'opacity-70'}`} />
                <span className="text-xs font-semibold">Dark</span>
              </button>
              
              <button
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center gap-2 py-4 px-2 rounded-lg transition-colors ${theme === 'system' ? 'bg-brand/10 text-brand' : 'hover:bg-ink/5 text-ink/70'}`}
              >
                <Monitor className={`w-6 h-6 ${theme === 'system' ? 'text-brand' : 'opacity-70'}`} />
                <span className="text-xs font-semibold">System</span>
              </button>
            </div>
          </div>
        </section>

        {/* Profile Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-ink/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">Profile Information</h2>
          </div>
          
          <div className="card divide-y divide-line/40 overflow-hidden">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-6">
              <Avatar url={user?.profile_picture_url} name={user?.name} size="xl" />
              
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <label className="btn-secondary cursor-pointer relative overflow-hidden text-center text-sm py-2 px-4">
                  <span className="flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4" />
                    {uploadingAvatar ? "Uploading..." : "Change Avatar"}
                  </span>
                  <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar || removingAvatar}
                  />
                </label>
                
                {user?.profile_picture_url && (
                  <button 
                    onClick={handleAvatarRemove}
                    disabled={uploadingAvatar || removingAvatar}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-clay/30 text-clay hover:bg-clay/5 disabled:opacity-50"
                  >
                    {removingAvatar ? "Removing..." : "Remove Avatar"}
                  </button>
                )}
                {avatarMsg && <p className="text-xs text-center mt-2 text-moss">{avatarMsg}</p>}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Full Name</label>
                    <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="field-label">Email <span className="text-xs font-normal text-ink/50">(Cannot be changed)</span></label>
                    <input type="email" className="input bg-ink/5 dark:bg-ink/10 cursor-not-allowed" value={user?.email || ''} disabled />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Date of Birth</label>
                    <input type="date" className="input" value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Gender</label>
                    <select className="input" value={gender} onChange={e => setGender(e.target.value)}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Mobile Number</label>
                    <input type="text" className="input" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Organization / College</label>
                    <input type="text" className="input" value={college} onChange={e => setCollege(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="field-label">Country</label>
                  <input type="text" className="input" value={country} onChange={e => setCountry(e.target.value)} />
                </div>

                <div>
                  <label className="field-label">Bio</label>
                  <textarea className="input min-h-[100px]" value={bio} onChange={e => setBio(e.target.value)}></textarea>
                </div>

                {profileMsg && (
                  <p className={`text-sm ${profileMsg.startsWith('Error') ? 'text-clay' : 'text-moss'}`}>{profileMsg}</p>
                )}

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={savingProfile} className="btn-primary">
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Account Security Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-ink/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">Security</h2>
          </div>
          
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-6">
              <p className="text-sm font-semibold text-ink mb-3">Change Password</p>
              {user?.provider === 'google' ? (
                <p className="text-xs text-clay">Password changes are managed by Google for this account.</p>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <PasswordInput value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="Current Password" />
                  </div>
                  <div>
                    <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="New Password" />
                  </div>
                  {passwordMsg && (
                    <p className={`text-xs ${passwordMsg.startsWith('Error') ? 'text-red-500' : 'text-moss'}`}>{passwordMsg}</p>
                  )}
                  <button type="submit" disabled={savingPassword || !currentPassword || !newPassword} className="btn-secondary w-full text-xs py-2 min-h-0">
                    {savingPassword ? "Updating..." : "Update Password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-ink/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">Notifications</h2>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Email Notifications</p>
                <p className="text-xs text-clay mt-0.5">Receive emails for requests and messages</p>
              </div>
              <div className="w-10 h-6 bg-brand rounded-full relative cursor-not-allowed opacity-50">
                <div className="w-4 h-4 bg-surface rounded-full absolute right-1 top-1"></div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-ink/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">About</h2>
          </div>
          
          <div className="card p-4">
            <p className="text-sm font-semibold text-ink">About SkillVerse</p>
            <p className="text-xs text-clay mt-1">Version: 1.0.0 (Phase 2)</p>
            <p className="text-xs text-ink/70 mt-3 pt-3 border-t border-line/40">A peer-to-peer skill learning and collaboration platform.</p>
          </div>
        </section>

      </div>
    </div>
  )
}
