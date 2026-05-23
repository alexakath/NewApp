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
  const [activeTab, setActiveTab] = useState('jours')

  const { orders, loading: loadingO, combinations } = useEnrichedOrders()
  const { stock,  loading: loadingS } = useEnrichedStock()
  const { products, loading: loadingP } = useEnrichedProducts()

  const loading = loadingO || loadingS || loadingP
  const profit = useProfitStats(orders, products, stock, combinations)

  const isPaiementAccepte = (o) => o.stateId === ORDER_STATES.PAYMENT_ACCEPTED
  const isDansPanier      = (o) => o.stateId === ORDER_STATES.IN_CART || o.type === 'cart' || (o.state || '').toLowerCase() === 'dans le panier'
  const isDelivered       = (o) => o.stateId === ORDER_STATES.DELIVERED
  const isAnnule          = (o) => o.stateId === ORDER_STATES.CANCELLED

  const paOrders        = orders.filter(isPaiementAccepte)
  const panierOrders    = orders.filter(isDansPanier)
  const livraisonOrders = orders.filter(isDelivered)
  const annuleOrders    = orders.filter(isAnnule)

  const sum = (arr, f) => arr.reduce((s, o) => s + parseFloat(o[f] || 0), 0)

  const pa        = { ttc: sum(paOrders,        'totalTTC'), count: paOrders.length }
  const panier    = { ttc: sum(panierOrders,    'totalTTC'), count: panierOrders.length }
  const livraison = { ttc: sum(livraisonOrders, 'totalTTC'), count: livraisonOrders.length }
  const annule    = { ttc: sum(annuleOrders,    'totalTTC'), count: annuleOrders.length }

  const totalTTC   = pa.ttc + panier.ttc + livraison.ttc + annule.ttc
  const totalCount = pa.count + panier.count + livraison.count + annule.count

  const outOfStock = stock.filter(s => s.outOfStock).length
  const lowStock   = stock.filter(s => s.lowStock).length

  const ventesHT = profit.ventesHT
  const achatsHT = profit.byCategory.reduce((s, c) => s + c.achatsHT, 0)
  const benefice = ventesHT - achatsHT
  const margeGlob = ventesHT > 0 ? ((benefice / ventesHT) * 100).toFixed(1) : null

  const relevantOrders = orders.filter(o => isPaiementAccepte(o) || isDansPanier(o) || isDelivered(o))

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

  return (
    <div className="db-root">

      {/* ══ HERO BAND ══ */}
      <div className="db-hero">
        <div className="db-hero-left">
          <p className="db-hero-eyebrow">
            <i className="ti ti-chart-bar" aria-hidden="true" />
            Vue d'ensemble
          </p>
          <h2 className="db-hero-total">
            {loading ? <span className="db-ghost db-ghost-xl" /> : `${fmt(totalTTC)} €`}
          </h2>
          <p className="db-hero-sub">Chiffre d'affaires TTC · toutes commandes</p>
        </div>

        <div className="db-hero-right">
          {[
            { val: loading ? null : totalCount,    lbl: 'commandes',   cls: ''                 },
            { val: loading ? null : products.length, lbl: 'produits',  cls: ''                 },
            { val: loading ? null : outOfStock,    lbl: 'ruptures',    cls: outOfStock > 0 ? 'db-val-danger' : 'db-val-ok' },
            { val: loading ? null : lowStock,      lbl: 'stock faible',cls: lowStock > 0 ? 'db-val-warn' : ''             },
          ].map((s, i) => (
            <div key={i} className="db-hero-stat">
              {i > 0 && <div className="db-hero-sep" />}
              <span className={`db-hero-stat-val ${s.cls}`}>
                {s.val === null ? <span className="db-ghost db-ghost-sm" /> : s.val}
              </span>
              <span className="db-hero-stat-lbl">{s.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ BANDES STATUT ══ */}
      <div className="db-strips">
        {[
          { label: 'Payées',   count: pa.count,        ttc: pa.ttc,        accent: '#4ade80', icon: 'ti-circle-check'   },
          { label: 'Paniers',  count: panier.count,    ttc: panier.ttc,    accent: '#fbbf24', icon: 'ti-shopping-cart'  },
          { label: 'Livrées',  count: livraison.count, ttc: livraison.ttc, accent: '#818cf8', icon: 'ti-truck-delivery' },
          { label: 'Annulées', count: annule.count,    ttc: annule.ttc,    accent: '#f87171', icon: 'ti-circle-x'       },
        ].map(s => (
          <div className="db-strip" key={s.label} style={{ '--strip-accent': s.accent }}>
            <i className={`ti ${s.icon} db-strip-icon`} aria-hidden="true" />
            <div className="db-strip-body">
              <span className="db-strip-label">{s.label}</span>
              <span className="db-strip-count">{loading ? '—' : s.count}</span>
            </div>
            <span className="db-strip-amount">{loading ? '—' : `${fmt(s.ttc)} €`}</span>
          </div>
        ))}
      </div>

      {/* ══ CORPS : colonne large + sidebar ══ */}
      <div className="db-body">

        {/* ── Colonne principale ── */}
        <div className="db-main-col">

          <div className="db-tabs-bar">
            <div className="db-tabs">
              {['jours', 'catégories'].map(tab => (
                <button
                  key={tab}
                  className={`db-tab ${activeTab === tab ? 'db-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <i className={`ti ${tab === 'jours' ? 'ti-calendar-week' : 'ti-category'}`} aria-hidden="true" />
                  {tab === 'jours' ? 'Par jour' : 'Par catégorie'}
                </button>
              ))}
            </div>

            {activeTab === 'jours' && (
              <div className="db-tab-actions">
                <div className="db-date-wrap">
                  <i className="ti ti-filter" aria-hidden="true" />
                  <input
                    type="date"
                    className="db-date-input"
                    value={searchDate}
                    onChange={e => setSearchDate(e.target.value)}
                    aria-label="Filtrer par date"
                  />
                  {searchDate && (
                    <button className="db-date-clear" onClick={() => setSearchDate('')} aria-label="Effacer">
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <button className="db-see-all" onClick={() => navigate('/orders')}>
                  Voir toutes <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {activeTab === 'jours' && (
            loading ? (
              <div className="db-skeletons">
                {[1,2,3,4].map(i => <div key={i} className="db-skeleton-row" />)}
              </div>
            ) : days.length === 0 ? (
              <div className="db-empty">
                <i className="ti ti-calendar-off" aria-hidden="true" />
                <span>Aucune commande enregistrée</span>
              </div>
            ) : (
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Cmd</th>
                    <th>Articles</th>
                    <th>États</th>
                    <th className="db-ar">Montant TTC</th>
                    <th>Modifié</th>
                  </tr>
                </thead>
                <tbody>
                  {(searchDate ? days.filter(([d]) => d === searchDate) : days).map(([day, data]) => {
                    const stateCounts = {}
                    data.orders.forEach(o => {
                      if (!stateCounts[o.state]) stateCounts[o.state] = { count: 0, color: o.stateColor }
                      stateCounts[o.state].count++
                    })
                    const lastModif = data.orders.map(o => o.dateUpd || '').filter(Boolean).sort().at(-1) || '—'
                    const isT = day === today
                    return (
                      <tr key={day} className={isT ? 'db-tr-today' : ''}>
                        <td>
                          {isT
                            ? <span className="db-pill-today">Aujourd'hui</span>
                            : <span className="db-date-txt">{day}</span>
                          }
                        </td>
                        <td><span className="db-num-badge">{data.count}</span></td>
                        <td><span className="db-num-badge">{data.products}</span></td>
                        <td>
                          <div className="db-pills-wrap">
                            {Object.entries(stateCounts).map(([state, { count, color }]) => (
                              <span key={state} className="db-state-pill" style={{ '--c': color }}>
                                {count > 1 ? `${count}× ` : ''}{state}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="db-ar db-price">{data.total.toFixed(2)} €</td>
                        <td className="db-muted">{lastModif}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{relevantOrders.length}</strong></td>
                    <td><strong>{relevantOrders.reduce((s, o) => s + parseInt(o.productCount || 0), 0)}</strong></td>
                    <td />
                    <td className="db-ar db-price"><strong>{relevantOrders.reduce((s, o) => s + parseFloat(o.totalTTC || 0), 0).toFixed(2)} €</strong></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )
          )}

          {activeTab === 'catégories' && (
            loading ? (
              <div className="db-skeletons">
                {[1,2,3].map(i => <div key={i} className="db-skeleton-row" />)}
              </div>
            ) : profit.byCategory.length === 0 ? (
              <div className="db-empty">
                <i className="ti ti-folders" aria-hidden="true" />
                <span>Aucune donnée disponible</span>
              </div>
            ) : (
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Catégorie</th>
                    <th className="db-ar">Ventes HT</th>
                    <th className="db-ar">Achats HT</th>
                    <th className="db-ar">Bénéfice</th>
                    <th className="db-ar">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {profit.byCategory.map(cat => {
                    const pos = cat.benefice >= 0
                    const marge = cat.ventesHT > 0 ? ((cat.benefice / cat.ventesHT) * 100).toFixed(1) : null
                    return (
                      <tr key={cat.name}>
                        <td className="db-cat-cell">
                          <span className="db-cat-dot" />
                          {cat.name}
                        </td>
                        <td className="db-ar db-price">{fmt(cat.ventesHT)} €</td>
                        <td className="db-ar db-muted">{fmt(cat.achatsHT)} €</td>
                        <td className="db-ar">
                          <span className={pos ? 'db-pos' : 'db-neg'}>{pos ? '+' : ''}{fmt(cat.benefice)} €</span>
                        </td>
                        <td className="db-ar">
                          {marge === null
                            ? <span className="db-muted">—</span>
                            : <span className={`db-marge-tag ${pos ? 'db-marge-pos' : 'db-marge-neg'}`}>{marge} %</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const v = profit.byCategory.reduce((s, c) => s + c.ventesHT, 0)
                    const a = profit.byCategory.reduce((s, c) => s + c.achatsHT, 0)
                    const b = v - a
                    const pos = b >= 0
                    return (
                      <tr>
                        <td><strong>Total</strong></td>
                        <td className="db-ar db-price"><strong>{fmt(v)} €</strong></td>
                        <td className="db-ar db-muted"><strong>{fmt(a)} €</strong></td>
                        <td className="db-ar"><strong className={pos ? 'db-pos' : 'db-neg'}>{pos ? '+' : ''}{fmt(b)} €</strong></td>
                        <td className="db-ar db-muted"><strong>{v > 0 ? `${((b / v) * 100).toFixed(1)} %` : '—'}</strong></td>
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            )
          )}
        </div>

        {/* ── Sidebar droite ── */}
        <aside className="db-sidebar">

          <div className="db-sb-block">
            <p className="db-sb-label">
              <i className="ti ti-chart-line" aria-hidden="true" />
              Performance
            </p>
            <div className="db-perf-rows">
              <div className="db-perf-row">
                <span className="db-perf-key">Ventes HT</span>
                <span className="db-perf-val">{loading ? '—' : `${fmt(ventesHT)} €`}</span>
              </div>
              <div className="db-perf-row">
                <span className="db-perf-key">Achats HT</span>
                <span className="db-perf-val db-muted">{loading ? '—' : `${fmt(achatsHT)} €`}</span>
              </div>
              <div className="db-perf-line" />
              <div className="db-perf-row db-perf-big">
                <span className="db-perf-key">Bénéfice net</span>
                <span className={`db-perf-big-val ${benefice >= 0 ? 'db-pos' : 'db-neg'}`}>
                  {loading ? '—' : `${benefice >= 0 ? '+' : ''}${fmt(benefice)} €`}
                </span>
              </div>
              {margeGlob !== null && !loading && (
                <div className="db-marge-wrap">
                  <div className="db-marge-track">
                    <div
                      className={`db-marge-fill ${benefice >= 0 ? 'db-marge-fill-pos' : 'db-marge-fill-neg'}`}
                      style={{ width: `${Math.min(Math.abs(parseFloat(margeGlob)), 100)}%` }}
                    />
                  </div>
                  <span className="db-marge-lbl">{margeGlob} % de marge</span>
                </div>
              )}
            </div>
          </div>

          <div className="db-sb-block">
            <p className="db-sb-label">
              <i className="ti ti-package" aria-hidden="true" />
              Stock
            </p>
            <div className="db-stock-rows">
              {[
                { dot: 'db-dot-ok',     key: 'Disponibles', val: loading ? '—' : stock.filter(s => !s.outOfStock && !s.lowStock).length, cls: '' },
                { dot: 'db-dot-warn',   key: 'Stock faible',val: loading ? '—' : lowStock,   cls: lowStock > 0   ? 'db-val-warn'   : '' },
                { dot: 'db-dot-danger', key: 'Ruptures',    val: loading ? '—' : outOfStock,  cls: outOfStock > 0 ? 'db-val-danger' : '' },
              ].map(r => (
                <div className="db-stock-row" key={r.key}>
                  <span className={`db-dot ${r.dot}`} />
                  <span className="db-perf-key">{r.key}</span>
                  <span className={`db-perf-val ${r.cls}`}>{r.val}</span>
                </div>
              ))}
            </div>
            <button className="db-sb-link" onClick={() => navigate('/stock')}>
              Gérer le stock <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          </div>

          <div className="db-sb-block">
            <p className="db-sb-label">
              <i className="ti ti-bolt" aria-hidden="true" />
              Accès rapide
            </p>
            <div className="db-shortcuts">
              {[
                { label: 'Produits',   icon: 'ti-box',            to: '/products' },
                { label: 'Commandes',  icon: 'ti-clipboard-list', to: '/orders'   },
                { label: 'Import CSV', icon: 'ti-upload',         to: '/import'   },
                { label: 'Reset',      icon: 'ti-refresh',        to: '/reset'    },
              ].map(s => (
                <button key={s.to} className="db-shortcut" onClick={() => navigate(s.to)}>
                  <i className={`ti ${s.icon}`} aria-hidden="true" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
  )
}

export default Dashboard