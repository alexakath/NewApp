import useEnrichedProducts from '../hooks/useEnrichedProducts'
import './List.css'

const ProductList = () => {
  const { products, loading, error } = useEnrichedProducts()

  if (loading) return <div className="loading">Chargement des produits...</div>
  if (error) return <div className="error">{error}</div>

  if (products.length === 0) return (
    <div className="empty-state">
      <i className="ti ti-box" aria-hidden="true"></i>
      <p>Aucun produit détecté</p>
      <span>Importez des produits via la page Import CSV</span>
    </div>
  )

  return (
    <div className="list-container">
      <div className="list-header">
        <h1>Produits</h1>
        <span className="badge">{products.length}</span>
      </div>
      <table className="list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Image</th>
            <th>Nom</th>
            <th>Catégorie parente</th>
            <th>Catégorie</th>
            <th>Référence</th>
            <th>Prix HT</th>
            <th>Prix TTC</th>
            <th>Quantité</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td className="id-cell">#{product.id}</td>
              <td>
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="product-thumb"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div className="product-thumb-placeholder">
                    <i className="ti ti-photo" aria-hidden="true"></i>
                  </div>
                )}
              </td>
              <td className="name-cell">{product.name}</td>
              <td className="date-cell">{product.categoryParent}</td>
              <td className="date-cell">{product.categoryDefault}</td>
              <td className="date-cell">{product.reference}</td>
              <td className="price-cell">{product.priceHT} €</td>
              <td className="price-cell">{product.priceTTC} €</td>
              <td>
                <span className={`status ${product.quantity > 0 ? 'status-active' : 'status-inactive'}`}>
                  {product.quantity}
                </span>
              </td>
              <td>
                <span className={`status ${product.active == 1 ? 'status-active' : 'status-inactive'}`}>
                  {product.active == 1 ? 'Actif' : 'Inactif'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ProductList