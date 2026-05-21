import { useParams, useLocation, useNavigate } from 'react-router-dom'
import FrontLayout from '../FrontLayout'
import './OrderConfirmPage.css'

const OrderConfirmPage = () => {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  const reference = state?.reference || '—'
  const totalTTC  = state?.totalTTC  || '—'

  return (
    <FrontLayout>
      <div className="confirm-wrapper">
        <div className="confirm-card">
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
              <span className="confirm-badge">Paiement effectué</span>
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
        </div>
      </div>
    </FrontLayout>
  )
}

export default OrderConfirmPage