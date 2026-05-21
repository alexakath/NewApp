import { useState } from 'react'
import './ResetModuleItem.css'

const ResetModuleItem = ({
  moduleKey,
  label,
  count,
  subEntities   = {},
  selected      = true,
  forced        = false,   // ce module est imposé par une dépendance cascade
  forcedBy      = [],      // labels des modules qui l'imposent
  selectedSub   = {},
  onModuleToggle,
  onSubToggle,
  status        = null,    // 'loading' | 'success' | 'error'
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasSubEntities = Object.keys(subEntities).length > 0

  const getStatusBadge = () => {
    if (status === 'loading') return <span className="status-badge loading">Suppression en cours...</span>
    if (status === 'success') return <span className="status-badge success">✅ Supprimé</span>
    if (status === 'error')   return <span className="status-badge error">❌ Erreur</span>
    return null
  }

  return (
    <div className={`reset-module-item ${forced ? 'is-forced' : ''} ${!selected ? 'is-unselected' : ''}`}>
      <div className="reset-module-header">
        <div className="reset-module-left">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onModuleToggle(moduleKey)}
            className="reset-checkbox"
            disabled={status === 'loading' || forced}
            title={forced ? `Requis par : ${forcedBy.join(', ')}` : undefined}
          />

          <div className="reset-module-info">
            <div className="reset-module-title">
              {label}
              <span className="reset-count-badge">({count.toLocaleString('fr-FR')})</span>
              {forced && (
                <span className="forced-badge" title={`Requis par : ${forcedBy.join(', ')}`}>
                  Requis par {forcedBy.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="reset-module-right">
          {getStatusBadge()}

          {hasSubEntities && (
            <button
              type="button"
              className="expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Réduire' : 'Voir les sous-entités'}
            >
              <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
            </button>
          )}
        </div>
      </div>

      {isExpanded && hasSubEntities && (
        <div className="reset-sub-entities">
          <p className="sub-entities-title">Éléments liés qui seront également supprimés :</p>
          <div className="sub-entities-list">
            {Object.entries(subEntities).map(([subKey, subCount]) => (
              <div key={subKey} className="sub-entity-row">
                <input
                  type="checkbox"
                  checked={selectedSub[subKey] !== false}
                  onChange={() => onSubToggle(moduleKey, subKey)}
                  disabled={status === 'loading'}
                />
                <span className="sub-entity-label">
                  {subKey.replace(/_/g, ' ')}
                  <span className="sub-count">({subCount})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ResetModuleItem
