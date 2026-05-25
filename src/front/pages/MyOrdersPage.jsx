import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import { frontIsAuthenticated, frontGetCurrentUser } from '../services/frontAuthService'
import useMyOrders from '../hooks/useMyOrders'
import { prepareDuplicateCart } from '../../api/services/ordersService'
import './MyOrdersPage.css'

// ----------------------------------------------------------------------
// SOUS-COMPOSANT : Le Popup (Modal) de Duplication
// ----------------------------------------------------------------------
const OrderDuplicationModal = ({ order, onClose, navigate }) => {
  const [multiplier, setMultiplier] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleActionSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      // Appel du service pour générer le panier PrestaShop
      const newCart = await prepareDuplicateCart(order.id, multiplier)
      
      // Extraction de l'ID du panier (gestion du format XML parsé)
      const newCartId = newCart?.id?.['#text'] || newCart?.id

      if (!newCartId) throw new Error("Impossible de récupérer l'ID du nouveau panier")

      // Fermeture et redirection immédiate avec le cartId en mémoire d'état
      onClose()
      navigate(`/shop/order-confirm/${newCartId}`, { state: { cartId: newCartId } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dup-modal-backdrop">
      <div className="dup-modal-box">
        <h2 className="dup-modal-title">Duplication — Réf. {order.reference} (ID #{order.id})</h2>

        {error && <div className="dup-modal-error"><i className="ti ti-alert-circle"></i> {error}</div>}

        <div className="dup-modal-products">
          <h3>Produits à dupliquer</h3>
          <ul>
            {order.products?.map((p, index) => (
              <li key={index}>
                <span className="mo-product-qty">×{p.qty}</span>
                <span className="mo-product-name">{p.name}</span>
                <span className="dup-modal-result">→ ×{p.qty * multiplier}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dup-modal-field">
          <label>Multiplicateur :</label>
          <input
            type="number"
            min="1"
            value={multiplier}
            onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={loading}
            className="dup-modal-multiplier-input"
          />
        </div>

        <div className="dup-modal-actions">
          <button onClick={onClose} disabled={loading} className="dup-modal-btn-cancel">
            Annuler
          </button>
          <button onClick={handleActionSubmit} disabled={loading} className="dup-modal-btn-submit">
            {loading ? 'Création du panier...' : 'Ajouter au panier'}
          </button>
        </div>
      </div>
    </div>
  )
}

const MyOrdersPage = () => {
  const navigate = useNavigate()
  const user     = frontGetCurrentUser()

  if (!frontIsAuthenticated()) {
    return (
      <FrontLayout>
        <div className="my-orders-empty">
          <i className="ti ti-lock"></i>
          <p>Connectez-vous pour voir vos commandes.</p>
          <button onClick={() => navigate('/shop/login')}>Se connecter</button>
        </div>
      </FrontLayout>
    )
  }

  return (
    <FrontLayout>
      <MyOrdersContent user={user} navigate={navigate} />
    </FrontLayout>
  )
}

const MyOrdersContent = ({ user, navigate }) => {
  const { orders, loading, error } = useMyOrders(user?.id)
  
  // État pour la commande sélectionnée dans le popup (null = popup fermé)
  const [selectedOrderForDuplication, setSelectedOrderForDuplication] = useState(null)

  if (loading) return <div className="my-orders-status"><i className="ti ti-loader-2 spin"></i> Chargement...</div>
  if (error) return <div className="my-orders-status my-orders-error">Erreur : {error}</div>

  return (
    <div className="my-orders-wrapper">
      <div className="my-orders-header">
        <h1 className="my-orders-title">Mes commandes</h1>
        <span className="my-orders-count">{orders.length} commande{orders.length !== 1 ? 's' : ''}</span>
      </div>

      {orders.length === 0 ? (
        <div className="my-orders-empty">
          <p>Vous n'avez pas encore de commande.</p>
        </div>
      ) : (
        <div className="my-orders-table-wrap">
          <table className="my-orders-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>État</th>
                <th>Produits</th>
                <th>Total TTC</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((item) => {
                const stateClean = (item.state || '').toLowerCase().trim()
                
                // RÈGLE : Uniquement disponible pour "paiement effectué" et "livré"
                const canDuplicate = stateClean === 'paiement accepté' || stateClean === 'livré'

                return (
                  <tr key={item.id}>
                    <td className="my-orders-ref"><strong>{item.reference}</strong></td>
                    <td>
                      <span className="my-orders-badge" style={{ background: `${item.stateColor}22`, color: item.stateColor }}>
                        {item.state}
                      </span>
                    </td>
                    <td className="my-orders-products">
                      {item.products?.map((p, i) => (
                        <div key={i}>×{p.qty} {p.name}</div>
                      ))}
                    </td>
                    <td className="my-orders-total">{item.totalTTC} €</td>
                    <td className="my-orders-date">{item.dateAdd}</td>
                    <td style={{ textAlign: 'right' }}>
                      {canDuplicate && (
                        <button 
                          className="my-orders-action-btn"
                          onClick={() => setSelectedOrderForDuplication(item)}
                        >
                          <i className="ti ti-copy"></i> +commander
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rendu conditionnel du Popup */}
      {selectedOrderForDuplication && (
        <OrderDuplicationModal 
          order={selectedOrderForDuplication} 
          onClose={() => setSelectedOrderForDuplication(null)} 
          navigate={navigate}
        />
      )}
    </div>
  )
}

export default MyOrdersPage
