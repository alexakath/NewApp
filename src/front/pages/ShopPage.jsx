import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import useEnrichedProducts from '../../hooks/useEnrichedProducts'
import './ShopPage.css'

const ShopPage = () => {
  const { products, loading, error } = useEnrichedProducts()

  const [searchName, setSearchName] = useState('')
  const [searchCat, setSearchCat]   = useState('')
  const [priceMin, setPriceMin]     = useState('')
  const [priceMax, setPriceMax]     = useState('')

  const activeProducts = products.filter(p => p.active == 1)

  const categories = useMemo(() => {
    const all = activeProducts.map(p => p.categoryDefault).filter(Boolean)
    return [...new Set(all)].sort()
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

  return (
    <FrontLayout>
      <div className="shop-header">
        <h1 className="shop-title">Nos produits</h1>
        {!loading && (
          <span className="shop-count">
            {filtered.length} produit{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
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
    </FrontLayout>
  )
}

export default ShopPage