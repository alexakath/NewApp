import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import axiosInstance from '../../api/axiosInstance'
import { parseXML } from '../../api/xmlParser'
import { frontIsAuthenticated, frontGetCurrentUser, frontLoginDirect, frontIsAnonymous } from '../services/frontAuthService'
import './FrontHomePage.css'

const ANONYMOUS_ID = '1'

const toArray = (data) => {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

const getVal = (field) => {
  if (field === null || field === undefined) return ''
  if (typeof field === 'object' && field['#text'] !== undefined) return field['#text']
  return field
}

/**
 * Merge les articles du panier anonyme dans le panier du vrai client.
 * - Si un article existe déjà dans le panier cible, on additionne les quantités.
 * - Le panier anonyme est vidé après transfert.
 */
const mergeAnonymousCart = (targetCustomerId) => {
  const anonCartKey   = `front_cart_${ANONYMOUS_ID}`
  const targetCartKey = `front_cart_${targetCustomerId}`

  const anonItems   = JSON.parse(localStorage.getItem(anonCartKey)   || '[]')
  const targetItems = JSON.parse(localStorage.getItem(targetCartKey) || '[]')

  if (anonItems.length === 0) return // rien à transférer

  const merged = [...targetItems]

  for (const anonItem of anonItems) {
    const existing = merged.find(i => i.itemId === anonItem.itemId)
    if (existing) {
      existing.qty += anonItem.qty
    } else {
      merged.push({ ...anonItem })
    }
  }

  localStorage.setItem(targetCartKey, JSON.stringify(merged))
  // Vider le panier anonyme
  localStorage.setItem(anonCartKey, JSON.stringify([]))
  window.dispatchEvent(new Event('storage'))
}

const FrontHomePage = () => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const navigate   = useNavigate()
  const isLoggedIn = frontIsAuthenticated()
  const currentUser = frontGetCurrentUser()
  const isAnon      = frontIsAnonymous()

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true)
        const response = await axiosInstance.get('/customers?display=full')
        const data = parseXML(response.data)
        const raw = toArray(data?.prestashop?.customers?.customer)
        const list = raw
          .filter(c => getVal(c.active) == 1 && String(getVal(c.id)) !== ANONYMOUS_ID)
          .map(c => ({
            id:        getVal(c.id),
            firstname: getVal(c.firstname) || '—',
            lastname:  getVal(c.lastname)  || '—',
            email:     getVal(c.email)     || '—',
            dateAdd:   getVal(c.date_add)?.split(' ')[0] || '—',
          }))
        setCustomers(list)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchCustomers()
  }, [])

  const handleAccess = (customer) => {
    // Même utilisateur déjà connecté (non anonyme) → continuer
    if (isLoggedIn && !isAnon && currentUser?.email === customer.email) {
      navigate('/shop/products')
      return
    }

    // Si on vient du mode anonyme, transférer le panier avant de switcher
    if (isAnon) {
      mergeAnonymousCart(customer.id)
    }

    // Connexion directe sans saisie de mot de passe
    frontLoginDirect(customer)
    navigate('/shop/cart')
  }

  return (
    <FrontLayout>
      <div className="home-header">
        <h2 className="home-section-title">
          {isAnon ? 'Choisissez votre compte pour commander' : 'Comptes disponibles'}
        </h2>
        <p className="home-section-sub">
          {isAnon
            ? 'Votre panier sera automatiquement transféré vers le compte sélectionné.'
            : isLoggedIn
              ? `Connecté en tant que ${currentUser?.firstname} ${currentUser?.lastname}`
              : 'Sélectionnez votre compte pour vous connecter'}
        </p>
      </div>

      {loading && <p className="home-status">Chargement des utilisateurs...</p>}
      {error   && <p className="home-status home-error">Erreur : {error}</p>}
      {!loading && !error && customers.length === 0 && (
        <p className="home-status">Aucun utilisateur trouvé.</p>
      )}

      {!loading && !error && customers.length > 0 && (
        <div className="home-grid">
          {customers.map(c => {
            const isCurrentUser = isLoggedIn && !isAnon && currentUser?.email === c.email
            return (
              <div
                className={`home-card ${isCurrentUser ? 'home-card-active' : ''}`}
                key={c.id}
              >
                <div className={`home-card-avatar ${isCurrentUser ? 'home-card-avatar-active' : ''}`}>
                  {String(c.firstname ?? '').charAt(0).toUpperCase()}{String(c.lastname ?? '').charAt(0).toUpperCase()}
                </div>
                <div className="home-card-info">
                  <p className="home-card-name">
                    {c.firstname} {c.lastname}
                    {isCurrentUser && (
                      <span className="home-card-connected-badge">
                        <i className="ti ti-circle-check"></i> Connecté
                      </span>
                    )}
                  </p>
                  <p className="home-card-email">{c.email}</p>
                  <p className="home-card-date">Inscrit le {c.dateAdd}</p>
                </div>
                <button
                  className={`home-card-btn ${isCurrentUser ? 'home-card-btn-active' : ''}`}
                  onClick={() => handleAccess(c)}
                >
                  {isCurrentUser ? 'Continuer →' : isAnon ? 'Accéder et commander' : 'Accéder'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </FrontLayout>
  )
}

export default FrontHomePage