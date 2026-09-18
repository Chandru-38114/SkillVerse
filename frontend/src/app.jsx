import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import Navbar from './components/navbar'
import SkillVerseBackground from './components/SkillVerseBackground'
import ProtectedRoute from './components/protectedroute'
import Landing from './pages/landing'
import Signup from './pages/signup'
import Onboarding from './pages/onboarding'
import Login from './pages/login'
import ForgotPassword from './pages/forgot_password'
import VerifyEmail from './pages/verify_email'
import Dashboard from './pages/dashboard'
import Assessment from './pages/assessment'
import Marketplace from './pages/marketplace'
import Requests from './pages/requests'
import Chat from './pages/chat'
import Sessions from './pages/sessions'
import SessionRoom from './pages/session_room'
import Progress from './pages/progress'
import CertificateView from './pages/CertificateView'
import VerifyCertificate from './pages/VerifyCertificate'

import Profile from './pages/profile'
import Settings from './pages/settings'
import Messages from './pages/messages'
import Notifications from './pages/notifications'
import Gamification from './pages/gamification'
import QuestReview from './pages/quest_review'
import { api, saveSession, clearSession } from './api'
import { getSessionUser, getToken } from './api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "NO_CLIENT_ID_CONFIGURED"

function RootRedirect() {
  const user = getSessionUser()
  const token = getToken()
  if (!user || !token) return <Navigate to="/login" replace />
  if (!user.is_email_verified) return <Navigate to="/verify-email" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(() => !!(getToken() && getSessionUser()));

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.me().then(user => {
          saveSession(token, user);
          if (!authChecked) setAuthChecked(true);
        }).catch(() => {
          clearSession();
          setAuthChecked(true);
          navigate('/login');
        });
    } else {
      setAuthChecked(true);
    }
  }, [navigate]);

  const authRoutes = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/verify/'];
  const isAuthRoute = authRoutes.some(path => location.pathname.startsWith(path)) || location.pathname === '/' || location.pathname === '/landing';

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <SkillVerseBackground />
      <div className="min-h-screen bg-transparent text-ink font-body pb-20 xl:pb-0 relative z-0">
        {!isAuthRoute && <Navbar />}
        <Routes>
          <Route path="/" element={<RootRedirect />} /><Route path="/landing" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route
          path="/profile"
          element={<ProtectedRoute><Profile /></ProtectedRoute>}
        />
        <Route
          path="/settings"
          element={<ProtectedRoute><Settings /></ProtectedRoute>}
        />
        <Route
          path="/messages"
          element={<ProtectedRoute><Messages /></ProtectedRoute>}
        />
        <Route
          path="/assessment"
          element={<ProtectedRoute><Assessment /></ProtectedRoute>}
        />
        <Route
          path="/marketplace"
          element={<ProtectedRoute><Marketplace /></ProtectedRoute>}
        />
        <Route
          path="/requests"
          element={<ProtectedRoute><Requests /></ProtectedRoute>}
        />
        <Route
          path="/chat/:requestId"
          element={<ProtectedRoute><Chat /></ProtectedRoute>}
        />
        <Route
          path="/sessions"
          element={<ProtectedRoute><Sessions /></ProtectedRoute>}
        />
        <Route
          path="/session/:sessionId"
          element={<ProtectedRoute><SessionRoom /></ProtectedRoute>}
        />
        <Route
          path="/progress"
          element={<ProtectedRoute><Progress /></ProtectedRoute>}
        />
        <Route
          path="/certificate/:certId"
          element={<ProtectedRoute><CertificateView /></ProtectedRoute>}
        />
        <Route
          path="/verify/:certId"
          element={<VerifyCertificate />}
        />
        <Route
          path="/notifications"
          element={<ProtectedRoute><Notifications /></ProtectedRoute>}
        />
        <Route
          path="/quest-review/:sessionId"
          element={<ProtectedRoute><QuestReview /></ProtectedRoute>}
        />
        <Route path="/gamification" element={<ProtectedRoute><Gamification /></ProtectedRoute>} />
      </Routes>
    </div>
    </GoogleOAuthProvider>
  )
}



