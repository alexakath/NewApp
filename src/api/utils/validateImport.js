/**
 * Validation des fichiers CSV avant import.
 *
 * Règles :
 * - Casse ignorée (Taxe = taxe = TAXE)
 * - Accents obligatoires (specificite ≠ specificité → erreur bloquante)
 * - Colonnes obligatoires manquantes → erreur bloquante
 * - Colonnes inconnues → warning non-bloquant
 * - Dates : format DD/MM/YYYY obligatoire
 * - Montants : > 0 (strict) ou ≥ 0 (stock)
 */

// ─── Colonnes canoniques par module ──────────────────────────────────────────
// Noms exacts attendus, en minuscules, accents compris.
// La comparaison CSV se fait en toLowerCase() des deux côtés → casse ignorée,
// mais les accents restent et sont donc obligatoires.

const CANONICAL = {
  products: {
    required: ['nom', 'reference', 'prix_ttc', 'taxe', 'categorie', 'prix_achat', 'date_availability_produit'],
    optional: [],
    dates:          ['date_availability_produit'],
    amounts_strict: ['prix_ttc', 'prix_achat'],   // valeur > 0
    amounts_nonneg: [],                            // valeur ≥ 0
  },
  combinations: {
    required: ['reference'],
    optional: ['specificité', 'karazany', 'stock_initial', 'prix_vente_ttc'],
    dates:          [],
    amounts_strict: ['prix_vente_ttc'],  // > 0 quand présent
    amounts_nonneg: ['stock_initial'],   // ≥ 0
  },
  stock: {
    // Mêmes colonnes que combinations (fichier partagé)
    required: ['reference'],
    optional: ['specificité', 'karazany', 'stock_initial', 'prix_vente_ttc'],
    dates:          [],
    amounts_strict: ['prix_vente_ttc'],
    amounts_nonneg: ['stock_initial'],
  },
  customers: {
    required: ['nom', 'email', 'pwd', 'adresse'],
    optional: [],
    dates:          [],
    amounts_strict: [],
    amounts_nonneg: [],
  },
  orders: {
    required: ['email', 'achat', 'date'],
    optional: ['etat'],
    dates:          ['date'],
    amounts_strict: [],
    amounts_nonneg: [],
  },
  // taxes et categories : colonnes déjà couvertes par products dans le même fichier
  taxes: {
    required: ['taxe'],
    optional: [],
    dates: [], amounts_strict: [], amounts_nonneg: [],
  },
  categories: {
    required: ['categorie'],
    optional: [],
    dates: [], amounts_strict: [], amounts_nonneg: [],
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

/** Supprime les accents (pour la détection de "quasi-match") */
const stripAccents = (str) =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Trouve dans les headers CSV la clé réelle correspondant à un nom canonique (case-insensitive). */
const findHeader = (headers, canonicalName) =>
  headers.find(h => h.toLowerCase() === canonicalName.toLowerCase()) ?? null

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * @param {object[]} rows       - lignes parsées par PapaParse
 * @param {string[]} headers    - en-têtes du CSV
 * @param {string[]} modules    - modules détectés (ex: ['products', 'taxes', 'categories'])
 * @returns {{ errors: ValidationError[], warnings: ValidationWarning[] }}
 */
export const validateFile = (rows, headers, modules) => {
  const errors   = []
  const warnings = []

  // Toutes les colonnes connues (toutes combinaisons de modules)
  const allKnown = new Set()
  modules.forEach(mk => {
    const cfg = CANONICAL[mk]
    if (!cfg) return
    ;[...cfg.required, ...cfg.optional].forEach(c => allKnown.add(c.toLowerCase()))
  })

  // ── Colonnes inconnues (warning) ────────────────────────────────────────────
  headers.forEach(h => {
    if (!allKnown.has(h.toLowerCase())) {
      warnings.push({
        type: 'unknown_column',
        column: h,
        message: `Colonne "${h}" non reconnue dans les modules détectés`,
      })
    }
  })

  // ── Validation par module ───────────────────────────────────────────────────
  const checkedModules = new Set()

  modules.forEach(mk => {
    // combinations et stock partagent les mêmes lignes → valider une seule fois
    const dedupeKey = mk === 'stock' ? 'combinations' : mk
    if (checkedModules.has(dedupeKey)) return
    checkedModules.add(dedupeKey)

    const cfg = CANONICAL[mk]
    if (!cfg) return

    const allCols = [...cfg.required, ...cfg.optional]

    // 1. Colonnes obligatoires manquantes
    cfg.required.forEach(canonical => {
      const found = findHeader(headers, canonical)
      if (!found) {
        // Chercher un quasi-match (même lettres sans accents) pour un message précis
        const canonicalStripped = stripAccents(canonical.toLowerCase())
        const quasiMatch = headers.find(h => stripAccents(h.toLowerCase()) === canonicalStripped)

        errors.push({
          type: 'missing_column',
          module: mk,
          column: canonical,
          message: quasiMatch
            ? `Colonne "${quasiMatch}" : accent incorrect, attendu "${canonical}"`
            : `Colonne obligatoire "${canonical}" absente du fichier`,
        })
      }
    })

    // 2. Colonnes optionnelles avec accent incorrect (warning)
    cfg.optional.forEach(canonical => {
      const found = findHeader(headers, canonical)
      if (!found) {
        const canonicalStripped = stripAccents(canonical.toLowerCase())
        const quasiMatch = headers.find(h => stripAccents(h.toLowerCase()) === canonicalStripped)
        if (quasiMatch) {
          // Colonne présente mais avec mauvais accent → warning (optionnelle donc non-bloquant)
          warnings.push({
            type: 'wrong_accent_optional',
            module: mk,
            column: quasiMatch,
            expected: canonical,
            message: `Colonne optionnelle "${quasiMatch}" : accent incorrect, attendu "${canonical}" — le mapping peut échouer`,
          })
        }
      }
    })

    // 3. Validations ligne par ligne
    let dateErrors   = 0
    const dateLines  = []
    let amountErrors = 0
    const amountLines = []

    rows.forEach((row, i) => {
      const lineNum = i + 2  // ligne 1 = header, données à partir de 2

      // Dates
      cfg.dates.forEach(dateCol => {
        const key = findHeader(headers, dateCol)
        if (!key) return
        const val = String(row[key] || '').trim()
        if (val && !DATE_RE.test(val)) {
          dateErrors++
          if (dateLines.length < 3) dateLines.push(lineNum)
        }
      })

      // Montants stricts (> 0)
      cfg.amounts_strict.forEach(amtCol => {
        const key = findHeader(headers, amtCol)
        if (!key) return
        const raw = String(row[key] || '').replace(',', '.').trim()
        const num = parseFloat(raw)
        if (raw !== '' && !isNaN(num) && num <= 0) {
          amountErrors++
          if (amountLines.length < 3) amountLines.push(lineNum)
        }
      })

      // Montants non-négatifs (≥ 0)
      cfg.amounts_nonneg.forEach(amtCol => {
        const key = findHeader(headers, amtCol)
        if (!key) return
        const raw = String(row[key] || '').replace(',', '.').trim()
        const num = parseFloat(raw)
        if (raw !== '' && !isNaN(num) && num < 0) {
          amountErrors++
          if (amountLines.length < 3) amountLines.push(lineNum)
        }
      })
    })

    if (dateErrors > 0) {
      errors.push({
        type: 'invalid_date',
        module: mk,
        count: dateErrors,
        lines: dateLines,
        message: `${dateErrors} date${dateErrors > 1 ? 's' : ''} invalide${dateErrors > 1 ? 's' : ''} — format attendu JJ/MM/AAAA`
          + (dateLines.length > 0 ? ` (lignes ${dateLines.join(', ')}${dateErrors > 3 ? '…' : ''})` : ''),
      })
    }

    if (amountErrors > 0) {
      errors.push({
        type: 'invalid_amount',
        module: mk,
        count: amountErrors,
        lines: amountLines,
        message: `${amountErrors} montant${amountErrors > 1 ? 's' : ''} invalide${amountErrors > 1 ? 's' : ''} — valeur doit être > 0`
          + (amountLines.length > 0 ? ` (lignes ${amountLines.join(', ')}${amountErrors > 3 ? '…' : ''})` : ''),
      })
    }
  })

  return { errors, warnings }
}
