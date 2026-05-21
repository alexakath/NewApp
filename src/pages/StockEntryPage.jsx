import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useEnrichedStock from '../hooks/useEnrichedStock'
import useEnrichedProducts from '../hooks/useEnrichedProducts'
import { addStock } from '../api/services/stockMovementService'
import './StockEntryPage.css'

const StockEntryPage = () => {
  const navigate = useNavigate()
  const { stock, loading: loadingS, error: errorS } = useEnrichedStock()
  const { products, loading: loadingP } = useEnrichedProducts()

  const [search, setSearch] = useState('')
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false)
  const [modal, setModal] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const loading = loadingS || loadingP

  const productImageMap = useMemo(() => {
    const map = {}
    products.forEach(p => { map[String(p.id)] = p.imageUrl })
    return map
  }, [products])

  // Map productId → categoryDefault depuis useEnrichedProducts
  const productCatMap = useMemo(() => {
    const map = {}
    products.forEach(p => { map[String(p.id)] = p.categoryDefault || '—' })
    return map
  }, [products])

  // Tableau par catégorie
  // - availableQty : on prend availableQty depuis la ligne attr=0 (dédupliqué par produit)
  // - reservedQty  : somme de toutes les déclinaisons (déjà correct)
  // - physicalQty  : availableQty + reservedQty
  const categoryStockSummary = useMemo(() => {
    const catMap = {}

    // Étape 1 : réservé — somme toutes les lignes (déclinaisons ou produit simple)
    stock.forEach(s => {
      const cat = productCatMap[s.productId] || '—'
      if (!catMap[cat]) catMap[cat] = { reservedQty: 0, availableQty: 0, seenProducts: new Set() }
      catMap[cat].reservedQty += s.reservedQty
    })

    // Étape 2 : disponible — on ne compte qu'une fois par produit (via availableQty)
    stock.forEach(s => {
      const cat = productCatMap[s.productId] || '—'
      if (!catMap[cat]) catMap[cat] = { reservedQty: 0, availableQty: 0, seenProducts: new Set() }
      if (!catMap[cat].seenProducts.has(s.productId)) {
        catMap[cat].availableQty += s.availableQty
        catMap[cat].seenProducts.add(s.productId)
      }
    })

    return Object.entries(catMap)
      .map(([name, vals]) => ({
        name,
        availableQty: vals.availableQty,
        reservedQty:  vals.reservedQty,
        physicalQty:  vals.availableQty + vals.reservedQty,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [stock, productCatMap])

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stock.filter(s => {
      if (onlyOutOfStock && !s.outOfStock) return false
      if (!q) return true
      return (
        s.productName.toLowerCase().includes(q) ||
        s.productReference.toLowerCase().includes(q) ||
        (s.combinationRef || '').toLowerCase().includes(q)
      )
    })
  }, [stock, search, onlyOutOfStock])

  const [overrides, setOverrides] = useState({})

  const getDisplayedQty = (s) =>
    overrides[s.id] !== undefined ? overrides[s.id] : s.quantity

  const getStockClass = (qty) => {
    if (qty <= 0) return 'stock-out'
    if (qty <= 5) return 'stock-low'
    return 'stock-ok'
  }

  const openModal  = (line) => { setModal(line); setQuantity(''); setFeedback(null) }
  const closeModal = () => { if (submitting) return; setModal(null); setQuantity('') }

  const goToHistory = (line) => {
    const combId = line.combinationId || 0
    navigate(`/stock/history/${line.productId}/${combId}`)
  }

  const handleSubmit = async () => {
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      setFeedback({ type: 'error', msg: 'Saisir une quantité valide (supérieure à 0).' })
      return
    }
    setSubmitting(true)
    setFeedback(null)
    try {
      const result = await addStock(modal.productId, modal.combinationId || 0, qty)
      setOverrides(prev => ({ ...prev, [modal.id]: result.newQuantity }))
      setFeedback({
        type: 'success',
        msg: `+${qty} ajouté · stock passé de ${result.previousQuantity} à ${result.newQuantity}`,
        line: modal.id,
      })
      setTimeout(() => { setModal(null); setQuantity(''); setFeedback(null) }, 1400)
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err?.response?.data?.error || err?.response?.data || err.message || 'Erreur inconnue.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="list-container"><p className="loading">Chargement du stock…</p></div>
  if (errorS)  return <div className="list-container"><p className="error">Erreur : {errorS}</p></div>

  return (
    <div className="list-container stock-entry-page">

      <div className="list-header">
        <h1>Ajout de stock</h1>
        <span className="badge">{filteredStock.length}</span>
      </div>

      <div className="stock-toolbar">
        <div className="stock-search">
          <i className="ti ti-search"></i>
          <input
            type="text"
            placeholder="Rechercher par nom, référence ou déclinaison…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="stock-clear" onClick={() => setSearch('')}>
              <i className="ti ti-x"></i>
            </button>
          )}
        </div>
        <label className="stock-toggle">
          <input
            type="checkbox"
            checked={onlyOutOfStock}
            onChange={e => setOnlyOutOfStock(e.target.checked)}
          />
          <span>Ruptures uniquement</span>
        </label>
      </div>

      {filteredStock.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-package-off"></i>
          <p>Aucun résultat</p>
          <span>Essayez d'ajuster votre recherche</span>
        </div>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th></th>
              <th>Produit</th>
              <th>Référence</th>
              <th>Déclinaison</th>
              <th>Stock actuel</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.map(s => {
              const qty = getDisplayedQty(s)
              const img = productImageMap[s.productId]
              return (
                <tr key={s.id}>
                  <td style={{ width: 56 }}>
                    {img ? (
                      <img src={img} alt="" className="product-thumb" />
                    ) : (
                      <div className="product-thumb-placeholder">
                        <i className="ti ti-photo"></i>
                      </div>
                    )}
                  </td>
                  <td><span className="name-cell">{s.productName}</span></td>
                  <td className="muted">{s.productReference}</td>
                  <td>
                    {s.combinationRef
                      ? <span className="attribute-badge">{s.combinationRef}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    <span className={`stock-qty ${getStockClass(qty)}`}>{qty}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="stock-actions">
                      <button className="btn-history" onClick={() => goToHistory(s)} title="Voir l'historique">
                        <i className="ti ti-history"></i>Historique
                      </button>
                      <button className="btn-add-stock" onClick={() => openModal(s)}>
                        <i className="ti ti-plus"></i>Ajouter
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* ── Tableau par catégorie ── */}
      <div className="stock-category-section">
        <div className="stock-category-header">
          <i className="ti ti-category"></i>
          <span>Vue par catégorie</span>
        </div>
        <table className="list-table stock-category-table">
          <thead>
            <tr>
              <th>Catégorie</th>
              <th style={{ textAlign: 'right' }}>Qté physique</th>
              <th style={{ textAlign: 'right' }}>Qté réservée</th>
              <th style={{ textAlign: 'right' }}>Qté disponible</th>
            </tr>
          </thead>
          <tbody>
            {categoryStockSummary.map(cat => (
              <tr key={cat.name}>
                <td><strong>{cat.name}</strong></td>
                <td style={{ textAlign: 'right' }}>
                  <span className="stock-qty stock-ok">{cat.physicalQty}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {cat.reservedQty > 0
                    ? <span className="stock-qty stock-low">{cat.reservedQty}</span>
                    : <span className="muted">—</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`stock-qty ${cat.availableQty <= 0 ? 'stock-out' : cat.availableQty <= 5 ? 'stock-low' : 'stock-ok'}`}>
                    {cat.availableQty}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="stock-category-total">
              <td><strong>Total</strong></td>
              <td style={{ textAlign: 'right' }}>
                <strong>{categoryStockSummary.reduce((s, c) => s + c.physicalQty, 0)}</strong>
              </td>
              <td style={{ textAlign: 'right' }}>
                <strong>{categoryStockSummary.reduce((s, c) => s + c.reservedQty, 0)}</strong>
              </td>
              <td style={{ textAlign: 'right' }}>
                <strong>{categoryStockSummary.reduce((s, c) => s + c.availableQty, 0)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modale */}
      {modal && (
        <div className="stock-modal-overlay" onClick={closeModal}>
          <div className="stock-modal" onClick={e => e.stopPropagation()}>
            <div className="stock-modal-header">
              <h3>Ajouter au stock</h3>
              <button className="stock-modal-close" onClick={closeModal} disabled={submitting}>
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="stock-modal-body">
              <div className="stock-modal-product">
                <p className="stock-modal-name">{modal.productName}</p>
                <p className="stock-modal-ref">
                  Réf. {modal.productReference}
                  {modal.combinationRef && ` · ${modal.combinationRef}`}
                </p>
              </div>
              <div className="stock-modal-current">
                <span>Stock actuel</span>
                <span className={`stock-qty ${getStockClass(getDisplayedQty(modal))}`}>
                  {getDisplayedQty(modal)}
                </span>
              </div>
              <div className="stock-modal-field">
                <label>Quantité à ajouter</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0"
                  disabled={submitting}
                  autoFocus
                />
              </div>
              {quantity && parseInt(quantity) > 0 && (
                <div className="stock-modal-preview">
                  <span>Nouveau stock</span>
                  <strong>{getDisplayedQty(modal) + parseInt(quantity)}</strong>
                </div>
              )}
              {feedback && (
                <div className={`stock-modal-feedback ${feedback.type}`}>
                  <i className={`ti ${feedback.type === 'success' ? 'ti-check' : 'ti-alert-circle'}`}></i>
                  {feedback.msg}
                </div>
              )}
            </div>
            <div className="stock-modal-footer">
              <button className="btn-cancel" onClick={closeModal} disabled={submitting}>Annuler</button>
              <button
                className="btn-confirm"
                onClick={handleSubmit}
                disabled={submitting || !quantity || parseInt(quantity) <= 0}
              >
                {submitting
                  ? <><i className="ti ti-loader spin"></i>Enregistrement…</>
                  : <><i className="ti ti-check"></i>Valider</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockEntryPage