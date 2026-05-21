import useEnrichedCombinations from '../hooks/useEnrichedCombinations'
import './List.css'

const CombinationsList = () => {
  const { combinations, loading, error } = useEnrichedCombinations()

  if (loading) return <div className="loading">Chargement des déclinaisons...</div>
  if (error) return <div className="error">{error}</div>

  if (combinations.length === 0) return (
    <div className="empty-state">
      <i className="ti ti-adjustments" aria-hidden="true"></i>
      <p>Aucune déclinaison détectée</p>
      <span>Importez des déclinaisons via la page Import CSV</span>
    </div>
  )

  return (
    <div className="list-container">
      <div className="list-header">
        <h1>Déclinaisons</h1>
        <span className="badge">{combinations.length}</span>
      </div>
      <table className="list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Produit parent</th>
            <th>Référence</th>
            <th>Attributs</th>
            <th>Impact prix</th>
            <th>Prix final</th>
            <th>Stock</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {combinations.map((combo) => (
            <tr key={combo.id}>
              <td className="id-cell">#{combo.id}</td>
              <td className="name-cell">
                <div>
                  <p style={{ margin: 0, fontWeight: 500 }}>{combo.productName}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                    {combo.productReference}
                  </p>
                </div>
              </td>
              <td className="date-cell">{combo.reference}</td>
              <td>
                {combo.attributeLabel !== '—' ? (
                  <span className="attribute-badge">{combo.attributeLabel}</span>
                ) : '—'}
              </td>
              <td className={`price-cell ${combo.priceImpact.startsWith('+') ? 'price-positive' : 'price-negative'}`}>
                {combo.priceImpact} Ar
              </td>
              <td className="price-cell">{combo.finalPrice} Ar</td>
              <td>
                <span className={`stock-qty ${combo.outOfStock ? 'stock-out' : combo.lowStock ? 'stock-low' : 'stock-ok'}`}>
                  {combo.quantity}
                </span>
              </td>
              <td>
                {combo.outOfStock ? (
                  <span className="status status-inactive">Rupture</span>
                ) : combo.lowStock ? (
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

export default CombinationsList