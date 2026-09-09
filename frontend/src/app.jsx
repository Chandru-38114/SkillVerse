import { Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import Navbar from './components/navbar'
import ProtectedRoute from './components/protectedroute'
import Landing from './pages/landing'
import Signup from './pages/signup'
import Login from './pages/login'
import ForgotPassword from './pages/forgot_password'
import Dashboard from './pages/dashboard'
import Assessment from './pages/assessment'
import Marketplace from './pages/marketplace'
import Requests from './pages/requests'
import Chat from './pages/chat'
import Sessions from './pages/sessions'
import SessionRoom from './pages/session_room'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "NO_CLIENT_ID_CONFIGURED"

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-paper text-ink font-body">
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
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
      </Routes>
    </div>
    </GoogleOAuthProvider>
  )
}