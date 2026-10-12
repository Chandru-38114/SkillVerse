import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import Navbar from './components/navbar'
import SkillVerseBackground from './components/SkillVerseBackground'
import ProtectedRoute from './components/protectedroute'

// Eagerly loaded
import Landing from './pages/landing'
import Signup from './pages/signup'
import Login from './pages/login'

// Lazy-loaded
const Onboarding = lazy(() => import('./pages/onboarding'))
const ForgotPassword = lazy(() => import('./pages/forgot_password'))
const VerifyEmail = lazy(() => import('./pages/verify_email'))
const Dashboard = lazy(() => import('./pages/dashboard'))
const Assessment = lazy(() => import('./pages/assessment'))
const Marketplace = lazy(() => import('./pages/marketplace'))
const Requests = lazy(() => import('./pages/requests'))
const Exchanges = lazy(() => import('./pages/exchanges'))
const Chat = lazy(() => import('./pages/chat'))
const Sessions = lazy(() => import('./pages/sessions'))
const SessionRoom = lazy(() => import('./pages/session_room'))
const Progress = lazy(() => import('./pages/progress'))
const CertificateView = lazy(() => import('./pages/CertificateView'))
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'))
const AboutSkillVerse = lazy(() => import('./pages/AboutSkillVerse'))
const Profile = lazy(() => import('./pages/profile'))
const Settings = lazy(() => import('./pages/settings'))
const Messages = lazy(() => import('./pages/messages'))
const Notifications = lazy(() => import('./pages/notifications'))
const Gamification = lazy(() => import('./pages/gamification'))
const QuestReview = lazy(() => import('./pages/quest_review'))

import { api, saveSession, clearSession } from './api'
import { getSessionUser, getToken } from './api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "NO_CLIENT_ID_CONFIGURED"

function RootRedirect() {
  const user = getSessionUser()
  const token = getToken()
  if (!user || !token) return <Landing />
  if (!user.is_email_verified) return <Navigate to="/verify-email" replace />
  return <Navigate to="/dashboard" replace />
}

function OnboardingRoute() {
  const location = useLocation()
  if (location.state?.onboardingToken) {
    return <Onboarding />
  }
  return <ProtectedRoute><Onboarding /></ProtectedRoute>
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
        });
    } else {
      setAuthChecked(true);
    }
  }, []);

  const authRoutes = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/verify-certificate/', '/onboarding'];
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
      <div className="min-h-screen bg-transparent text-ink font-body relative z-0">
        {!isAuthRoute && <Navbar />}
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-paper">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<RootRedirect />} /><Route path="/landing" element={<Landing />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<OnboardingRoute />} />
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
              path="/exchanges"
              element={<ProtectedRoute><Exchanges /></ProtectedRoute>}
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
              path="/verify-certificate/:certId"
              element={<VerifyCertificate />}
            />
            <Route
              path="/about-skillverse"
              element={<AboutSkillVerse />}
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
        </Suspense>
      </div>
    </GoogleOAuthProvider>
  )
}



