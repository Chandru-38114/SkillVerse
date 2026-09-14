import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Monitor, Bell, Shield, User, Info, ArrowLeft } from 'lucide-react'
import { getSessionUser, api } from '../api'
import PasswordInput from "../components/PasswordInput"

export default function Settings() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system')
  const [user, setUser] = useState(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState("")

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

  useEffect(() => {
    setUser(getSessionUser())
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

        {/* Account Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-ink/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">Account</h2>
          </div>
          
          <div className="card divide-y divide-line overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Email Address</p>
                <p className="text-xs text-clay mt-0.5">{user?.email || 'Loading...'}</p>
              </div>
              {user?.provider === 'google' && (
                <span className="text-[10px] font-bold bg-brand/10 dark:bg-brand/20 text-brand px-2 py-0.5 rounded-full">Google Auth</span>
              )}
            </div>
            
            <div className="p-4">
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

        {/* Notifications (Placeholder for actual future implementation) */}
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
              {/* Dummy toggle since no API exists yet */}
              <div className="w-10 h-6 bg-brand rounded-full relative cursor-not-allowed opacity-50">
                <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
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
            <p className="text-xs text-ink/70 mt-3 pt-3 border-t border-line">A peer-to-peer skill learning and collaboration platform.</p>
          </div>
        </section>

      </div>
    </div>
  )
}
