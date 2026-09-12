import React, { useState, useEffect } from "react";
import { api, getAvatarUrl } from "../api";
import PasswordInput from "../components/PasswordInput";
import { Camera, Save, Lock } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Edit mode toggle
  const [isEditing, setIsEditing] = useState(false);

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
      resetForm(u);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const resetForm = (u = user) => {
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

  const handleCancel = () => {
    resetForm();
    setIsEditing(false);
  };

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
      setProfileMsg("Profile updated successfully!");
      setIsEditing(false);
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
      await api.changePassword(currentPassword, newPassword);
      setPasswordMsg("Password changed successfully!");
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
      e.target.value = null;
    }
  };

  if (loading) return <div className="p-8 text-center text-ink/60">Loading...</div>;
  if (!user) return <div className="p-8 text-center text-clay">Failed to load user data</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-3xl font-display mb-8">Profile Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Verification */}
        <div className="space-y-6">
          <div className="card p-4 sm:p-6 flex flex-col items-center">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-sand mb-4 flex items-center justify-center">
              {user.profile_picture_url ? (
                <img 
                  src={getAvatarUrl(user.profile_picture_url)} 
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

          <div className="card p-4 sm:p-6">
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
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="card p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-display">Personal Info</h2>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="btn-secondary text-sm px-3 py-1">
                  Edit Profile
                </button>
              )}
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Full Name</label>
                  <input type="text" className="input" value={isEditing ? name : (user.name || 'Not provided')} onChange={e => setName(e.target.value)} disabled={!isEditing} required />
                </div>
                <div>
                  <label className="field-label">Email <span className="text-xs font-normal text-ink/50">(Cannot be changed)</span></label>
                  <input type="email" className="input bg-sand/50 cursor-not-allowed" value={user.email} disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="field-label">Date of Birth <span className="text-xs font-normal text-ink/50">(Not verified)</span></label>
                  <input type={isEditing ? "date" : "text"} className={`input ${!isEditing ? 'bg-sand/30' : ''}`} value={isEditing ? dob : (user.dob || 'Not provided')} onChange={e => setDob(e.target.value)} disabled={!isEditing} />
                </div>
                <div>
                  <label className="field-label">Gender <span className="text-xs font-normal text-ink/50">(Not verified)</span></label>
                  {isEditing ? (
                    <select className="input" value={gender} onChange={e => setGender(e.target.value)}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  ) : (
                    <input type="text" className="input bg-sand/30" value={user.gender || 'Not provided'} disabled />
                  )}
                </div>
                <div>
                  <label className="field-label">Age <span className="text-xs font-normal text-ink/50">(Not verified)</span></label>
                  <input type="text" className="input bg-sand/50 cursor-not-allowed" value={user.age !== null && user.age !== undefined ? user.age : 'Not provided'} disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Mobile Number</label>
                  <input type="text" className={`input ${!isEditing ? 'bg-sand/30' : ''}`} value={isEditing ? mobileNumber : (user.mobile_number || 'Not provided')} onChange={e => setMobileNumber(e.target.value)} disabled={!isEditing} />
                </div>
                <div>
                  <label className="field-label">Organization / College</label>
                  <input type="text" className={`input ${!isEditing ? 'bg-sand/30' : ''}`} value={isEditing ? college : (user.college || 'Not provided')} onChange={e => setCollege(e.target.value)} disabled={!isEditing} />
                </div>
              </div>

              <div>
                <label className="field-label">Country</label>
                <input type="text" className={`input ${!isEditing ? 'bg-sand/30' : ''}`} value={isEditing ? country : (user.country || 'Not provided')} onChange={e => setCountry(e.target.value)} disabled={!isEditing} />
              </div>

              <div>
                <label className="field-label">Bio</label>
                <textarea className={`input min-h-[100px] ${!isEditing ? 'bg-sand/30' : ''}`} value={isEditing ? bio : (user.bio || 'Not provided')} onChange={e => setBio(e.target.value)} disabled={!isEditing}></textarea>
              </div>

              {profileMsg && (
                <p className={`text-sm ${profileMsg.startsWith('Error') ? 'text-clay' : 'text-moss'}`}>{profileMsg}</p>
              )}

              {isEditing && (
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={handleCancel} disabled={savingProfile} className="px-4 py-2 text-sm font-medium text-ink/70 hover:text-ink transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingProfile} className="btn-primary">
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="card p-4 sm:p-6">
            <h2 className="text-xl font-display mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="field-label">Current Password</label>
                <PasswordInput value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div>
                <label className="field-label">New Password</label>
                <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
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
