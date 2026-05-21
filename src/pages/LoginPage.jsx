import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import './LoginPage.css'

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, loading, error, employee, authenticated } = useAuth()

  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)

  // Si déjà connecté → redirige vers dashboard
  useEffect(() => {
    if (authenticated) navigate('/', { replace: true })
  }, [authenticated, navigate])

  // Préremplir email + password quand employé chargé
  useEffect(() => {
    if (employee?.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        email: employee.email,
        password: import.meta.env.VITE_ADMIN_PASSWORD || '',
      })
    }
  }, [employee])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const success = await login(formData.email, formData.password)
    if (success) navigate('/', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <i className="ti ti-shopping-cart" aria-hidden="true"></i>
          </div>
          <span className="login-logo-name">New<span>App</span></span>
        </div>

        <h1 className="login-title">Connexion au backoffice</h1>
        <p className="login-sub">
          Connectez-vous avec votre compte PrestaShop
        </p>

        {/* Profil employé prérempli */}
        {employee && (
          <div className="login-employee-info">
            <div className="login-avatar">
              {employee.firstname?.[0]}{employee.lastname?.[0]}
            </div>
            <div>
              <p className="login-employee-name">
                {employee.firstname} {employee.lastname}
              </p>
              <p className="login-employee-role">Administrateur PrestaShop</p>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Email</label>
            <div className="login-input-wrapper">
              <i className="ti ti-mail" aria-hidden="true"></i>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="email@exemple.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="login-field">
            <label>Mot de passe</label>
            <div className="login-input-wrapper">
              <i className="ti ti-lock" aria-hidden="true"></i>
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                <i
                  className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`}
                  aria-hidden="true"
                ></i>
              </button>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="login-error">
              <i className="ti ti-alert-circle" aria-hidden="true"></i>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="ti ti-loader-2 spin" aria-hidden="true"></i>
                Connexion...
              </>
            ) : (
              <>
                <i className="ti ti-login" aria-hidden="true"></i>
                Se connecter
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  )
}

export default LoginPage