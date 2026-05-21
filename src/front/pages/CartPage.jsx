import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import { frontIsAuthenticated, getCartKey, frontGetCurrentUser, frontIsAnonymous } from '../services/frontAuthService'
import {
  getCustomerAddresses,
  getClickAndCollectCarrier,
  getDefaultCurrency,
  createAddress,
  createOrder,
  getStoredPsCart,
  clearPsCart,
  createEmptyPsCart,
  syncPsCartRows,
  deletePsCart,
  loadCartFromPs,
  loadDansPanierOrderFromPs,
  confirmDansPanierOrder,
  reIncrementStockForItems,
} from '../services/orderService'
import './CartPage.css'

const CartPage = () => {
  const [cart, setCart]               = useState(() => {
    const cartKey = getCartKey()
    if (!cartKey) return []
    return JSON.parse(localStorage.getItem(cartKey) || '[]')
  })
  const [showModal, setShowModal]     = useState(false)
  const [addresses, setAddresses]     = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [addressForm, setAddressForm] = useState({ alias: '', address1: '', city: '', phone: '' })
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [loadingModal, setLoadingModal] = useState(false)
  const [psCartInfo, setPsCartInfo]   = useState(null)
  const psInitDone = useRef(false)
  const navigate = useNavigate()
  const user = frontGetCurrentUser()
  const isAnon = frontIsAnonymous()

  // Si panier local vide : charger depuis PS (ex: panier créé via import CSV)
  // Ne pas faire cette sync pour l'anonyme : son panier est purement localStorage
  useEffect(() => {
    if (psInitDone.current || !user?.id || cart.length > 0 || isAnon) return

    psInitDone.current = true
    const syncFromPs = async () => {
      try {
        // Essai 1 : panier PS actif (non converti en commande)
        let result = await loadCartFromPs(user.id)
        if (result && result.items.length > 0) {
          const cartKey = getCartKey()
          if (cartKey) {
            localStorage.setItem(cartKey, JSON.stringify(result.items))
            window.dispatchEvent(new Event('storage'))
            setCart(result.items)
          }
          localStorage.setItem(`ps_cart_${user.id}`, JSON.stringify({
            cartId: result.cartId,
            cartSecureKey: result.cartSecureKey,
          }))
          setPsCartInfo({
            type: 'cart',
            cartId: result.cartId,
            cartSecureKey: result.cartSecureKey,
            carrierId: result.carrierId,
            currencyId: result.currencyId,
          })
          return
        }

        // Essai 2 : commande importée en état "Dans le panier"
        const orderResult = await loadDansPanierOrderFromPs(user.id)
        if (!orderResult || orderResult.items.length === 0) {
          psInitDone.current = false
          return
        }
        setCart(orderResult.items)
        localStorage.setItem(`ps_cart_${user.id}`, JSON.stringify({
          type: 'order',
          orderId: orderResult.orderId,
        }))
        setPsCartInfo({
          type: 'order',
          orderId:    orderResult.orderId,
          reference:  orderResult.reference,
          carrierId:  orderResult.carrierId,
          currencyId: orderResult.currencyId,
        })
      } catch (err) {
        console.error('Erreur sync panier depuis PS:', err)
        psInitDone.current = false
      }
    }
    syncFromPs()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise le cart PS au montage si le panier est non-vide
  // Ne pas créer de cart PS pour l'anonyme
  useEffect(() => {
    if (psInitDone.current || !user?.id || cart.length === 0 || isAnon) return

    psInitDone.current = true

    const init = async () => {
      try {
        const stored = getStoredPsCart(user.id)
        if (stored?.type === 'order') {
          setPsCartInfo({
            type: 'order',
            orderId: stored.orderId,
          })
          return
        }

        const [carrierId, currencyId] = await Promise.all([
          getClickAndCollectCarrier(),
          getDefaultCurrency(),
        ])

        let cartId, cartSecureKey

        if (!stored) {
          const created = await createEmptyPsCart(user.id, currencyId, carrierId)
          cartId = created.cartId
          cartSecureKey = created.cartSecureKey
        } else {
          cartId = stored.cartId
          cartSecureKey = stored.cartSecureKey
        }

        await syncPsCartRows({ cartId, cartSecureKey, customerId: user.id, currencyId, carrierId, items: cart })
        setPsCartInfo({ cartId, cartSecureKey, carrierId, currencyId })
      } catch (err) {
        console.error('Erreur initialisation panier PS:', err)
        psInitDone.current = false
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (updated) => {
    const cartKey = getCartKey()
    if (!cartKey) return
    localStorage.setItem(cartKey, JSON.stringify(updated))
    window.dispatchEvent(new Event('storage'))
  }

  const handlePsCartSync = (updatedItems) => {
    if (!psCartInfo || !user?.id || psCartInfo.type === 'order' || isAnon) return
    if (updatedItems.length === 0) {
      deletePsCart(user.id, psCartInfo.cartId).catch(e => console.error('PS cart delete error:', e))
      setPsCartInfo(null)
    } else {
      syncPsCartRows({ ...psCartInfo, customerId: user.id, items: updatedItems })
        .catch(e => console.error('PS cart sync error:', e))
    }
  }

  const updateQty = (itemId, delta) => {
    const updated = cart.map(item => {
      if (item.itemId !== itemId) return item
      const newQty = item.qty + delta
      if (newQty <= 0) return null
      return { ...item, qty: newQty }
    }).filter(Boolean)
    setCart(updated)
    persist(updated)
    handlePsCartSync(updated)
  }

  const removeItem = (itemId) => {
    const updated = cart.filter(i => i.itemId !== itemId)
    setCart(updated)
    persist(updated)
    handlePsCartSync(updated)
  }

  const total    = cart.reduce((sum, item) => sum + parseFloat(item.price) * item.qty, 0)
  const totalHT  = (total / 1.20).toFixed(2)
  const totalTTC = total.toFixed(2)

  // Anonyme clique Commander → redirect vers la liste des utilisateurs
  const handleOpenModal = async () => {
    if (isAnon) {
      navigate('/shop')
      return
    }

    // Commande importée "Dans le panier" : confirmer directement sans modal
    if (psCartInfo?.type === 'order') {
      setSubmitting(true)
      setSubmitError(null)
      try {
        const { orderId, reference } = await confirmDansPanierOrder(psCartInfo.orderId)
        await reIncrementStockForItems(cart)
        clearPsCart(user.id)
        persist([])
        setCart([])
        navigate(`/shop/order-confirm/${orderId}`, { state: { reference, totalTTC } })
      } catch (err) {
        setSubmitError('Erreur lors de la confirmation : ' + err.message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    setLoadingModal(true)
    setSubmitError(null)
    setShowAddressForm(false)
    try {
      const addrs = await getCustomerAddresses(user.id)
      setAddresses(addrs)
      setSelectedAddress(addrs.length > 0 ? addrs[0] : null)
      if (addrs.length === 0) setShowAddressForm(true)
    } catch {
      setSubmitError('Impossible de charger les adresses')
    } finally {
      setLoadingModal(false)
      setShowModal(true)
    }
  }

  const getVal = (field) => {
    if (!field) return ''
    if (typeof field === 'object' && field['#text'] !== undefined) return field['#text']
    return field
  }

  const handleCreateAddress = async () => {
    if (!addressForm.address1 || !addressForm.city) {
      setSubmitError('Adresse et ville sont obligatoires')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const newId = await createAddress(user.id, {
        ...addressForm,
        firstname: user.firstname,
        lastname:  user.lastname,
      })
      const addrs = await getCustomerAddresses(user.id)
      setAddresses(addrs)
      const newAddr = addrs.find(a => String(getVal(a.id)) === String(newId)) || addrs[addrs.length - 1]
      setSelectedAddress(newAddr)
      setShowAddressForm(false)
    } catch (e) {
      setSubmitError("Erreur lors de la création de l'adresse : " + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmOrder = async () => {
    if (!selectedAddress) {
      setSubmitError('Veuillez sélectionner ou créer une adresse')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const addressId = String(getVal(selectedAddress.id))

      let carrierId, currencyId
      if (psCartInfo) {
        carrierId  = psCartInfo.carrierId
        currencyId = psCartInfo.currencyId
      } else {
        ;[carrierId, currencyId] = await Promise.all([
          getClickAndCollectCarrier(),
          getDefaultCurrency(),
        ])
      }

      const { orderId, reference } = await createOrder({
        customerId: user.id,
        addressId,
        carrierId,
        currencyId,
        cart,
        totalHT,
        totalTTC,
        existingCartId:         psCartInfo?.cartId,
        existingCartSecureKey:  psCartInfo?.cartSecureKey,
      })

      // PS décrémente le stock via validateOrder() — on annule ici.
      // Le stock ne baisse qu'à la livraison (bouton "Livrer" dans le BO).
      await reIncrementStockForItems(cart)
      clearPsCart(user.id)
      persist([])
      setCart([])
      setShowModal(false)
      navigate(`/shop/order-confirm/${orderId}`, { state: { reference, totalTTC } })
    } catch (e) {
      setSubmitError('Erreur lors de la commande : ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!frontIsAuthenticated()) {
    return (
      <FrontLayout>
        <div className="cart-empty">
          <p>Connectez-vous pour accéder à votre panier.</p>
          <button onClick={() => navigate('/shop')}>Choisir un compte</button>
        </div>
      </FrontLayout>
    )
  }

  return (
    <FrontLayout>
      <h1 className="cart-title">Mon panier</h1>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <p>Votre panier est vide.</p>
          <button onClick={() => navigate('/shop/products')}>Continuer mes achats</button>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.itemId} className="cart-item">
                <div className="cart-item-img">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.name} />
                    : <div className="cart-item-no-img">—</div>}
                </div>
                <div className="cart-item-info">
                  <p className="cart-item-name">{item.name}</p>
                  {item.attributeLabel && <p className="cart-item-attr">{item.attributeLabel}</p>}
                  <p className="cart-item-price">{item.price} € / unité</p>
                </div>
                <div className="cart-item-qty">
                  <button onClick={() => updateQty(item.itemId, -1)}>−</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.itemId, +1)}>+</button>
                </div>
                <p className="cart-item-subtotal">
                  {(parseFloat(item.price) * item.qty).toFixed(2)} €
                </p>
                <button className="cart-item-remove" onClick={() => removeItem(item.itemId)}>
                  <i className="ti ti-x"></i>
                </button>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <p className="cart-total">Total : <span>{totalTTC} €</span></p>

            {isAnon ? (
              <div className="cart-anon-block">
                <p className="cart-anon-msg">
                  <i className="ti ti-info-circle"></i>
                  Vous êtes connecté en mode anonyme. Choisissez un compte pour valider votre commande.
                </p>
                <button className="cart-checkout-btn" onClick={handleOpenModal}>
                  Choisir un compte et commander
                </button>
              </div>
            ) : (
              <button className="cart-checkout-btn" onClick={handleOpenModal}>
                Commander
              </button>
            )}

            <button className="cart-continue" onClick={() => navigate('/shop/products')}>
              Continuer mes achats
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <h2 className="modal-title">Récapitulatif de commande</h2>
              <button className="modal-close" onClick={() => !submitting && setShowModal(false)}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            {loadingModal ? (
              <p className="modal-loading">Chargement...</p>
            ) : (
              <>
                <div className="modal-section">
                  <p className="modal-section-label">
                    <i className="ti ti-user"></i> Client
                  </p>
                  <p className="modal-info-name">{user.firstname} {user.lastname}</p>
                  <p className="modal-info-email">{user.email}</p>
                </div>

                <div className="modal-section">
                  <div className="modal-section-header">
                    <p className="modal-section-label">
                      <i className="ti ti-map-pin"></i> Adresse de livraison
                    </p>
                    {addresses.length > 0 && !showAddressForm && (
                      <button className="modal-link" onClick={() => setShowAddressForm(true)}>
                        + Nouvelle adresse
                      </button>
                    )}
                  </div>

                  {showAddressForm ? (
                    <div className="modal-address-form">
                      <input
                        className="modal-input"
                        placeholder="Alias (ex: Maison)"
                        value={addressForm.alias}
                        onChange={e => setAddressForm(f => ({ ...f, alias: e.target.value }))}
                      />
                      <input
                        className="modal-input"
                        placeholder="Adresse *"
                        value={addressForm.address1}
                        onChange={e => setAddressForm(f => ({ ...f, address1: e.target.value }))}
                      />
                      <input
                        className="modal-input"
                        placeholder="Ville *"
                        value={addressForm.city}
                        onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))}
                      />
                      <input
                        className="modal-input"
                        placeholder="Téléphone"
                        value={addressForm.phone}
                        onChange={e => setAddressForm(f => ({ ...f, phone: e.target.value }))}
                      />
                      <div className="modal-address-form-actions">
                        <button
                          className="modal-btn-secondary"
                          onClick={() => setShowAddressForm(false)}
                          disabled={submitting}
                        >
                          Annuler
                        </button>
                        <button
                          className="modal-btn-primary"
                          onClick={handleCreateAddress}
                          disabled={submitting}
                        >
                          {submitting ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                      </div>
                    </div>
                  ) : addresses.length === 0 ? (
                    <p className="modal-no-address">Aucune adresse — veuillez en créer une</p>
                  ) : (
                    <div className="modal-address-list">
                      {addresses.map(addr => (
                        <label
                          key={getVal(addr.id)}
                          className={`modal-address-option ${selectedAddress && getVal(selectedAddress.id) === getVal(addr.id) ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="address"
                            checked={selectedAddress && getVal(selectedAddress.id) === getVal(addr.id)}
                            onChange={() => setSelectedAddress(addr)}
                          />
                          <span>
                            <strong>{getVal(addr.alias)}</strong> — {getVal(addr.address1)}, {getVal(addr.city)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-section">
                  <p className="modal-section-label">
                    <i className="ti ti-shopping-cart"></i> Articles
                  </p>
                  <div className="modal-items">
                    {cart.map(item => (
                      <div key={item.itemId} className="modal-item">
                        <span className="modal-item-name">
                          {item.name}
                          {item.attributeLabel && <em> — {item.attributeLabel}</em>}
                        </span>
                        <span className="modal-item-qty">× {item.qty}</span>
                        <span className="modal-item-price">
                          {(parseFloat(item.price) * item.qty).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="modal-section">
                  <p className="modal-section-label">
                    <i className="ti ti-truck"></i> Livraison & Paiement
                  </p>
                  <div className="modal-payment-option selected">
                    <i className="ti ti-circle-check"></i>
                    Paiement à la livraison — Livraison gratuite (Click & Collect)
                  </div>
                </div>

                <div className="modal-total">
                  <span>Total TTC</span>
                  <strong>{totalTTC} €</strong>
                </div>

                {submitError && (
                  <p className="modal-error">
                    <i className="ti ti-alert-circle"></i> {submitError}
                  </p>
                )}

                <button
                  className="modal-confirm-btn"
                  onClick={handleConfirmOrder}
                  disabled={submitting || !selectedAddress}
                >
                  {submitting
                    ? <><i className="ti ti-loader-2 spin"></i> Traitement...</>
                    : 'Valider la commande'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </FrontLayout>
  )
}

export default CartPage