import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import { verifyCartStock, createOrderFromCart, deleteCart, ORDER_STATES } from '../../api/services/ordersService'
import './OrderConfirmPage.css'

const OrderConfirmPage = () => {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  // 1️⃣ Récupération des données du state de navigation
  const cartId = state?.cartId
  const reference = state?.reference || '—'
  const totalTTC = state?.totalTTC || '—'

  // 2️⃣ Déclaration des états pour l'aléa 2
  const [checking, setChecking] = useState(!!cartId)
  const [stockError, setStockError] = useState(null)
  const [stockOk, setStockOk] = useState(!cartId)
  const [issubmitting, setIsSubmitting] = useState(false)
  const [cartItem, setCartItem] = useState(null)
  const [confirmedOrderId, setConfirmedOrderId] = useState(null)
  const [confirmError, setConfirmError] = useState(null)

  // 3️⃣ Effet de vérification automatique au chargement de la page
  useEffect(() => {
    if (!cartId) return

    const runStockCheck = async () => {
      try {
        setChecking(true)
        setStockError(null)
        
        // Appelle la fonction qui contrôle le stock et renvoie le cartItem enrichi
        const dataCartItem = await verifyCartStock(cartId)
        setCartItem(dataCartItem)
        
        setStockOk(true)
      } catch (err) {
        try { await deleteCart(cartId) } catch { /* panier déjà supprimé ou inexistant */ }
        setStockError(err.message)
      } finally {
        setChecking(false)
      }
    }

    runStockCheck()
  }, [cartId])

  // 4️⃣ Annulation de la duplication → supprime le panier créé
  const handleCancel = async () => {
    if (cartId) {
      try { await deleteCart(cartId) } catch { /* ignore */ }
    }
    navigate('/shop/my-orders')
  }

  // 5️⃣ Action du clic sur "Confirmer la commande"
  const handleFinalizeOrder = async () => {
    if (!cartItem) return
    setIsSubmitting(true)
    try {
      if (cartId && cartItem) {
      // 🔄 SCÉNARIO DUPLICATION (Aléa 2)
      // On doit appeler une fonction qui crée la commande ET la passe à l'état LIVRÉ
      const newOrderId = await createOrderFromCart(cartItem, ORDER_STATES.DELIVERED)
      setConfirmedOrderId(newOrderId)
      setTimeout(() => navigate('/shop/my-orders'), 2500)
    } else {
      // 🛒 SCÉNARIO ACHAT NORMAL (Classique)
      // Ici, on appelle votre fonction d'origine du projet
      // ex: await finalizeNormalOrder(...)
      alert("Commande standard créée avec succès !")
      navigate('/shop/my-orders')
    }
    } catch (err) {
      setConfirmError("Erreur lors de la création de la commande : " + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FrontLayout>
      <div className="confirm-wrapper">
        <div className="confirm-card">
          
          {/* ÉCRAN A : Chargement / Vérification des stocks (Aléa 2) */}
          {checking && (
            <div className="confirm-checking" style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner" style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
              <h2>Vérification des stocks en cours...</h2>
              <p>Nous nous assurons que tous les produits sont disponibles avant votre confirmation.</p>
            </div>
          )}

          {/* ÉCRAN B : Erreur de stock insuffisant (Aléa 2) */}
          {!checking && stockError && (
            <div className="confirm-error-state" style={{ textAlign: 'center', padding: '20px' }}>
              <div className="error-icon" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '15px' }}>⚠️</div>
              <h1 className="confirm-title" style={{ color: '#ef4444' }}>Validation impossible</h1>
              <p className="confirm-subtitle" style={{ margin: '15px 0', fontWeight: 'bold' }}>{stockError}</p>
              <p>Certains articles ne sont plus disponibles en quantité suffisante pour copier cette commande.</p>
              <div className="confirm-actions" style={{ marginTop: '25px' }}>
                <button className="confirm-btn-primary" onClick={() => navigate('/shop/my-orders')}>
                  Retour à mes commandes
                </button>
              </div>
            </div>
          )}

          {/* ÉCRAN E : Erreur lors de la création de la commande */}
          {confirmError && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', color: '#ef4444', marginBottom: '15px' }}>⚠️</div>
              <h1 className="confirm-title" style={{ color: '#ef4444' }}>Erreur de création</h1>
              <p className="confirm-subtitle" style={{ margin: '15px 0', fontWeight: 'bold' }}>{confirmError}</p>
              <div className="confirm-actions" style={{ marginTop: '25px' }}>
                <button className="confirm-btn-primary" onClick={() => navigate('/shop/my-orders')}>
                  Retour à mes commandes
                </button>
              </div>
            </div>
          )}

          {/* ÉCRAN C : Affichages des succès (Mode classique OU Aléa 2 validé) */}
          {!checking && !stockError && !confirmError && !confirmedOrderId && stockOk && (
            <>
              {cartId ? (
                /* Rendu Visuel : Mode Aléa 2 - Prêt à confirmer */
                <>
                  <div className="confirm-icon" style={{ color: '#2563eb' }}>
                    <i className="ti ti-shopping-cart-check"></i>
                  </div>
                  <h1 className="confirm-title">Stocks vérifiés !</h1>
                  <p className="confirm-subtitle">Tous les articles de votre ancienne commande sont disponibles.</p>
                  
                  <div className="confirm-details" style={{ margin: '20px 0', border: '1px solid #2563eb22', borderRadius: '6px' }}>
                    <p style={{ textAlign: 'center', margin: 0, padding: '10px', background: '#2563eb11', color: '#2563eb' }}>
                      <strong>Prêt pour la duplication (Panier #{cartId})</strong>
                    </p>
                  </div>

                  <div className="confirm-actions">
                    <button 
                      className="confirm-btn-primary" 
                      onClick={handleFinalizeOrder}
                      disabled={issubmitting}
                      style={{ backgroundColor: '#16a34a' }}
                    >
                      {issubmitting ? 'Création...' : '🛒 Confirmer la commande'}
                    </button>
                    <button className="confirm-btn-secondary" onClick={handleCancel} disabled={issubmitting}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                /* Rendu Visuel : Mode Classique d'origine */
                <>
                  <div className="confirm-icon">
                    <i className="ti ti-circle-check"></i>
                  </div>
                  <h1 className="confirm-title">Commande confirmée !</h1>
                  <p className="confirm-subtitle">Merci pour votre achat. Votre commande a bien été enregistrée.</p>

                  <div className="confirm-details">
                    <div className="confirm-row">
                      <span className="confirm-label">Référence</span>
                      <span className="confirm-value">{reference}</span>
                    </div>
                    <div className="confirm-row">
                      <span className="confirm-label">Numéro de commande</span>
                      <span className="confirm-value">#{id}</span>
                    </div>
                    <div className="confirm-row">
                      <span className="confirm-label">Total TTC</span>
                      <span className="confirm-value confirm-total">{totalTTC} €</span>
                    </div>
                    <div className="confirm-row">
                      <span className="confirm-label">Paiement</span>
                      <span className="confirm-value">À la livraison</span>
                    </div>
                    <div className="confirm-row">
                      <span className="confirm-label">État</span>
                      <span className="confirm-value"><span className="confirm-badge">Paiement effectué</span></span>
                    </div>
                  </div>

                  <div className="confirm-actions">
                    <button className="confirm-btn-primary" onClick={() => navigate('/shop/products')}>
                      Continuer mes achats
                    </button>
                    <button className="confirm-btn-secondary" onClick={() => navigate('/shop')}>
                      Accueil
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ÉCRAN D : Succès de la duplication */}
          {confirmedOrderId && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', color: '#16a34a', marginBottom: '15px' }}>✅</div>
              <h1 className="confirm-title">Commande créée !</h1>
              <p className="confirm-subtitle">
                La commande <strong>#{confirmedOrderId}</strong> a été créée et est passée à l'état <strong>Livré</strong>.
              </p>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '10px' }}>
                Redirection vers vos commandes...
              </p>
            </div>
          )}

        </div>
      </div>
    </FrontLayout>
  )
}

export default OrderConfirmPage