import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { frontLogin } from '../services/frontAuthService'
import FrontLayout from '../FrontLayout'
import './FrontLoginPage.css'

const FrontLoginPage = () => {
  const [searchParams]          = useSearchParams()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  // Email pré-rempli depuis ?email=xxx (venant de FrontHomePage)
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setEmail(decodeURIComponent(emailParam))
  }, [searchParams])

  // Après login : retour à la page demandée ou /shop/products
  const from = location.state?.from || '/shop/products'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await frontLogin(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const emailFromParam = !!searchParams.get('email')

  return (
    <FrontLayout>
      <div className="front-login-wrapper">
        <div className="front-login-box">

          {/* ── Panel gauche : branding ── */}
          <div className="front-login-brand">
            <div className="front-login-brand-inner">
              <div className="front-login-brand-icon">
                <i className="ti ti-shopping-bag"></i>
              </div>
              <h2>Bon retour</h2>
              <p>Accédez à votre espace client</p>
            </div>
            <span className="front-login-brand-name">Your'Shop</span>
          </div>

          {/* ── Panel droit : formulaire ── */}
          <div className="front-login-form-panel">

            <div className="front-login-form-header">
              <h3>Connexion</h3>
              <p className="front-login-sub">
                {emailFromParam
                  ? 'Entrez votre mot de passe pour continuer'
                  : 'Connectez-vous pour finaliser votre commande'}
              </p>
            </div>

            {error && (
              <div className="front-login-error">
                <i className="ti ti-alert-circle"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="front-login-field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  readOnly={emailFromParam}
                  className={emailFromParam ? 'input-readonly' : ''}
                />
                {emailFromParam && (
                  <span className="front-login-email-hint">
                    <i className="ti ti-lock-open"></i>
                    Email pré-rempli depuis la sélection du compte
                  </span>
                )}
              </div>

              <div className="front-login-field">
                <label>Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus={emailFromParam}
                  placeholder="Entrez votre mot de passe"
                />
              </div>

              <button
                type="submit"
                className="front-login-btn"
                disabled={loading}
              >
                {loading
                  ? <><i className="ti ti-loader-2 spin"></i> Connexion...</>
                  : 'Se connecter'}
              </button>
            </form>

            <button
              className="front-login-back"
              onClick={() => navigate('/shop')}
            >
              ← Retour à la liste des comptes
            </button>

          </div>
        </div>
      </div>
    </FrontLayout>
  )
}

export default FrontLoginPage