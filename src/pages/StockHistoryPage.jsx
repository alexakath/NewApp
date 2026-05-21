import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useStockMovements from '../hooks/useStockMovements'
import './StockHistoryPage.css'

const PERIOD_OPTIONS = [
  { value: '1',   label: "Aujourd'hui" },
  { value: '7',   label: '7 derniers jours' },
  { value: '30',  label: '30 derniers jours' },
  { value: 'all', label: 'Tout' },
]

const formatDateTime = (str) => {
  if (!str) return '—'
  const d = new Date(str.replace(' ', 'T'))
  if (isNaN(d.getTime())) return str
  const datePart = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

const StockHistoryPage = () => {
  const { productId, combinationId } = useParams()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('7')

  const { movements, productInfo, loading, error } = useStockMovements(
    productId,
    combinationId || 0
  )

  // Filtrage par période
  const filtered = useMemo(() => {
    if (period === 'all') return movements
    const days = parseInt(period)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    cutoff.setHours(0, 0, 0, 0)
    return movements.filter((m) => {
      const d = new Date((m.dateAdd || '').replace(' ', 'T'))
      return !isNaN(d.getTime()) && d >= cutoff
    })
  }, [movements, period])

  // Résumé
  const summary = useMemo(() => {
    let entries = 0
    let exits = 0
    filtered.forEach((m) => {
      if (m.isEntry) entries += m.quantity
      else exits += m.quantity
    })
    return { count: filtered.length, entries, exits }
  }, [filtered])

  return (
    <div className="list-container stock-history-page">

      <div className="list-header history-header">
        <button className="back-btn" onClick={() => navigate('/stock')}>
          <i className="ti ti-arrow-left"></i>
          Retour
        </button>
        <div className="history-title-wrap">
          <h1>Historique des mouvements</h1>
          {productInfo && (
            <p className="history-subtitle">
              <strong>{productInfo.name}</strong>
              <span className="muted"> · Réf. {productInfo.reference}</span>
              {productInfo.combinationRef && (
                <span className="attribute-badge" style={{ marginLeft: 8 }}>
                  {productInfo.combinationRef}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Toolbar : résumé + filtre période */}
      <div className="history-toolbar">
        <div className="history-summary">
          <span className="count-badge">
            <i className="ti ti-arrows-exchange"></i>
            {summary.count} mouvement{summary.count > 1 ? 's' : ''}
          </span>
          <span className="summary-entry">+{summary.entries} entrées</span>
          <span className="summary-exit">−{summary.exits} sorties</span>
        </div>

        <div className="period-filter">
          <i className="ti ti-calendar"></i>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <p className="loading">Chargement de l'historique…</p>
      ) : error ? (
        <p className="error">Erreur : {error}</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-history"></i>
          <p>Aucun mouvement sur cette période</p>
          <span>Essayez d'élargir la période ou de revenir plus tard</span>
        </div>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th>Date / Heure</th>
              <th>Type</th>
              <th>Quantité</th>
              <th>Raison</th>
              <th>Employé</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td className="date-cell">{formatDateTime(m.dateAdd)}</td>
                <td>
                  {m.isEntry ? (
                    <span className="mvt-badge mvt-in">
                      <i className="ti ti-arrow-up-right"></i>
                      Entrée
                    </span>
                  ) : (
                    <span className="mvt-badge mvt-out">
                      <i className="ti ti-arrow-down-right"></i>
                      Sortie
                    </span>
                  )}
                </td>
                <td>
                  <span className={m.isEntry ? 'qty-positive' : 'qty-negative'}>
                    {m.isEntry ? '+' : '−'}{m.quantity}
                  </span>
                </td>
                <td>
                  <span className="level-badge">{m.reasonName}</span>
                </td>
                <td className="muted">
                  {m.employeeId ? `#${m.employeeId}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default StockHistoryPage