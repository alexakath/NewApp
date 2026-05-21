import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useEnrichedOrders from '../hooks/useEnrichedOrders'
import useEnrichedStock from '../hooks/useEnrichedStock'
import useEnrichedProducts from '../hooks/useEnrichedProducts'
import useProfitStats from '../hooks/useProfitStats'
import { ORDER_STATES } from '../api/services/ordersService'
import './Dashboard.css'

const today = new Date().toISOString().split('T')[0]

const fmt = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const Dashboard = () => {
  const navigate = useNavigate()
  const [searchDate, setSearchDate] = useState('')

  const { orders, loading: loadingO, combinations } = useEnrichedOrders()
  const { stock,  loading: loadingS } = useEnrichedStock()
  const { products, loading: loadingP } = useEnrichedProducts()

  const loading = loadingO || loadingS || loadingP

  const profit = useProfitStats(orders, products, stock, combinations)

  const stats = {
    outOfStock: stock.filter(s => s.outOfStock).length,
    lowStock:   stock.filter(s => s.lowStock).length,
  }

  const isPaiementAccepte = (o) => o.stateId === ORDER_STATES.PAYMENT_ACCEPTED
  const isDansPanier      = (o) =>
    o.stateId === ORDER_STATES.IN_CART || o.type === 'cart' || (o.state || '').toLowerCase() === 'dans le panier'
  const isDelivered       = (o) => o.stateId === ORDER_STATES.DELIVERED
  const isAnnule    = (o) => o.stateId === ORDER_STATES.CANCELLED


  const paOrders        = orders.filter(isPaiementAccepte)
  const panierOrders    = orders.filter(isDansPanier)
  const livraisonOrders = orders.filter(isDelivered)
  const annuleOrders = orders.filter(isAnnule)


  const sum = (arr, field) => arr.reduce((s, o) => s + parseFloat(o[field] || 0), 0)

  const pa = {
    ttc:   sum(paOrders, 'totalTTC').toFixed(2),
    ht:    sum(paOrders, 'totalHT').toFixed(2),
    count: paOrders.length,
  }
  const panier = {
    ttc:   sum(panierOrders, 'totalTTC').toFixed(2),
    ht:    sum(panierOrders, 'totalHT').toFixed(2),
    count: panierOrders.length,
  }
  const livraison = {
    ttc:   sum(livraisonOrders, 'totalTTC').toFixed(2),
    ht:    sum(livraisonOrders, 'totalHT').toFixed(2),
    count: livraisonOrders.length,
  }
  const annule = {
    ttc:   sum(annuleOrders, 'totalTTC').toFixed(2),
    ht:    sum(annuleOrders, 'totalHT').toFixed(2),
    count: annuleOrders.length,
  }
  const total = {
    ttc:   (parseFloat(pa.ttc) + parseFloat(panier.ttc) + parseFloat(livraison.ttc) + parseFloat(annule.ttc)).toFixed(2),
    ht:    (parseFloat(pa.ht)  + parseFloat(panier.ht)  + parseFloat(livraison.ht) + parseFloat(annule.ht )).toFixed(2),
    count: pa.count + panier.count + livraison.count + annule.count,
  }

  const relevantOrders = orders.filter(o => isPaiementAccepte(o) || isDansPanier(o) || isDelivered(o))

  // const todayOrders = relevantOrders.filter(o => o.dateAdd === today)
  // const todayData = todayOrders.length > 0
  //   ? { count: todayOrders.length, total: todayOrders.reduce((s, o) => s + parseFloat(o.totalTTC || 0), 0), orders: todayOrders }
  //   : null

  const ordersByDay = {}
  relevantOrders.forEach((o) => {
    const day = o.dateAdd && o.dateAdd !== '—' ? o.dateAdd : null
    if (!day) return
    if (!ordersByDay[day]) ordersByDay[day] = { count: 0, total: 0, products: 0, orders: [] }
    ordersByDay[day].count    += 1
    ordersByDay[day].total    += parseFloat(o.totalTTC || 0)
    ordersByDay[day].products += parseInt(o.productCount || 0)
    ordersByDay[day].orders.push(o)
  })

  const days = Object.entries(ordersByDay).sort((a, b) => new Date(b[0]) - new Date(a[0]))
  const searchData = searchDate ? ordersByDay[searchDate] : null

  
  return (
    <div className="dashboard">

      {/* 4 colonnes financières — inchangées */}
      <div className="finance-grid finance-grid-4">

        <div className="finance-col finance-col-green">
          <p className="finance-col-title">
            <i className="ti ti-circle-check"></i>
            Commandes payées
          </p>
          <div className="finance-cards">
            <div className="finance-card">
              <span className="finance-label">Total TTC</span>
              <span className="finance-value">{loading ? '…' : `${pa.ttc} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Total HT</span>
              <span className="finance-value">{loading ? '…' : `${pa.ht} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Nb commandes</span>
              <span className="finance-value finance-count">{loading ? '…' : pa.count}</span>
            </div>
          </div>
        </div>

        <div className="finance-col finance-col-amber">
          <p className="finance-col-title">
            <i className="ti ti-shopping-cart"></i>
            Paniers en cours
          </p>
          <div className="finance-cards">
            <div className="finance-card">
              <span className="finance-label">Total TTC</span>
              <span className="finance-value">{loading ? '…' : `${panier.ttc} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Total HT</span>
              <span className="finance-value">{loading ? '…' : `${panier.ht} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Nb paniers</span>
              <span className="finance-value finance-count">{loading ? '…' : panier.count}</span>
            </div>
          </div>
        </div>

        <div className="finance-col finance-col-indigo">
          <p className="finance-col-title">
            <i className="ti ti-truck-delivery"></i>
            Livré
          </p>
          <div className="finance-cards">
            <div className="finance-card">
              <span className="finance-label">Total TTC</span>
              <span className="finance-value">{loading ? '…' : `${livraison.ttc} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Total HT</span>
              <span className="finance-value">{loading ? '…' : `${livraison.ht} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Nb livré</span>
              <span className="finance-value finance-count">{loading ? '…' : livraison.count}</span>
            </div>
          </div>
        </div>

        <div className="finance-col finance-col-pink">
          <p className="finance-col-title">
            <i className="ti ti-circle-x"></i>
            Annulé
          </p>
          <div className="finance-cards">
            <div className="finance-card">
              <span className="finance-label">Total TTC</span>
              <span className="finance-value">{loading ? '…' : `${annule.ttc} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Total HT</span>
              <span className="finance-value">{loading ? '…' : `${annule.ht} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Nb livré</span>
              <span className="finance-value finance-count">{loading ? '…' : annule.count}</span>
            </div>
          </div>
        </div>

        <div className="finance-col finance-col-blue">
          <p className="finance-col-title">
            <i className="ti ti-chart-bar"></i>
            Total général
          </p>
          <div className="finance-cards">
            <div className="finance-card">
              <span className="finance-label">Total TTC</span>
              <span className="finance-value">{loading ? '…' : `${total.ttc} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Total HT</span>
              <span className="finance-value">{loading ? '…' : `${total.ht} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Nb total</span>
              <span className="finance-value finance-count">{loading ? '…' : total.count}</span>
            </div>
          </div>
        </div>

        <div className="finance-col finance-col-teal">
          <p className="finance-col-title">
            <i className="ti ti-receipt"></i>
            Ventes HT
          </p>
          <div className="finance-cards">
            <div className="finance-card">
              <span className="finance-label">Montant HT</span>
              <span className="finance-value">{loading ? '…' : `${fmt(profit.ventesHT)} €`}</span>
            </div>
            <div className="finance-card">
              <span className="finance-label">Nb commandes</span>
              <span className="finance-value finance-count">{loading ? '…' : livraisonOrders.length}</span>
            </div>
          </div>
        </div>

        <div className="finance-col finance-col-rose">
          <p className="finance-col-title">
            <i className="ti ti-shopping-bag"></i>
            Achats HT
          </p>
          <div className="finance-cards">
            <div className="finance-card">
              <span className="finance-label">Coût total stock</span>
              {/* <span className="finance-value">{loading ? '…' : `${fmt(profit.achatsHT)} €`}</span> */}
              <span className="finance-value">{loading ? '…' : `${fmt(profit.byCategory.reduce((s, c) => s + c.achatsHT, 0))}€`}</span>
          
              
            </div>
            {/* <div className="finance-card">
              <span className="finance-label">Formule</span>
              <span className="finance-label" style={{ fontStyle: 'italic' }}>Σ (qté stock × prix achat)</span>
            </div> */}
          </div>
        </div>

      </div>


      {/* Row principale : aujourd'hui + total par jour */}
      {/* <div className="dashboard-row"> */}

        {/* ── Card Aujourd'hui (masquée) ── */}
        {/* <div className="dash-card today-card">
          <div className="today-header">
            <div>
              <p className="today-label">Aujourd'hui</p>
              <p className="today-date">{today}</p>
            </div>
            <div className="today-icon">
              <i className="ti ti-calendar-event"></i>
            </div>
          </div>

          {loading ? (
            <p className="dash-empty">Chargement...</p>
          ) : !todayData ? (
            <p className="dash-empty">Aucune commande aujourd'hui</p>
          ) : (
            <>
              <div className="today-stats">
                <div className="today-stat">
                  <span className="today-stat-val">{todayData.count}</span>
                  <span className="today-stat-lbl">commandes</span>
                </div>
                <div className="today-stat-divider"></div>
                <div className="today-stat">
                  <span className="today-stat-val">{todayData.total.toFixed(2)}</span>
                  <span className="today-stat-lbl">€ TTC</span>
                </div>
              </div>
              <table className="dash-mini-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Client</th>
                    <th>Montant</th>
                    <th>État</th>
                    <th>Modifié le</th>
                  </tr>
                </thead>
                <tbody>
                  {todayData.orders.map(o => (
                    <tr key={o.id}>
                      <td><strong>{o.reference}</strong></td>
                      <td>{o.customer}</td>
                      <td className="price">{o.totalTTC} €</td>
                      <td>
                        <span className="order-state-badge" style={{
                          background: `${o.stateColor}22`,
                          color: o.stateColor,
                          border: `0.5px solid ${o.stateColor}55`
                        }}>
                          {o.state}
                        </span>
                      </td>
                      <td className="muted">{o.dateUpd || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div> */}

        <div className="dash-card dash-card-fullwidth">
          <div className="dash-card-header">
            <p className="dash-card-title">
              <i className="ti ti-chart-bar"></i>
              Par jour
            </p>
            <div className="dash-card-header-right">
              <div className="day-filter">
                <i className="ti ti-calendar"></i>
                <input
                  type="date"
                  className="date-input"
                  value={searchDate}
                  onChange={e => setSearchDate(e.target.value)}
                />
                {searchDate && (
                  <button className="date-clear" onClick={() => setSearchDate('')}>
                    <i className="ti ti-x"></i>
                  </button>
                )}
              </div>
              <button className="dash-card-link" onClick={() => navigate('/orders')}>Voir tout →</button>
            </div>
          </div>

          {loading ? (
            <p className="dash-empty">Chargement...</p>
          ) : days.length === 0 ? (
            <p className="dash-empty">Aucune commande</p>
          ) : (
            <table className="dash-mini-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Cmd</th>
                  <th>Qté articles</th>
                  <th>États</th>
                  <th style={{ textAlign: 'right' }}>Montant TTC</th>
                  <th>Dern. modif.</th>
                </tr>
              </thead>
              <tbody>
                {(searchDate ? days.filter(([day]) => day === searchDate) : days).map(([day, data]) => {
                  const stateCounts = {}
                  data.orders.forEach(o => {
                    const key = o.state
                    if (!stateCounts[key]) stateCounts[key] = { count: 0, color: o.stateColor }
                    stateCounts[key].count++
                  })
                  const lastModif = data.orders
                    .map(o => o.dateUpd || '')
                    .filter(Boolean)
                    .sort()
                    .at(-1) || '—'
                  return (
                    <tr key={day} className={day === today ? 'row-today' : ''}>
                      <td>
                        {day === today
                          ? <span className="today-pill">Aujourd'hui</span>
                          : day}
                      </td>
                      <td><span className="count-badge">{data.count}</span></td>
                      <td><span className="count-badge">{data.products}</span></td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {Object.entries(stateCounts).map(([state, { count, color }]) => (
                            <span
                              key={state}
                              className="order-state-badge"
                              style={{
                                background: `${color}22`,
                                color,
                                border: `0.5px solid ${color}55`,
                                fontSize: '0.72rem',
                                padding: '1px 6px',
                              }}
                            >
                              {count > 1 ? `${count}× ` : ''}{state}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="price" style={{ textAlign: 'right' }}>{data.total.toFixed(2)} €</td>
                      <td className="muted">{lastModif}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td><strong>Total général</strong></td>
                  <td><strong>{relevantOrders.length}</strong></td>
                  <td><strong>{relevantOrders.reduce((s, o) => s + parseInt(o.productCount || 0), 0)}</strong></td>
                  <td></td>
                  <td className="price" style={{ textAlign: 'right' }}><strong>{relevantOrders.reduce((s, o) => s + parseFloat(o.totalTTC || 0), 0).toFixed(2)} €</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      {/* </div> */}

      
      {/* ── Tableau détail par catégorie ── */}
      <div className="dash-card">
        <div className="dash-card-header">
          <p className="dash-card-title">
            <i className="ti ti-category"></i>
            Bénéfice par catégorie
          </p>
        </div>

        {loading ? (
          <p className="dash-empty">Chargement...</p>
        ) : profit.byCategory.length === 0 ? (
          <p className="dash-empty">Aucune donnée disponible</p>
        ) : (
          <table className="dash-mini-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Ventes HT (livrées)</th>
                <th style={{ textAlign: 'right' }}>Achats HT (stock)</th>
                <th style={{ textAlign: 'right' }}>Bénéfice</th>
                <th style={{ textAlign: 'right' }}>Marge</th>
              </tr>
            </thead>
            <tbody>
              {profit.byCategory.map(cat => (
                <tr key={cat.name}>
                  <td><strong>{cat.name}</strong></td>
                  <td className="price" style={{ textAlign: 'right' }}>{fmt(cat.ventesHT)} €</td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>{fmt(cat.achatsHT)} €</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ color: cat.benefice >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                      {cat.benefice >= 0 ? '+' : ''}{fmt(cat.benefice)} €
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>
                    {cat.ventesHT === 0 ? '—' : `${((cat.benefice / cat.ventesHT) * 100).toFixed(1)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
  <tr className="total-row">
    <td><strong>Total</strong></td>
    <td className="price" style={{ textAlign: 'right' }}>
      <strong>{fmt(profit.byCategory.reduce((s, c) => s + c.ventesHT, 0))} €</strong>
    </td>
    <td style={{ textAlign: 'right' }}>
      <strong>{fmt(profit.byCategory.reduce((s, c) => s + c.achatsHT, 0))} €</strong>
    </td>
    <td style={{ textAlign: 'right' }}>
      {(() => {
        const v = profit.byCategory.reduce((s, c) => s + c.ventesHT, 0)
        const a = profit.byCategory.reduce((s, c) => s + c.achatsHT, 0)
        const b = v - a
        return (
          <strong style={{ color: b >= 0 ? '#16a34a' : '#dc2626' }}>
            {b >= 0 ? '+' : ''}{fmt(b)} €
          </strong>
        )
      })()}
    </td>
    <td style={{ textAlign: 'right', color: '#64748b' }}>
      {(() => {
        const v = profit.byCategory.reduce((s, c) => s + c.ventesHT, 0)
        const a = profit.byCategory.reduce((s, c) => s + c.achatsHT, 0)
        const b = v - a
        return <strong>{v === 0 ? '—' : `${((b / v) * 100).toFixed(1)} %`}</strong>
      })()}
    </td>
  </tr>
</tfoot>
          </table>
        )}
      </div>

      {/* Card recherche par date — inchangée */}
      {/* <div className="dash-card">
        <div className="dash-card-header">
          <p className="dash-card-title">
            <i className="ti ti-search"></i>
            Commandes par date
          </p>
        </div>

        <div className="date-search-bar">
          <i className="ti ti-calendar"></i>
          <input
            type="date"
            value={searchDate}
            onChange={e => setSearchDate(e.target.value)}
            className="date-input"
          />
          {searchDate && (
            <button className="date-clear" onClick={() => setSearchDate('')}>
              <i className="ti ti-x"></i>
            </button>
          )}
        </div>

        {searchDate && (
          !searchData ? (
            <p className="dash-empty">Aucune commande le {searchDate}</p>
          ) : (
            <>
              <div className="search-result-summary">
                <span className="count-badge">{searchData.count} commande{searchData.count > 1 ? 's' : ''}</span>
                <span className="search-total">{searchData.total.toFixed(2)} € TTC</span>
              </div>
              <table className="dash-mini-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Client</th>
                    <th>Transporteur</th>
                    <th>Montant HT</th>
                    <th>Montant TTC</th>
                    <th>État</th>
                    <th>Modifié le</th>
                  </tr>
                </thead>
                <tbody>
                  {searchData.orders.map(o => (
                    <tr key={o.id}>
                      <td><strong>{o.reference}</strong></td>
                      <td>{o.customer}</td>
                      <td className="muted">{o.carrier}</td>
                      <td className="price">{o.totalHT} €</td>
                      <td className="price">{o.totalTTC} €</td>
                      <td>
                        <span className="order-state-badge" style={{
                          background: `${o.stateColor}22`,
                          color: o.stateColor,
                          border: `0.5px solid ${o.stateColor}55`
                        }}>
                          {o.state}
                        </span>
                      </td>
                      <td className="muted">{o.dateUpd || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        )}

        {!searchDate && (
          <p className="dash-empty" style={{ paddingTop: 8 }}>Sélectionnez une date pour voir le détail</p>
        )}
      </div> */}

    </div>
  )
}

export default Dashboard