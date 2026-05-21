import { useState, useEffect, useCallback } from 'react'
import {
  login as authLogin,
  logout as authLogout,
  isAuthenticated,
  getCurrentUser,
  getEmployeeFromApi,
} from '../api/services/authService'

/**
 * Hook React qui expose l'état d'authentification
 * et les actions login/logout à tous les composants
 */
const useAuth = () => {
  const [user, setUser] = useState(getCurrentUser)
  const [authenticated, setAuthenticated] = useState(isAuthenticated)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [employee, setEmployee] = useState(null)

  // Charger le profil employé au montage (pour préremplir le login)
  useEffect(() => {
    const loadEmployee = async () => {
      const emp = await getEmployeeFromApi()
      setEmployee(emp)
    }
    if (!authenticated) loadEmployee()
  }, [authenticated])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const loggedUser = await authLogin(email, password)
      setUser(loggedUser)
      setAuthenticated(true)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    authLogout()
    setUser(null)
    setAuthenticated(false)
  }, [])

  return {
    user,
    authenticated,
    loading,
    error,
    employee,  // profil prérempli depuis PrestaShop
    login,
    logout,
  }
}

export default useAuth