import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import useEnrichedProducts from '../../hooks/useEnrichedProducts'
import { removeStockByCategory } from '../../api/services/stockMovementService'
import './ShopPage.css'

const ADMIN_PWD = import.meta.env.VITE_ADMIN_PASSWORD

const ShopPage = () => {
  const { products, loading, error } = useEnrichedProducts()

  const [searchName, setSearchName] = useState('')
  const [searchCat, setSearchCat]   = useState('')
  const [priceMin, setPriceMin]     = useState('')
  const [priceMax, setPriceMax]     = useState('')

  // Remove stock flow: null | 'pwd' | 'form' | 'result'
  const [step, setStep]             = useState(null)
  const [pwd, setPwd]               = useState('')
  const [pwdError, setPwdError]     = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [qtyInput, setQtyInput]     = useState('')
  const [removing, setRemoving]     = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [result, setResult]         = useState(null)

  const activeProducts = products.filter(p => p.active == 1)

  const categories = useMemo(() => {
    const all = activeProducts.map(p => p.categoryDefault).filter(Boolean)
    return [...new Set(all)].sort()
  }, [activeProducts])

  // category name → { name, productIds[] }
  const categoryMap = useMemo(() => {
    const map = {}
    activeProducts.forEach(p => {
      const name = p.categoryDefault
      if (!name) return
      if (!map[name]) map[name] = { name, productIds: [] }
      map[name].productIds.push(String(p.id))
    })
    return map
  }, [activeProducts])

  // productId → productName (pour l'affichage dans le résultat)
  const productNameMap = useMemo(() => {
    const map = {}
    activeProducts.forEach(p => { map[String(p.id)] = p.name })
    return map
  }, [activeProducts])

  const filtered = useMemo(() => {
    return activeProducts.filter(p => {
      const matchName = searchName.trim() === '' ||
        p.name.toLowerCase().includes(searchName.toLowerCase())
      const matchCat = searchCat === '' || p.categoryDefault === searchCat
      const price = parseFloat(p.priceTTC || 0)
      const matchMin = priceMin === '' || price >= parseFloat(priceMin)
      const matchMax = priceMax === '' || price <= parseFloat(priceMax)
      return matchName && matchCat && matchMin && matchMax
    })
  }, [activeProducts, searchName, searchCat, priceMin, priceMax])

  const hasFilters = searchName || searchCat || priceMin || priceMax

  const resetFilters = () => {
    setSearchName('')
    setSearchCat('')
    setPriceMin('')
    setPriceMax('')
  }

  // ── Remove stock handlers ──

  const openPwdModal = () => {
    setPwd('')
    setPwdError('')
    setStep('pwd')
  }

  const closeAll = () => {
    setStep(null)
    setPwd('')
    setPwdError('')
    setSelectedCat('')
    setQtyInput('')
    setRemoveError('')
    setResult(null)
  }

  const handlePwdSubmit = () => {
    if (pwd !== ADMIN_PWD) {
      setPwdError('Mot de passe incorrect.')
      return
    }
    const firstCat = Object.keys(categoryMap)[0] || ''
    setSelectedCat(firstCat)
    setQtyInput('')
    setRemoveError('')
    setStep('form')
  }

  const handleRemoveSubmit = async () => {
    const qty = parseInt(qtyInput)
    if (!qty || qty <= 0) {
      setRemoveError('Saisir une quantité valide (> 0).')
      return
    }
    const catData = categoryMap[selectedCat]
    if (!catData) {
      setRemoveError('Catégorie invalide.')
      return
    }
    setRemoving(true)
    setRemoveError('')
    try {
      const { totalReduced, initialTotal, totalShouldRemove, remainingTotal, details } =
        await removeStockByCategory(catData.productIds, qty, productNameMap)
      setResult({ categoryName: catData.name, qtyAsked: qty, totalReduced, initialTotal, totalShouldRemove, remainingTotal, details })
      setStep('result')
    } catch (err) {
      setRemoveError(err.message || 'Erreur lors de la suppression de stock.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <FrontLayout>
      <div className="shop-header">
        <h1 className="shop-title">Nos produits</h1>
        {!loading && (
          <span className="shop-count">
            {filtered.length} produit{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
        <button className="btn-remove-stock" onClick={openPwdModal}>
          <i className="ti ti-trash"></i>Remove stock
        </button>
      </div>

      {!loading && !error && (
        <div className="shop-filters">
          <div className="filter-field filter-field-grow">
            <label className="filter-label">Nom</label>
            <div className="filter-input-wrap">
              <i className="ti ti-search filter-icon"></i>
              <input
                type="text"
                className="filter-input"
                placeholder="Rechercher un produit..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
              />
              {searchName && (
                <button className="filter-clear" onClick={() => setSearchName('')}>
                  <i className="ti ti-x"></i>
                </button>
              )}
            </div>
          </div>

          <div className="filter-field">
            <label className="filter-label">Catégorie</label>
            <div className="filter-input-wrap">
              <i className="ti ti-tag filter-icon"></i>
              <select
                className="filter-input filter-select"
                value={searchCat}
                onChange={e => setSearchCat(e.target.value)}
              >
                <option value="">Toutes</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-field filter-field-price">
            <label className="filter-label">Prix min (€)</label>
            <div className="filter-input-wrap">
              <input
                type="number"
                className="filter-input"
                placeholder="0"
                min="0"
                value={priceMin}
                onChange={e => setPriceMin(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-field filter-field-price">
            <label className="filter-label">Prix max (€)</label>
            <div className="filter-input-wrap">
              <input
                type="number"
                className="filter-input"
                placeholder="∞"
                min="0"
                value={priceMax}
                onChange={e => setPriceMax(e.target.value)}
              />
            </div>
          </div>

          {hasFilters && (
            <div className="filter-field filter-field-reset">
              <label className="filter-label">&nbsp;</label>
              <button className="filter-reset-btn" onClick={resetFilters}>
                <i className="ti ti-refresh"></i>
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p className="shop-status">Chargement...</p>}
      {error   && <p className="shop-status shop-error">Erreur : {error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="shop-no-result">
          <i className="ti ti-mood-empty"></i>
          <p>Aucun produit ne correspond à votre recherche</p>
          {hasFilters && (
            <button className="filter-reset-btn" onClick={resetFilters}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      <div className="shop-grid">
        {filtered.map(product => (
          <Link
            to={`/shop/product/${product.id}`}
            key={product.id}
            className="shop-card"
          >
            <div className="shop-card-img">
              {product.badge && (
                <span className={`shop-badge shop-badge-${product.badge.toLowerCase()}`}>
                  {product.badge}
                </span>
              )}
              {product.imageUrl
                ? <img src={product.imageUrl} alt={product.name} />
                : <div className="shop-card-no-img"><i className="ti ti-photo"></i></div>
              }
            </div>
            <div className="shop-card-body">
              {product.categoryDefault && (
                <span className="shop-card-cat">{product.categoryDefault}</span>
              )}
              <h3 className="shop-card-name">{product.name}</h3>
              <p className="shop-card-price">{product.priceTTC} €</p>
              <p className={`shop-card-stock ${product.quantity <= 0 ? 'out' : ''}`}>
                {product.quantity > 0 ? `En stock (${product.quantity})` : 'Rupture de stock'}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Modal 1 : Mot de passe ── */}
      {step === 'pwd' && (
        <div className="rs-overlay" onClick={closeAll}>
          <div className="rs-modal" onClick={e => e.stopPropagation()}>
            <div className="rs-modal-header">
              <h3><i className="ti ti-lock"></i>Mot de passe administrateur</h3>
              <button className="rs-close" onClick={closeAll}><i className="ti ti-x"></i></button>
            </div>
            <div className="rs-modal-body">
              <input
                type="password"
                className="rs-input"
                placeholder="Mot de passe"
                value={pwd}
                onChange={e => { setPwd(e.target.value); setPwdError('') }}
                onKeyDown={e => e.key === 'Enter' && handlePwdSubmit()}
                autoFocus
              />
              {pwdError && (
                <p className="rs-error">
                  <i className="ti ti-alert-circle"></i>{pwdError}
                </p>
              )}
            </div>
            <div className="rs-modal-footer">
              <button className="rs-btn-cancel" onClick={closeAll}>Annuler</button>
              <button className="rs-btn-confirm" onClick={handlePwdSubmit} disabled={!pwd}>
                <i className="ti ti-arrow-right"></i>Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2 : Formulaire suppression ── */}
      {step === 'form' && (
        <div className="rs-overlay" onClick={!removing ? closeAll : undefined}>
          <div className="rs-modal" onClick={e => e.stopPropagation()}>
            <div className="rs-modal-header">
              <h3><i className="ti ti-minus"></i>Supprimer du stock</h3>
              <button className="rs-close" onClick={closeAll} disabled={removing}>
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="rs-modal-body">
              <div className="rs-field">
                <label>Catégorie</label>
                <select
                  className="rs-input rs-select"
                  value={selectedCat}
                  onChange={e => setSelectedCat(e.target.value)}
                  disabled={removing}
                >
                  {Object.values(categoryMap).map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="rs-field">
                <label>Quantité à supprimer</label>
                <input
                  type="number"
                  min="1"
                  className="rs-input"
                  placeholder="0"
                  value={qtyInput}
                  onChange={e => { setQtyInput(e.target.value); setRemoveError('') }}
                  disabled={removing}
                />
              </div>
              {removeError && (
                <p className="rs-error">
                  <i className="ti ti-alert-circle"></i>{removeError}
                </p>
              )}
            </div>
            <div className="rs-modal-footer">
              <button className="rs-btn-cancel" onClick={closeAll} disabled={removing}>
                Annuler
              </button>
              <button
                className="rs-btn-danger"
                onClick={handleRemoveSubmit}
                disabled={removing || !qtyInput || parseInt(qtyInput) <= 0}
              >
                {removing
                  ? <><i className="ti ti-loader rs-spin"></i>Traitement…</>
                  : <><i className="ti ti-check"></i>Valider</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3 : Résultat ── */}
      {step === 'result' && result && (
        <div className="rs-overlay" onClick={closeAll}>
          <div className="rs-modal rs-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="rs-modal-header">
              <h3><i className="ti ti-circle-check"></i>Stock mis à jour — {result.categoryName}</h3>
              <button className="rs-close" onClick={closeAll}><i className="ti ti-x"></i></button>
            </div>
            <div className="rs-modal-body">

              {/* Résumé */}
              <div className="rs-summary-grid">
                <div className="rs-summary-item">
                  <span className="rs-summary-label">Qté initiale</span>
                  <span className="rs-summary-value">{result.initialTotal}</span>
                </div>
                <div className="rs-summary-item">
                  <span className="rs-summary-label">Qté insérée</span>
                  <span className="rs-summary-value">{result.qtyAsked}</span>
                </div>
                <div className="rs-summary-item">
                  <span className="rs-summary-label">Devait être enlevée</span>
                  <span className="rs-summary-value">{result.totalShouldRemove}</span>
                </div>
                <div className="rs-summary-item rs-summary-item--removed">
                  <span className="rs-summary-label">Réellement enlevée</span>
                  <span className="rs-summary-value">{result.totalReduced}</span>
                </div>
                <div className="rs-summary-item rs-summary-item--remaining">
                  <span className="rs-summary-label">Stock restant</span>
                  <span className="rs-summary-value">{result.remainingTotal}</span>
                </div>
              </div>

              {/* Détail par produit / déclinaison */}
              <div className="rs-result-scroll">
                <table className="rs-result-table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Déclinaison</th>
                      <th>Qté demandée</th>
                      <th>Qté retirée</th>
                      <th>Stock restant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.map((d, i) => (
                      <tr key={i}>
                        <td>{d.productName}</td>
                        <td>{d.combinationRef ?? <span className="rs-muted">—</span>}</td>
                        <td>{d.qtyRequested}</td>
                        <td>
                          <span className={d.qtyRemoved < d.qtyRequested ? 'rs-qty-partial' : 'rs-qty-full'}>
                            {d.qtyRemoved}
                          </span>
                        </td>
                        <td>
                          <span className={d.remainingQty <= 0 ? 'rs-qty-zero' : ''}>
                            {d.remainingQty}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
            <div className="rs-modal-footer">
              <button className="rs-btn-confirm" onClick={closeAll}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </FrontLayout>
  )
}

export default ShopPage
