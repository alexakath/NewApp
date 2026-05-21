import { useState } from 'react'
import useEnrichedOrders from '../hooks/useEnrichedOrders'
import { ORDER_STATES, changeOrderState } from '../api/services/ordersService'
import './List.css'

const isDansPanier = (stateId, stateName) =>
  stateId === ORDER_STATES.IN_CART ||
  (stateName || '').toLowerCase() === 'dans le panier'

const FILTER_OPTIONS = [
  { value: 'all',       label: 'Tous les états' },
  { value: 'paid',      label: 'Paiement accepté' },
  { value: 'delivered', label: 'Livré' },
  { value: 'cancelled', label: 'Annulé' },
]

const OrdersList = () => {
  const { orders, loading, error, refresh } = useEnrichedOrders()
  const [filterState, setFilterState] = useState('all')
  const [updatingId,  setUpdatingId]  = useState(null)
  const [actionError, setActionError] = useState(null)

  if (loading) return <div className="loading">Chargement des commandes...</div>
  if (error)   return <div className="error">{error}</div>

  if (orders.length === 0) return (
    <div className="empty-state">
      <i className="ti ti-clipboard-list" aria-hidden="true"></i>
      <p>Aucune commande détectée</p>
      <span>Importez des commandes via la page Import CSV</span>
    </div>
  )

  const handleChangeState = async (orderId, newStateId) => {
    setUpdatingId(orderId)
    setActionError(null)
    try {
      await changeOrderState(orderId, newStateId)
      refresh()
    } catch (err) {
      const msg = err.response?.data
        ? String(err.response.data).slice(0, 200)
        : err.message
      setActionError({ id: orderId, message: msg })
      console.error('[OrdersList] changeOrderState error:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = orders.filter(o => {
  if (isDansPanier(o.stateId, o.state)) return false
  if (filterState === 'all') return true
    const sid   = o.stateId
    const sname = o.state
    if (filterState === 'paid')      return o.stateId === ORDER_STATES.PAYMENT_ACCEPTED
  if (filterState === 'delivered') return o.stateId === ORDER_STATES.DELIVERED
  if (filterState === 'cancelled') return o.stateId === ORDER_STATES.CANCELLED
  return true
})

  return (
    <div className="list-container">
      <div className="list-header">
        <h1>Commandes</h1>
        <span className="badge">{filtered.length}</span>

        <div className="orders-filter">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`filter-btn ${filterState === opt.value ? 'active' : ''}`}
              onClick={() => setFilterState(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <table className="list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Référence</th>
            <th>Client</th>
            <th>Transporteur</th>
            <th>Total HT</th>
            <th>Total TTC</th>
            <th>Devise</th>
            <th>Produits</th>
            <th>État</th>
            <th>Date</th>
            <th>Modifié le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((order) => {
            const stateId     = order.stateId
            const stateName   = order.state
            const inCart      = isDansPanier(stateId, stateName)
            const isPaid      = stateId === ORDER_STATES.PAYMENT_ACCEPTED
            const isDelivered = stateId === ORDER_STATES.DELIVERED
            const isUpdating  = updatingId === order.id
            const hasError    = actionError?.id === order.id
            const showLivrer  = isPaid && !isDelivered
            const showAnnuler = (isPaid || inCart) && !isDelivered

            return (
              <tr key={order.id}>
                <td className="id-cell">#{order.id}</td>
                <td><strong>{order.reference}</strong></td>
                <td className="name-cell">{order.customer}</td>
                <td className="date-cell">{order.carrier}</td>
                <td className="price-cell">{order.totalHT} €</td>
                <td className="price-cell">{order.totalTTC} €</td>
                <td className="date-cell">{order.currency}</td>
                <td>
                  <span className="count-badge">
                    <i className="ti ti-box" aria-hidden="true"></i>
                    {order.productCount}
                  </span>
                </td>

                <td>
                  <span
                    className="order-state-badge"
                    style={{
                      background: `${order.stateColor}22`,
                      color:       order.stateColor,
                      border:      `0.5px solid ${order.stateColor}55`,
                    }}
                  >
                    {stateName}
                  </span>
                </td>

                <td className="date-cell">{order.dateAdd}</td>
                <td className="date-cell">{order.dateUpd || '—'}</td>

                <td>
                  {isUpdating ? (
                    <span className="state-updating">
                      <i className="ti ti-loader-2 spin" aria-hidden="true"></i>
                    </span>
                  ) : (
                    <div className="order-actions">
                      {showLivrer && (
                        <button
                          className="action-text-btn"
                          onClick={() => handleChangeState(order.id, ORDER_STATES.DELIVERED)}
                        >
                          Livrer
                        </button>
                      )}
                      {showAnnuler && (
                        <button
                          className="action-text-btn action-text-cancel"
                          onClick={() => handleChangeState(order.id, ORDER_STATES.CANCELLED)}
                        >
                          Annuler
                        </button>
                      )}
                      {hasError && (
                        <p className="state-error" title={actionError.message}>Erreur</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default OrdersList
