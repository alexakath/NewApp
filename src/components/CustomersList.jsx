import useEnrichedCustomers from '../hooks/useEnrichedCustomers'
import './List.css'

const CustomersList = () => {
  const { customers, loading, error } = useEnrichedCustomers()

  if (loading) return <div className="loading">Chargement des clients...</div>
  if (error) return <div className="error">{error}</div>

  if (customers.length === 0) return (
    <div className="empty-state">
      <i className="ti ti-users" aria-hidden="true"></i>
      <p>Aucun client détecté</p>
      <span>Importez des clients via la page Import CSV</span>
    </div>
  )

  return (
    <div className="list-container">
      <div className="list-header">
        <h1>Clients</h1>
        <span className="badge">{customers.length}</span>
      </div>
      <table className="list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nom</th>
            <th>Email</th>
            <th>Civilité</th>
            <th>Groupe</th>
            <th>Commandes</th>
            <th>Adresses</th>
            <th>Inscription</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td className="id-cell">#{customer.id}</td>
              <td className="name-cell">
                <div className="avatar">
                  {customer.firstname?.[0]}{customer.lastname?.[0]}
                </div>
                {customer.gender !== '—' ? `${customer.gender} ` : ''}
                {customer.firstname} {customer.lastname}
              </td>
              <td className="date-cell">{customer.email}</td>
              <td className="date-cell">{customer.gender}</td>
              <td>
                <span className="group-badge">{customer.group}</span>
              </td>
              <td className="date-cell">
                <span className="count-badge">
                  <i className="ti ti-shopping-cart" aria-hidden="true"></i>
                  {customer.orderCount}
                </span>
              </td>
              <td className="date-cell">
                <span className="count-badge">
                  <i className="ti ti-map-pin" aria-hidden="true"></i>
                  {customer.addressCount}
                </span>
              </td>
              <td className="date-cell">{customer.dateAdd}</td>
              <td>
                <span className={`status ${customer.active == 1 ? 'status-active' : 'status-inactive'}`}>
                  {customer.active == 1 ? 'Actif' : 'Inactif'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CustomersList