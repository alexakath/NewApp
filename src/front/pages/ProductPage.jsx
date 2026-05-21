import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import FrontLayout from '../FrontLayout'
import useProductDetail from '../hooks/useProductDetail'
import { frontIsAuthenticated, getCartKey } from '../services/frontAuthService'
import './ProductPage.css'

const ProductPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { product, loading, error } = useProductDetail(id)

  const [selectedCombo, setSelectedCombo] = useState(null)
  const [qty, setQty]   = useState(1)
  const [added, setAdded] = useState(false)

  if (loading) return <FrontLayout><p className="product-status">Chargement...</p></FrontLayout>
  if (error)   return <FrontLayout><p className="product-status product-error">Erreur : {error}</p></FrontLayout>
  if (!product) return null

  const activeCombo  = product.hasCombinations
    ? product.combinations.find(c => c.id === selectedCombo)
    : null

  const displayPrice = activeCombo ? activeCombo.priceTTC : product.priceTTC
  const displayStock = activeCombo ? activeCombo.quantity : product.quantity
  const inStock      = displayStock > 0

  const handleAddToCart = () => {
    if (!frontIsAuthenticated()) {
      navigate('/shop')
      return
    }

    const cartKey = getCartKey()
    if (!cartKey) return

    const cart    = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const itemId  = activeCombo ? `${product.id}_${activeCombo.id}` : `${product.id}`
    const existing = cart.find(i => i.itemId === itemId)

    if (existing) {
      existing.qty += qty
    } else {
      cart.push({
        itemId,
        productId:      product.id,
        combinationId:  activeCombo?.id || null,
        name:           product.name,
        attributeLabel: activeCombo?.attributeLabel || null,
        price:          displayPrice,
        imageUrl:       product.imageUrl,
        qty,
      })
    }

    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new Event('storage'))
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const canAdd = inStock && (!product.hasCombinations || selectedCombo)

  return (
    <FrontLayout>
      <button className="product-back" onClick={() => navigate('/shop/products')}>
        <i className="ti ti-arrow-left"></i> Retour
      </button>

      <div className="product-detail">
        <div className="product-detail-img">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} />
            : <div className="product-no-img"><i className="ti ti-photo"></i></div>
          }
          {product.isPack && <span className="product-pack-badge">Pack</span>}
        </div>

        <div className="product-detail-info">
          <h1 className="product-detail-name">{product.name}</h1>
          <p className="product-detail-ref">Réf : {product.reference}</p>
          <p className="product-detail-price">{displayPrice} €</p>

          <p className={`product-detail-stock ${!inStock ? 'out' : ''}`}>
            {inStock ? `En stock (${displayStock})` : 'Rupture de stock'}
          </p>

          {product.hasCombinations && (
            <div className="product-combinations">
              <p className="product-combinations-label">Choisir une option :</p>
              <div className="product-combinations-list">
                {product.combinations.map(combo => (
                  <button
                    key={combo.id}
                    className={`combo-btn ${selectedCombo === combo.id ? 'active' : ''} ${combo.quantity <= 0 ? 'disabled' : ''}`}
                    onClick={() => setSelectedCombo(combo.id)}
                    disabled={combo.quantity <= 0}
                  >
                    {combo.attributeLabel}
                    {combo.quantity <= 0 && ' (épuisé)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="product-qty">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty(q => Math.min(displayStock, q + 1))}>+</button>
          </div>

          <button
            className={`product-add-btn ${!canAdd ? 'disabled' : ''} ${added ? 'added' : ''}`}
            onClick={handleAddToCart}
            disabled={!canAdd}
          >
            {added ? '✓ Ajouté au panier' : 'Ajouter au panier'}
          </button>

          {!frontIsAuthenticated() && canAdd && (
            <p className="product-login-hint">
              <i className="ti ti-info-circle"></i>
              Vous devrez vous connecter pour ajouter au panier
            </p>
          )}

          {product.description && (
            <div className="product-description"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          )}
        </div>
      </div>

      {product.isPack && product.packItems.length > 0 && (
        <div className="product-pack">
          <h2 className="product-pack-title">
            <i className="ti ti-packages"></i>
            Ce pack contient
          </h2>
          <div className="product-pack-grid">
            {product.packItems.map(item => (
              <div key={item.id} className="product-pack-item">
                <div className="product-pack-item-img">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.name} />
                    : <i className="ti ti-photo"></i>
                  }
                </div>
                <div className="product-pack-item-info">
                  <p className="product-pack-item-name">{item.name}</p>
                  <span className="product-pack-item-qty">× {item.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </FrontLayout>
  )
}

export default ProductPage