import { useState, useRef } from 'react'
import { parseCsvFile, detectDelimiter, importMultiModule } from '../api/services/importService'
import { detectModulesFromHeaders } from '../api/utils/detectModules'
import { MODULES_CONFIG } from '../api/utils/modulesConfig'
import { validateFile } from '../api/utils/validateImport'
import './ImportPage.css'

// ─── Constantes UI ────────────────────────────────────────────────────────────

const MODULE_ICONS = {
  products:     'ti-box',
  customers:    'ti-users',
  orders:       'ti-clipboard-list',
  categories:   'ti-folder',
  combinations: 'ti-adjustments',
  stock:        'ti-package',
  taxes:        'ti-receipt-tax',
  images:       'ti-photo',
}

const MODULE_COLORS = {
  products:     '#3b82f6',
  categories:   '#8b5cf6',
  taxes:        '#f59e0b',
  combinations: '#06b6d4',
  stock:        '#10b981',
  customers:    '#ec4899',
  orders:       '#6366f1',
  images:       '#64748b',
}

const MODULE_LABELS = {
  ...Object.fromEntries(Object.entries(MODULES_CONFIG).map(([k, v]) => [k, v.label])),
  images: 'Images produits',
}

// importOrder global incluant les images en dernier
const MODULE_ORDER = {
  taxes:        1,
  categories:   2,
  products:     3,
  combinations: 4,
  stock:        5,
  customers:    6,
  orders:       7,
  images:       8,
}

// Dépendances inter-modules pour l'affichage du plan
const MODULE_DEPS = {
  products:     ['taxes', 'categories'],
  combinations: ['products'],
  orders:       ['customers', 'products'],
  images:       ['products'],
}

const MAX_FILE_SIZE_MB = 20

// ─── Composant FileCard ───────────────────────────────────────────────────────

const FileCard = ({ entry, onRemove, onDelimiterChange, disabled }) => {
  if (entry.type === 'zip') {
    return (
      <div className="file-card">
        <div className="file-card-main">
          <div className="file-card-icon zip">
            <i className="ti ti-file-zip"></i>
          </div>
          <div className="file-card-info">
            <span className="file-card-name">{entry.file.name}</span>
            <div className="file-card-badges">
              <span className="module-badge" style={{ background: '#64748b18', color: '#64748b', border: '0.5px solid #64748b44' }}>
                <i className="ti ti-photo"></i> Images produits
              </span>
            </div>
          </div>
        </div>
        {!disabled && (
          <button className="file-card-remove" onClick={() => onRemove(entry.id)} title="Retirer ce fichier">
            <i className="ti ti-x"></i>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="file-card">
      <div className="file-card-main">
        <div className="file-card-icon csv">
          <i className="ti ti-file-text"></i>
        </div>
        <div className="file-card-info">
          <span className="file-card-name">{entry.file.name}</span>
          <span className="file-card-meta">
            {entry.rows?.length ?? 0} ligne{entry.rows?.length !== 1 ? 's' : ''} · {entry.headers?.length ?? 0} colonnes
          </span>
          <div className="file-card-badges">
            {entry.selectedModules.map(mk => (
              <span
                key={mk}
                className="module-badge"
                style={{
                  background: `${MODULE_COLORS[mk]}18`,
                  color: MODULE_COLORS[mk],
                  border: `0.5px solid ${MODULE_COLORS[mk]}44`,
                }}
              >
                <i className={`ti ${MODULE_ICONS[mk] || 'ti-database'}`}></i>
                {MODULE_LABELS[mk]}
              </span>
            ))}
            {entry.selectedModules.length === 0 && (
              <span className="file-card-no-module">Aucun module détecté</span>
            )}
          </div>

          {/* Résumé de validation */}
          {entry.validation && (
            <div className="file-validation">
              {entry.validation.errors.length === 0 && entry.validation.warnings.length === 0 ? (
                <span className="val-ok">
                  <i className="ti ti-circle-check"></i> Fichier valide
                </span>
              ) : (
                <>
                  {entry.validation.errors.map((err, i) => (
                    <span key={`e${i}`} className="val-error">
                      <i className="ti ti-alert-circle"></i> {err.message}
                    </span>
                  ))}
                  {entry.validation.warnings.map((w, i) => (
                    <span key={`w${i}`} className="val-warning">
                      <i className="ti ti-alert-triangle"></i> {w.message}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="file-card-sep">
        <span className="sep-label">Séparateur :</span>
        {[';', ',', '|', '\t'].map(sep => (
          <button
            key={sep}
            className={`sep-btn ${entry.delimiter === sep ? 'active' : ''}`}
            onClick={() => !disabled && onDelimiterChange(entry.id, sep)}
            disabled={disabled}
          >
            {sep === '\t' ? 'TAB' : sep}
          </button>
        ))}
      </div>

      {!disabled && (
        <button className="file-card-remove" onClick={() => onRemove(entry.id)} title="Retirer ce fichier">
          <i className="ti ti-x"></i>
        </button>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

const ImportPage = () => {
  const [fileEntries, setFileEntries]   = useState([])
  const [fileError, setFileError]       = useState(null)
  const [importing, setImporting]       = useState(false)
  const [moduleProgress, setModuleProgress] = useState({})
  const [moduleDone, setModuleDone]     = useState({})
  const [globalReport, setGlobalReport] = useState(null)
  const fileInputRef = useRef(null)

  // ── Ajout d'un fichier ──────────────────────────────────────────────────────

  const handleAddFile = async (e) => {
    const file = e.target.files[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    setFileError(null)

    const isZip = file.name.toLowerCase().endsWith('.zip')
    const isCsv = file.name.toLowerCase().endsWith('.csv')

    if (!isZip && !isCsv) {
      setFileError('Seuls les fichiers .csv et .zip sont acceptés')
      return
    }
    if (file.size / (1024 * 1024) > MAX_FILE_SIZE_MB) {
      setFileError(`Le fichier dépasse ${MAX_FILE_SIZE_MB}MB`)
      return
    }
    if (isZip && fileEntries.some(e => e.type === 'zip')) {
      setFileError('Un seul fichier ZIP est autorisé')
      return
    }

    const id = `file_${Date.now()}_${Math.random().toString(36).slice(2)}`

    if (isZip) {
      setFileEntries(prev => [...prev, { id, file, type: 'zip' }])
      return
    }

    try {
      const { delimiter } = await detectDelimiter(file)
      const rows = await parseCsvFile(file, delimiter)
      if (rows.length === 0) { setFileError('Le fichier CSV est vide'); return }
      const headers = Object.keys(rows[0])
      const detectionResults = detectModulesFromHeaders(headers)
      const selectedModules = detectionResults.filter(r => r.detected).map(r => r.moduleKey)
      const validation = validateFile(rows, headers, selectedModules)
      setFileEntries(prev => [...prev, { id, file, type: 'csv', delimiter, rows, headers, detectionResults, selectedModules, validation }])
    } catch (err) {
      setFileError(`Erreur de lecture : ${err.message}`)
    }
  }

  const handleDelimiterChange = async (id, newDelimiter) => {
    const entry = fileEntries.find(e => e.id === id)
    if (!entry) return
    try {
      const rows = await parseCsvFile(entry.file, newDelimiter)
      const headers = Object.keys(rows[0] || {})
      const detectionResults = detectModulesFromHeaders(headers)
      const selectedModules = detectionResults.filter(r => r.detected).map(r => r.moduleKey)
      const validation = validateFile(rows, headers, selectedModules)
      setFileEntries(prev => prev.map(e =>
        e.id === id ? { ...e, delimiter: newDelimiter, rows, headers, detectionResults, selectedModules, validation } : e
      ))
    } catch (err) {
      setFileError(`Erreur re-parsing : ${err.message}`)
    }
  }

  const removeFile = (id) => setFileEntries(prev => prev.filter(e => e.id !== id))

  // ── Calcul du plan global ───────────────────────────────────────────────────

  const csvEntries = fileEntries.filter(e => e.type === 'csv')
  const zipEntry   = fileEntries.find(e => e.type === 'zip') || null

  // Tous les slots de modules, triés par importOrder global
  const plan = [
    ...csvEntries.flatMap(entry =>
      entry.selectedModules.map(mk => ({
        moduleKey: mk,
        fileName: entry.file.name,
        fileId: entry.id,
      }))
    ),
    ...(zipEntry ? [{ moduleKey: 'images', fileName: zipEntry.file.name, fileId: zipEntry.id }] : []),
  ].sort((a, b) => (MODULE_ORDER[a.moduleKey] ?? 99) - (MODULE_ORDER[b.moduleKey] ?? 99))

  // Map moduleKey → nom de fichier source (pour affichage des dépendances)
  const moduleFileMap = {}
  plan.forEach(s => { moduleFileMap[s.moduleKey] = s.fileName })

  const hasBlockingErrors = csvEntries.some(e => e.validation?.errors?.length > 0)
  const canImport = !importing && !globalReport && csvEntries.some(e => e.selectedModules.length > 0) && !hasBlockingErrors

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true)
    setModuleProgress({})
    setModuleDone({})
    setGlobalReport(null)

    const csvPlan = csvEntries.flatMap(entry =>
      entry.selectedModules.map(mk => ({
        moduleKey: mk,
        rows: entry.rows,
        mapping: entry.detectionResults.find(r => r.moduleKey === mk)?.mapping || {},
      }))
    )

    try {
      const report = await importMultiModule(
        csvPlan,
        zipEntry?.file || null,
        (mk, pct) => setModuleProgress(prev => ({ ...prev, [mk]: pct })),
        (mk, results) => setModuleDone(prev => ({ ...prev, [mk]: results }))
      )
      setGlobalReport(report)
    } catch (err) {
      setGlobalReport({ _error: err.message })
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setFileEntries([])
    setFileError(null)
    setModuleProgress({})
    setModuleDone({})
    setGlobalReport(null)
    setImporting(false)
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div className="import-page">

      {/* En-tête */}
      <div className="import-header">
        <div className="import-header-icon">
          <i className="ti ti-upload" aria-hidden="true"></i>
        </div>
        <div>
          <h1>Import de données</h1>
          <p>Ajoutez vos fichiers un par un — un seul bouton pour tout importer dans le bon ordre</p>
        </div>
      </div>

      {/* ── Zone 1 : Fichiers ── */}
      <div className="import-section">
        <div className="import-section-title">
          <i className="ti ti-files" aria-hidden="true"></i>
          Fichiers à importer
        </div>

        {fileEntries.length === 0 && (
          <div className="import-drop-hint">
            <i className="ti ti-file-plus" aria-hidden="true"></i>
            <p>Aucun fichier ajouté</p>
            <span>Cliquez sur « Ajouter un fichier » pour commencer</span>
          </div>
        )}

        <div className="file-list">
          {fileEntries.map(entry => (
            <FileCard
              key={entry.id}
              entry={entry}
              onRemove={removeFile}
              onDelimiterChange={handleDelimiterChange}
              disabled={importing || !!globalReport}
            />
          ))}
        </div>

        {!importing && !globalReport && (
          <button className="import-add-btn" onClick={() => fileInputRef.current?.click()}>
            <i className="ti ti-plus" aria-hidden="true"></i>
            Ajouter un fichier
            <span className="import-add-hint">.csv ou .zip</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.zip"
          style={{ display: 'none' }}
          onChange={handleAddFile}
        />

        {fileError && (
          <div className="import-file-error">
            <i className="ti ti-alert-circle" aria-hidden="true"></i>
            {fileError}
          </div>
        )}
      </div>

      {/* ── Zone 2 : Plan d'import ── */}
      {plan.length > 0 && !globalReport && (
        <div className="import-section">
          <div className="import-section-title">
            <i className="ti ti-list-numbers" aria-hidden="true"></i>
            Plan d'import — {plan.length} module{plan.length > 1 ? 's' : ''}, dans cet ordre
          </div>
          <p className="import-plan-desc">
            Un seul registre partagé : les IDs créés par un fichier sont disponibles pour les suivants.
          </p>
          <div className="import-plan">
            {plan.map((slot, idx) => {
              const deps = MODULE_DEPS[slot.moduleKey] || []
              const activeDeps = deps.filter(d => moduleFileMap[d])
              return (
                <div key={`${slot.moduleKey}-${slot.fileId}`} className="plan-row">
                  <span className="plan-num">{idx + 1}</span>
                  <i
                    className={`ti ${MODULE_ICONS[slot.moduleKey] || 'ti-database'} plan-icon`}
                    style={{ color: MODULE_COLORS[slot.moduleKey] }}
                    aria-hidden="true"
                  ></i>
                  <span className="plan-module">{MODULE_LABELS[slot.moduleKey]}</span>
                  <span className="plan-source">{slot.fileName}</span>
                  {activeDeps.length > 0 && (
                    <span className="plan-deps">
                      ← {activeDeps.map((d, i) => (
                        <span key={d}>
                          {i > 0 && ', '}
                          <strong>{MODULE_LABELS[d]}</strong>
                          <em> ({moduleFileMap[d]})</em>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Zone 3 : Bouton + Progression + Rapport ── */}

      {!globalReport && (
        <div className="import-launch">
          <button
            className="btn-launch"
            onClick={handleImport}
            disabled={!canImport}
          >
            <i className="ti ti-upload" aria-hidden="true"></i>
            {importing
              ? 'Import en cours...'
              : `Lancer l'import (${plan.length} module${plan.length > 1 ? 's' : ''})`}
          </button>
          {!canImport && !importing && fileEntries.length > 0 && (
            <p className="import-launch-hint">Ajoutez au moins un fichier CSV avec des modules détectés</p>
          )}
        </div>
      )}

      {/* Barres de progression */}
      {(importing || globalReport) && plan.length > 0 && (
        <div className="import-section">
          <div className="import-section-title">
            <i className="ti ti-activity" aria-hidden="true"></i>
            {importing ? 'Import en cours...' : 'Import terminé'}
          </div>

          {plan.map(slot => {
            const pct  = moduleProgress[slot.moduleKey] ?? 0
            const done = moduleDone[slot.moduleKey]
            const hasErrors = done?.errors?.length > 0
            return (
              <div key={`prog-${slot.moduleKey}`} className="module-progress-row">
                <div className="module-progress-header">
                  <i
                    className={`ti ${MODULE_ICONS[slot.moduleKey] || 'ti-database'}`}
                    style={{ color: MODULE_COLORS[slot.moduleKey] }}
                    aria-hidden="true"
                  ></i>
                  <span>{MODULE_LABELS[slot.moduleKey]}</span>
                  <span className="prog-source">{slot.fileName}</span>
                  {done && (
                    <span className={`prog-result ${hasErrors ? 'warn' : 'ok'}`}>
                      {done.success} ok{hasErrors ? ` / ${done.errors.length} erreur${done.errors.length > 1 ? 's' : ''}` : ''}
                    </span>
                  )}
                  {!done && importing && pct > 0 && (
                    <span className="prog-pct">{pct}%</span>
                  )}
                </div>
                <div className="progress-bar-wrapper">
                  <div
                    className="progress-bar"
                    style={{
                      width: done ? '100%' : `${pct}%`,
                      background: done
                        ? (hasErrors ? '#f59e0b' : '#22c55e')
                        : undefined,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rapport final */}
      {globalReport && !importing && (
        <div className="import-section">
          {globalReport._error ? (
            <p className="report-global-error">
              <i className="ti ti-alert-circle" aria-hidden="true"></i>
              {globalReport._error}
            </p>
          ) : (
            <>
              <div className="report-summary all-success">
                {Object.entries(globalReport).map(([mk, res]) => (
                  <div key={mk} className="report-stat">
                    <strong>{MODULE_LABELS[mk] || mk}</strong>
                    <span className="report-number success">{res.success}</span>
                    <span className="report-stat-label">succès</span>
                    {res.errors?.length > 0 && (
                      <span className="report-number error">
                        {res.errors.length} erreur{res.errors.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {Object.entries(globalReport).some(([, r]) => r.errors?.length > 0) && (
                <div className="error-list">
                  <p className="error-list-title">
                    <i className="ti ti-alert-triangle" aria-hidden="true"></i>
                    Détail des erreurs
                  </p>
                  {Object.entries(globalReport).flatMap(([mk, res]) =>
                    (res.errors || []).map((err, i) => (
                      <div key={`${mk}-${i}`} className="error-item">
                        <span className="error-line">{MODULE_LABELS[mk] || mk} — Ligne {err.line}</span>
                        <span className="error-msg">{String(err.message).slice(0, 150)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          <button className="btn-primary" onClick={handleReset} style={{ marginTop: '1.25rem' }}>
            <i className="ti ti-plus" aria-hidden="true"></i>
            Nouvel import
          </button>
        </div>
      )}

    </div>
  )
}

export default ImportPage
