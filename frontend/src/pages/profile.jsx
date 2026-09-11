import React, { useState, useEffect } from "react";
import { api } from "../api";
import { Camera, Save, Lock } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Profile update form
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [college, setCollege] = useState("");
  const [country, setCountry] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  
  // Password change form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const u = await api.me();
      setUser(u);
      setName(u.name || "");
      setBio(u.bio || "");
      setMobileNumber(u.mobile_number || "");
      setCollege(u.college || "");
      setCountry(u.country || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
        mobile_number: mobileNumber 
      });
      setUser(u);
      setProfileMsg("Profile updated successfully!");
    } catch (err) {
      setProfileMsg("Error: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg("");
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setPasswordMsg(res.detail || "Password changed!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMsg("Error: " + err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarMsg("");
    try {
      const u = await api.uploadAvatar(file);
      setUser(u);
      setAvatarMsg("Avatar updated!");
    } catch (err) {
      setAvatarMsg("Error: " + err.message);
    } finally {
      setUploadingAvatar(false);
      // Reset input
      e.target.value = null;
    }
  };

  if (loading) return <div className="p-8 text-center text-ink/60">Loading...</div>;
  if (!user) return <div className="p-8 text-center text-clay">Failed to load user data</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display mb-8">Profile Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Verification */}
        <div className="space-y-6">
          <div className="card p-6 flex flex-col items-center">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-sand mb-4 flex items-center justify-center">
              {user.profile_picture_url ? (
                <img 
                  src={BACKEND_URL + user.profile_picture_url} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <span className="text-4xl text-ink/20">{user.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            
            <label className="btn-secondary cursor-pointer relative overflow-hidden w-full text-center">
              <span>{uploadingAvatar ? "Uploading..." : "Change Avatar"}</span>
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </label>
            {avatarMsg && <p className="text-xs text-center mt-2 text-moss">{avatarMsg}</p>}
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg mb-4">Account Status</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink/60">Email</span>
                {user.is_email_verified ? (
                  <span className="bg-moss/10 text-moss px-2 py-1 rounded-md text-xs font-medium">Verified</span>
                ) : (
                  <span className="bg-clay/10 text-clay px-2 py-1 rounded-md text-xs font-medium">Pending</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink/60">Mobile</span>
                {user.is_mobile_verified ? (
                  <span className="bg-moss/10 text-moss px-2 py-1 rounded-md text-xs font-medium">Verified</span>
                ) : (
                  <span className="bg-clay/10 text-clay px-2 py-1 rounded-md text-xs font-medium">Pending</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="card p-6">
            <h2 className="text-xl font-display mb-4">Personal Info</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Full Name</label>
                  <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="field-label">Email <span className="text-xs font-normal text-ink/50">(Cannot be changed)</span></label>
                  <input type="email" className="input bg-sand/50 cursor-not-allowed" value={user.email} disabled />
                </div>
              </div>

              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="field-label">Date of Birth</label>
                  <input type="text" className="input bg-sand/50 cursor-not-allowed" value={user.dob || 'Not provided'} disabled />
                </div>
                <div>
                  <label className="field-label">Gender</label>
                  <input type="text" className="input bg-sand/50 cursor-not-allowed" value={user.gender || 'Not provided'} disabled />
                </div>
                <div>
                  <label className="field-label">Age</label>
                  <input type="text" className="input bg-sand/50 cursor-not-allowed" value={user.age !== null && user.age !== undefined ? user.age : 'Not provided'} disabled />
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

              <div className="flex justify-end">
                <button type="submit" disabled={savingProfile} className="btn-primary">
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-display mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="field-label">Current Password</label>
                <input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div>
                <label className="field-label">New Password</label>
                <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                <p className="text-xs text-ink/50 mt-1">Must be at least 6 characters, include uppercase, lowercase, number, and special character.</p>
              </div>

              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.startsWith('Error') ? 'text-clay' : 'text-moss'}`}>{passwordMsg}</p>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={savingPassword || !currentPassword || !newPassword} className="btn-secondary">
                  {savingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
