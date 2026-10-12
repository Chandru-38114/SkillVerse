import { Navigate, useLocation } from 'react-router-dom'
import { getSessionUser, getToken } from '../api'

export default function ProtectedRoute({ children }) {
  const user = getSessionUser()
  const location = useLocation()
  
  if (!user || !getToken()) return <Navigate to="/login" replace />
  
  if (!user.is_email_verified && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />
  }
  
  if (user.is_email_verified && location.pathname === '/verify-email') {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}
