import { Navigate } from 'react-router-dom'
import { isAuthenticated } from '../api/services/authService'

/**
 * Garde les routes privées
 * Si non authentifié → redirige vers /login
 * Si authentifié → affiche le composant enfant
 */
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default ProtectedRoute