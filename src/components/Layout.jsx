import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { logout, getCurrentUser } from '../api/services/authService'
import './Layout.css'

const NAV_SECTIONS = [
  {
    section: 'Catalogue',
    icon: 'ti-layout-grid',
    items: [
      { to: '/',         label: 'Dashboard',    icon: 'ti-layout-dashboard', exact: true },
      { to: '/products', label: 'Produits',      icon: 'ti-box' },
      { to: '/stock',    label: 'Stock',         icon: 'ti-package' },
      { to: '/orders',   label: 'Commandes',     icon: 'ti-clipboard-list' },
    ]
  },
  {
    section: 'Données',
    icon: 'ti-database',
    items: [
      { to: '/import', label: 'Import CSV',     icon: 'ti-upload' },
      { to: '/reset',  label: 'Réinitialiser',  icon: 'ti-refresh' },
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

  /* ── Quelle section topnav est active ── */
  const getActiveSection = () => {
    for (const s of NAV_SECTIONS) {
      for (const item of s.items) {
        const match = item.exact
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to) && item.to !== '/'
        if (match || (item.exact && location.pathname === '/')) return s.section
      }
    }
    return NAV_SECTIONS[0].section
  }

  const activeSection = getActiveSection()
  const currentSection = NAV_SECTIONS.find(s => s.section === activeSection) || NAV_SECTIONS[0]

  /* ── Breadcrumb label ── */
  const getPageLabel = () => {
    const path = location.pathname
    if (path === '/')                          return 'Dashboard'
    if (path === '/products')                  return 'Produits'
    if (path === '/stock')                     return 'Stock'
    if (path.startsWith('/stock/history'))     return 'Historique des mouvements'
    if (path === '/orders')                    return 'Commandes'
    if (path === '/import')                    return 'Import CSV'
    if (path === '/reset')                     return 'Réinitialisation'
    return 'NewApp'
  }

  return (
    <div className="layout">

      {/* ── Topnav ── */}
      <header className="topnav">
        <div className="tn-brand">
          <div className="tn-brand-icon">
            <i className="ti ti-shopping-cart" aria-hidden="true"></i>
          </div>
          <span className="tn-brand-name">Your'<span>Store</span></span>
        </div>

        <nav className="tn-links">
          {NAV_SECTIONS.map(s => (
            <button
              key={s.section}
              className={`tn-link ${activeSection === s.section ? 'active' : ''}`}
              onClick={() => navigate(s.items[0].to)}
            >
              <i className={`ti ${s.icon}`} aria-hidden="true"></i>
              {s.section}
            </button>
          ))}
        </nav>

        <div className="tn-right">
          <div className="tn-user">
            <div className="tn-avatar">
              {user?.firstname?.[0]}{user?.lastname?.[0]}
            </div>
            <span className="tn-username">
              {user?.firstname} {user?.lastname}
            </span>
          </div>
          <button
            className="tn-logout"
            onClick={handleLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <i className="ti ti-logout" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      {/* ── Body row : subnav + content ── */}
      <div className="body-row">

        {/* ── Subnav latéral contextuel ── */}
        <aside className="subnav">
          <p className="sn-section-title">{currentSection.section}</p>
          {currentSection.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `sn-item ${isActive ? 'active' : ''}`}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true"></i>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </aside>

        {/* ── Zone principale ── */}
        <div className="main">

          {/* ── Breadbar ── */}
          <div className="breadbar">
            <div className="breadcrumb">
              <i className="ti ti-home" aria-hidden="true"></i>
              <i className="ti ti-chevron-right" aria-hidden="true"></i>
              <span className="bc-section">{currentSection.section}</span>
              <i className="ti ti-chevron-right" aria-hidden="true"></i>
              <span className="bc-current">{getPageLabel()}</span>
            </div>

            <div className="quickstats" id="quickstats">
              {/* Les stats sont injectées dynamiquement depuis Dashboard ou via un contexte */}
              {/* Pour l'instant on laisse vide — à brancher sur le contexte global si besoin */}
            </div>
          </div>

          {/* ── Contenu de la page ── */}
          <main className="content">
            {children}
          </main>

        </div>
      </div>
    </div>
  )
}

export default Layout