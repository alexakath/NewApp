import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { frontLogout, frontGetCurrentUser, frontLoginAsAnonymous, frontIsAnonymous } from './services/frontAuthService'
import './FrontLayout.css'

const FrontLayout = ({ children }) => {
  const [cartCount, setCartCount] = useState(0)
  const [user, setUser]           = useState(() => frontGetCurrentUser())
  const navigate  = useNavigate()
  const location  = useLocation()

  useEffect(() => {
    const syncCart = () => {
      const currentUser = frontGetCurrentUser()
      if (!currentUser) { setCartCount(0); return }
      const key  = `front_cart_${currentUser.id}`
      const cart = JSON.parse(localStorage.getItem(key) || '[]')
      setCartCount(cart.reduce((sum, item) => sum + item.qty, 0))
    }
    syncCart()
    window.addEventListener('storage', syncCart)
    return () => window.removeEventListener('storage', syncCart)
  }, [])

  const handleLogout = () => {
    frontLogout()
    setUser(null)
    setCartCount(0)
    navigate('/shop')
  }

  const handleAnonymousLogin = () => {
    const anonymousUser = frontLoginAsAnonymous()
    setUser(anonymousUser)
    navigate('/shop/products')
  }

  const isActive = (path) => location.pathname === path
  const isAnon   = frontIsAnonymous()

  return (
    <div className="front-layout">

      {/* ── Topnav ── */}
      <nav className="front-nav">

        {/* Logo — aligné avec sidebar */}
        <div className="front-nav-left">
          <Link to="/shop" className="front-nav-logo">Your'Shop</Link>
        </div>

        {/* Recherche centrale */}
        <div className="front-nav-center">
          <div className="nav-search-wrap">
            <i className="ti ti-search nav-search-icon"></i>
            <input
              className="nav-search-input"
              type="text"
              placeholder="Rechercher…"
            />
          </div>
        </div>

        {/* Actions droite */}
        <div className="front-nav-actions">
          <Link to="/shop/cart" className="front-nav-cart">
            <i className="ti ti-shopping-cart"></i>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>

          {user ? (
            <div className="front-nav-user">
              <div className="front-nav-avatar">
                {isAnon
                  ? <i className="ti ti-user-question"></i>
                  : user.firstname?.charAt(0).toUpperCase()}
              </div>
              <span className="front-nav-username">
                {isAnon ? 'Anonyme' : user.firstname}
              </span>
              <button onClick={handleLogout} className="front-nav-logout">
                <i className="ti ti-logout"></i>
              </button>
            </div>
          ) : (
            <div className="front-nav-auth-btns">
              <Link to="/shop/login" className="front-nav-login">Connexion</Link>
              <button className="front-nav-login" onClick={handleAnonymousLogin}>
                <i className="ti ti-user-question"></i>
                Anonyme
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Body : sidebar + main ── */}
      <div className="front-body">

        {/* Sidebar gauche */}
        <aside className="front-sidebar">
          <div className="front-sidebar-section">
            <p className="front-sidebar-title">Catalogue</p>
            <Link
              to="/shop/products"
              className={`front-sidebar-item ${isActive('/shop/products') ? 'active' : ''}`}
            >
              <i className="ti ti-box"></i>
              <span>Tous les produits</span>
            </Link>
            <Link
              to="/shop/cart"
              className={`front-sidebar-item ${isActive('/shop/cart') ? 'active' : ''}`}
            >
              <i className="ti ti-shopping-cart"></i>
              <span>Mon panier</span>
              {cartCount > 0 && (
                <span className="front-sidebar-count">{cartCount}</span>
              )}
            </Link>
            {user && !isAnon && (
              <Link
                to="/shop/my-orders"
                className={`front-sidebar-item ${isActive('/shop/my-orders') ? 'active' : ''}`}
              >
                <i className="ti ti-clipboard-list"></i>
                <span>Mes commandes</span>
              </Link>
            )}
          </div>

          <div className="front-sidebar-divider" />

          <div className="front-sidebar-section">
            <p className="front-sidebar-title">Compte</p>
            {user ? (
              <>
                <div className="front-sidebar-item">
                  <i className="ti ti-user"></i>
                  <span>{isAnon ? 'Anonyme' : user.firstname}</span>
                </div>
                <div
                  className="front-sidebar-item"
                  onClick={handleLogout}
                  style={{ cursor: 'pointer' }}
                >
                  <i className="ti ti-logout"></i>
                  <span>Déconnexion</span>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/shop/login"
                  className={`front-sidebar-item ${isActive('/shop/login') ? 'active' : ''}`}
                >
                  <i className="ti ti-login"></i>
                  <span>Connexion</span>
                </Link>
                <div
                  className="front-sidebar-item"
                  onClick={handleAnonymousLogin}
                  style={{ cursor: 'pointer' }}
                >
                  <i className="ti ti-user-question"></i>
                  <span>Anonyme</span>
                </div>
              </>
            )}
          </div>

          <div className="front-sidebar-divider" />

          <div className="front-sidebar-section">
            <p className="front-sidebar-title">Navigation</p>
            <Link
              to="/shop"
              className={`front-sidebar-item ${isActive('/shop') ? 'active' : ''}`}
            >
              <i className="ti ti-users"></i>
              <span>Utilisateurs</span>
            </Link>
          </div>
        </aside>

        {/* Zone de contenu */}
        <main className="front-main">
          {children}
        </main>
      </div>

    </div>
  )
}

export default FrontLayout