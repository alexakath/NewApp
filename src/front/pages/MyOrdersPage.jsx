import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import { frontIsAuthenticated, frontGetCurrentUser } from '../services/frontAuthService'
import useMyOrders from '../hooks/useMyOrders'
import { duplicateOrderWithMultiplier } from '../../api/services/ordersService'
import './MyOrdersPage.css'

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
  const { orders, loading, error, refreshOrders } = useMyOrders(user?.id)
  
  // États locaux pour l'actionneur de duplication
  const [multipliers, setMultipliers] = useState({}) 
  const [processingId, setProcessingId] = useState(null) 
  const [actionMessage, setActionMessage] = useState({ text: '', isError: false })

  if (loading) {
    return (
      <div className="my-orders-status">
        <i className="ti ti-loader-2 spin"></i>
        Chargement de vos commandes...
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-orders-status my-orders-error">
        <i className="ti ti-alert-circle"></i>
        Erreur : {error}
      </div>
    )
  }

  const handleMultiplierChange = (orderId, val) => {
    const num = Math.max(1, Math.min(100, parseInt(val, 10) || 1))
    setMultipliers(prev => ({ ...prev, [orderId]: num }))
  }

  const handleReorder = async (orderId) => {
    const coeff = multipliers[orderId] || 1
    setProcessingId(orderId)
    setActionMessage({ text: '', isError: false })

    try {
      const newId = await duplicateOrderWithMultiplier(orderId, coeff)
      setActionMessage({ 
        text: `Succès ! La commande #${orderId} a été clonée. Nouvelle commande : #${newId}`, 
        isError: false 
      })
      
      if (typeof refreshOrders === 'function') {
        refreshOrders()
      } else {
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (err) {
      setActionMessage({ 
        text: `Échec du clonage : ${err.message}`, 
        isError: true 
      })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="my-orders-wrapper">
      <div className="my-orders-header">
        <h1 className="my-orders-title">Mes commandes</h1>
        {!loading && (
          <span className="my-orders-count">
            {orders.length} commande{orders.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Message de Notification Dynamique */}
      {actionMessage.text && (
        <div className={`action-msg ${actionMessage.isError ? 'action-msg-error' : 'action-msg-success'}`}>
          <i className={`ti ${actionMessage.isError ? 'ti-circle-x' : 'ti-circle-check'}`}></i>
          <span>{actionMessage.text}</span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="my-orders-empty">
          <i className="ti ti-clipboard-list"></i>
          <p>Vous n'avez pas encore de commande.</p>
          <button onClick={() => navigate('/shop/products')}>Découvrir nos produits</button>
        </div>
      ) : (
        <div className="my-orders-table-wrap">
          <table className="my-orders-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>État</th>
                <th>Total TTC</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions / Multiplicateur</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((item) => {
                const currentCoeff = multipliers[item.id] || 1
                const isCurrentProcessing = processingId === item.id
                const isCart = item.type === 'cart' || (item.state || '').toLowerCase() === 'dans le panier'

                return (
                  <tr key={item.id}>
                    <td className="my-orders-ref">
                      {item.reference !== '—'
                        ? <strong>{item.reference}</strong>
                        : <span className="my-orders-dash">—</span>
                      }
                    </td>
                    <td>
                      <span
                        className="my-orders-badge"
                        style={{
                          background: `${item.stateColor}22`,
                          color:      item.stateColor,
                          border:     `0.5px solid ${item.stateColor}55`,
                        }}
                      >
                        {item.state}
                      </span>
                    </td>
                    <td className="my-orders-total">
                      {item.totalTTC !== '0.00' ? `${item.totalTTC} €` : '—'}
                    </td>
                    <td className="my-orders-date">{item.dateAdd}</td>
                    
                    {/* Actions alignées à droite */}
                    <td className="my-orders-actions-cell">
                      {isCart ? (
                        <button
                          className="my-orders-action-btn"
                          onClick={() => navigate('/shop/cart')}
                        >
                          <i className="ti ti-shopping-cart"></i>
                          Finaliser
                        </button>
                      ) : (
                        <div className="my-orders-actions-inner">
                          {/* Sélecteur de quantité */}
                          <div className="my-orders-multiplier">
                            <span className="my-orders-multiplier-x">x</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={currentCoeff}
                              onChange={(e) => handleMultiplierChange(item.id, e.target.value)}
                              disabled={!!processingId}
                              className="my-orders-multiplier-input"
                            />
                          </div>

                          {/* Bouton d'action */}
                          <button
                            className={`my-orders-action-btn my-orders-reorder-btn${processingId ? ' processing' : ''}`}
                            disabled={!!processingId}
                            onClick={() => handleReorder(item.id)}
                          >
                            {isCurrentProcessing ? (
                              <>
                                <i className="ti ti-loader-2 spin"></i>
                                Vérification...
                              </>
                            ) : (
                              <>
                                <i className="ti ti-copy"></i>
                                Recommander
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MyOrdersPage
