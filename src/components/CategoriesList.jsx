import useEnrichedCategories from '../hooks/useEnrichedCategories'
import './List.css'

const CategoriesList = () => {
  const { categories, loading, error } = useEnrichedCategories()

  if (loading) return <div className="loading">Chargement des catégories...</div>
  if (error) return <div className="error">{error}</div>

  if (categories.length === 0) return (
    <div className="empty-state">
      <i className="ti ti-folder" aria-hidden="true"></i>
      <p>Aucune catégorie détectée</p>
      <span>Importez des catégories via la page Import CSV</span>
    </div>
  )

  return (
    <div className="list-container">
      <div className="list-header">
        <h1>Catégories</h1>
        <span className="badge">{categories.length}</span>
      </div>
      <table className="list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Catégorie</th>
            <th>Catégorie parente</th>
            <th>Produits</th>
            <th>Description</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr
              key={cat.id}
              className={cat.isTopLevel ? 'row-parent' : 'row-child'}
            >
              <td className="id-cell">#{cat.id}</td>
              <td className="name-cell">
                {cat.isTopLevel ? (
                  // Catégorie parent → icône dossier plein + fond coloré
                  <span className="cat-parent-label">
                    <i className="ti ti-folder-filled" aria-hidden="true"></i>
                    {cat.name}
                  </span>
                ) : (
                  // Catégorie enfant → indentation + icône
                  <span className="cat-child-label">
                    <i className="ti ti-corner-down-right" aria-hidden="true"></i>
                    {cat.name}
                  </span>
                )}
              </td>
              <td className="date-cell">
                {cat.parentName !== '—' ? (
                  <span className="cat-parent-ref">{cat.parentName}</span>
                ) : '—'}
              </td>
              <td>
                <span className="count-badge">
                  <i className="ti ti-box" aria-hidden="true"></i>
                  {cat.productCount}
                </span>
              </td>
              <td className="date-cell">{cat.description}</td>
              <td>
                <span className={`status ${cat.active == 1 ? 'status-active' : 'status-inactive'}`}>
                  {cat.active == 1 ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CategoriesList