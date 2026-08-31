import { Routes, Route } from 'react-router-dom'
import Navbar from './components/navbar'
import ProtectedRoute from './components/protectedroute'
import Landing from './pages/landing'
import Signup from './pages/signup'
import Login from './pages/login'
import Dashboard from './pages/dashboard'
import Assessment from './pages/assessment'
import Marketplace from './pages/marketplace'
import Requests from './pages/requests'
import Chat from './pages/chat'

export default function App() {
  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
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
      </Routes>
    </div>
  )
}