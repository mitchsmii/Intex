import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface ProtectedRouteProps {
  allowedRoles: string[]
}

function getRoleHomePath(roles: string[]): string {
  if (roles.includes('Admin')) return '/admin'
  if (roles.includes('SocialWorker')) return '/socialworker/dashboard'
  if (roles.includes('Donor')) return '/donor'
  return '/'
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--border-light, #dfe8e4)',
            borderTopColor: 'var(--color-primary, #5e9ea0)',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      </div>
    )
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  const hasRole = user.roles.some((role) => allowedRoles.includes(role))
  if (!hasRole) {
    return <Navigate to={getRoleHomePath(user.roles)} replace />
  }

  return <Outlet />
}
