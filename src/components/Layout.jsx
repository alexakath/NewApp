import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { logout, getCurrentUser } from '../api/services/authService'
import './Layout.css'

const NAV_ITEMS = [
  {
    section: 'Catalogue',
    items: [
      { to: '/',             label: 'Dashboard',    icon: 'ti-layout-dashboard', exact: true },
       { to: '/products',     label: 'Produits',     icon: 'ti-box' },
      // { to: '/categories',   label: 'Catégories',   icon: 'ti-folder' },
      // { to: '/combinations', label: 'Déclinaisons', icon: 'ti-adjustments' },
      // { to: '/stock',        label: 'Stock',        icon: 'ti-package' },
      // { to: '/customers',    label: 'Clients',      icon: 'ti-users' },
      { to: '/stock',        label: 'Stock',        icon: 'ti-package' },
      { to: '/orders',       label: 'Commandes',    icon: 'ti-clipboard-list' },
    ]
  },
  {
    section: 'Données',
    items: [
      { to: '/import', label: 'Import CSV',    icon: 'ti-upload' },
      { to: '/reset',  label: 'Réinitialiser', icon: 'ti-refresh' },
    ]
  }
]

const Layout = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getCurrentUser()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const getTitle = () => {
    const path = location.pathname
    if (path === '/')             return 'Dashboard'
    if (path === '/products')     return 'Produits'
      // if (path === '/categories')   return 'Catégories'
      // if (path === '/combinations') return 'Déclinaisons'
      // if (path === '/stock')        return 'Stock'
      // if (path === '/customers')    return 'Clients'
    if (path === '/stock')        return 'Ajout de stock'
    if (path.startsWith('/stock/history'))  return 'Historique des mouvements'
    if (path === '/orders')       return 'Commandes'
    if (path === '/import')       return 'Import CSV'
    if (path === '/reset')        return 'Réinitialisation'
    return 'NewApp'
  }

  return (
    <div className="layout">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <i className="ti ti-shopping-cart" aria-hidden="true"></i>
          </div>
          <span className="sidebar-brand-name">New<span>App</span></span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((group) => (
            <div key={group.section} className="nav-group">
              <p className="nav-section">{group.section}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <i className={`ti ${item.icon}`} aria-hidden="true"></i>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="nav-item">
            <i className="ti ti-settings" aria-hidden="true"></i>
            <span>New App</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{getTitle()}</h1>
          <div className="topbar-right">

            {/* User info + logout */}
            <div className="topbar-user">
              <div className="topbar-avatar">
                {user?.firstname?.[0]}{user?.lastname?.[0]}
              </div>
              <span className="topbar-username">
                {user?.firstname} {user?.lastname}
              </span>
            </div>

            <button
              className="topbar-logout-btn"
              onClick={handleLogout}
              title="Se déconnecter"
            >
              <i className="ti ti-logout" aria-hidden="true"></i>
            </button>
          </div>
        </header>

        <main className="content">
          {children}
        </main>
      </div>

    </div>
  )
}

export default Layout