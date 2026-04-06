import { Navigate, Outlet } from 'react-router-dom'

interface ProtectedRouteProps {
  isAuthenticated: boolean
  requiredRole?: string
  userRole?: string
}

function ProtectedRoute({ isAuthenticated, requiredRole, userRole }: ProtectedRouteProps) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
