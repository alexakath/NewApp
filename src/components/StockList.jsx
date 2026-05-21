import useEnrichedStock from '../hooks/useEnrichedStock'
import './List.css'

const StockList = () => {
  const { stock, loading, error } = useEnrichedStock()

  if (loading) return <div className="loading">Chargement du stock...</div>
  if (error) return <div className="error">{error}</div>

  if (stock.length === 0) return (
    <div className="empty-state">
      <i className="ti ti-package" aria-hidden="true"></i>
      <p>Aucun stock détecté</p>
      <span>Importez du stock via la page Import CSV</span>
    </div>
  )

  return (
    <div className="list-container">
      <div className="list-header">
        <h1>Stock</h1>
        <span className="badge">{stock.length}</span>
      </div>
      <table className="list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Produit</th>
            <th>Référence</th>
            <th>Déclinaison</th>
            <th>Quantité</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((s) => (
            <tr key={s.id}>
              <td className="id-cell">#{s.id}</td>
              <td className="name-cell">{s.productName}</td>
              <td className="date-cell">{s.productReference}</td>
              <td className="date-cell">
                {s.combinationRef
                  ? <span className="group-badge">{s.combinationRef}</span>
                  : '—'
                }
              </td>
              <td>
                <span className={`stock-qty ${s.outOfStock ? 'stock-out' : s.lowStock ? 'stock-low' : 'stock-ok'}`}>
                  {s.quantity}
                </span>
              </td>
              <td>
                {s.outOfStock ? (
                  <span className="status status-inactive">Rupture</span>
                ) : s.lowStock ? (
                  <span className="status status-warning">Stock faible</span>
                ) : (
                  <span className="status status-active">Disponible</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default StockList