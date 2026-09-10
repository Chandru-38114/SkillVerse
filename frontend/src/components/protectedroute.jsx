import { Navigate, useLocation } from 'react-router-dom'
import { getSessionUser } from '../api'

export default function ProtectedRoute({ children }) {
  const user = getSessionUser()
  const location = useLocation()
  
  if (!user) return <Navigate to="/login" replace />
  
  if (!user.is_email_verified && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />
  }
  
  if (user.is_email_verified && !user.is_mobile_verified && location.pathname !== '/verify-mobile' && location.pathname !== '/profile') {
    // Allow them to go to profile if they need to set mobile number, but ideally just to verify-mobile.
    return <Navigate to="/verify-mobile" replace />
  }
  
  return children
}