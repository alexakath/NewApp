import Papa from 'papaparse'
import JSZip from 'jszip'
import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

// Extrait la valeur d'un champ fast-xml-parser (CDATA, xlink, ou scalaire)
const getVal = (f) => {
  if (f === null || f === undefined) return ''
  if (typeof f === 'object') return String(f['#text'] ?? '')
  return String(f)
}
import {
  buildXmlFromMapping,
  buildTaxRulesGroupXml,
  buildTaxRuleXml,
  buildProductOptionXml,
  buildProductOptionValueXml,
  buildCombinationXml,
  buildStockUpdateXml,
  ImportRegistry,
} from '../utils/detectModules'
import { MODULES_CONFIG } from '../utils/modulesConfig'
import { updateOrderState, updateOrderDateAdd, ORDER_STATES } from './ordersService'

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 300
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── Helpers prix / taxe ──────────────────────────────────────────────────────

// Lecture d'un champ CSV insensible à la casse
const getCsvFieldCi = (row, ...keys) => {
  for (const key of keys) {
    const v = row[key] ?? row[key[0].toUpperCase() + key.slice(1)] ?? row[key.toUpperCase()]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  const lowerKeys = keys.map(k => k.toLowerCase())
  for (const [k, v] of Object.entries(row)) {
    if (lowerKeys.includes(k.toLowerCase()) && v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim()
    }
  }
  return ''
}

const parseCsvFloat = (str) => parseFloat(String(str || '0').replace(',', '.').trim()) || 0

// "11,65%" → 0.1165  |  "5.60" → 0.056
const parseTaxRate = (taxeStr) =>
  parseCsvFloat(String(taxeStr || '0').replace('%', '')) / 100

// ─── Helpers parsing réponse PrestaShop ───────────────────────────────────────

const extractIdFromResponse = (responseData) => {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(responseData, 'application/xml')
    const idEl = doc.querySelector('id')
    return idEl?.textContent?.trim() || null
  } catch {
    return null
  }
}

const extractFieldFromResponse = (responseData, selector) => {
  try {
    const doc = new DOMParser().parseFromString(responseData, 'application/xml')
    return doc.querySelector(selector)?.textContent?.trim() || null
  } catch {
    return null
  }
}

const extractStockAvailableIdFromProductResponse = (responseData) => {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(responseData, 'application/xml')
    const el = doc.querySelector('stock_availables stock_available id')
    return el?.textContent?.trim() || null
  } catch {
    return null
  }
}

// ─── Parsers CSV ──────────────────────────────────────────────────────────────

export const detectDelimiter = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const firstLine = e.target.result.split('\n')[0]
      const candidates = [';', ',', '|', '\t']
      let bestSep = ';'
      let bestCount = 0
      for (const sep of candidates) {
        const count = firstLine.split(sep).length - 1
        if (count > bestCount) { bestCount = count; bestSep = sep }
      }
      resolve({ delimiter: bestSep, count: bestCount })
    }
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'))
    reader.readAsText(file)
  })
}

export const parseCsvFile = (file, delimiter = ';') => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`Erreur CSV : ${results.errors[0].message}`))
        } else {
          resolve(results.data)
        }
      },
      error: (err) => reject(err),
    })
  })
}

// ─── POST / PUT génériques ────────────────────────────────────────────────────

const postXml = async (endpoint, xml) => {
  const response = await axiosInstance.post(`/${endpoint}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  return response.data
}

const putXml = async (endpoint, id, xml) => {
  const response = await axiosInstance.put(`/${endpoint}/${id}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  return response.data
}

// ─── Import TAXES ─────────────────────────────────────────────────────────────

const importTaxRows = async (rows, mapping, registry, onProgress) => {
  const seen = new Map()
  for (const row of rows) {
    const key = MODULES_CONFIG.taxes.registryKey(row)
    if (key && !seen.has(key)) seen.set(key, row)
  }
  const uniqueRows = [...seen.values()]
  const total = uniqueRows.length
  const results = { success: 0, errors: [], skipped: rows.length - total }

  for (let i = 0; i < total; i++) {
    const row = uniqueRows[i]
    const taxKey = MODULES_CONFIG.taxes.registryKey(row)
    try {
      const taxXml = buildXmlFromMapping(row, 'taxes', mapping)
      const taxResp = await postXml('taxes', taxXml)
      const idTax = extractIdFromResponse(taxResp)
      if (!idTax) throw new Error('ID tax non récupéré depuis PrestaShop')

      const rateVal = taxKey
      const groupXml = buildTaxRulesGroupXml(`TVA ${rateVal}%`)
      const groupResp = await postXml('tax_rule_groups', groupXml)
      const idGroup = extractIdFromResponse(groupResp)
      if (!idGroup) throw new Error('ID tax_rules_group non récupéré')

      const ruleXml = buildTaxRuleXml(idGroup, idTax)
      await postXml('tax_rules', ruleXml)

      registry.set('taxes', taxKey, { id: idTax, taxRulesGroupId: idGroup })
      results.success++
    } catch (err) {
      results.errors.push({ line: i + 2, message: err.response?.data || err.message, row })
    }
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}

// ─── Import CATEGORIES ────────────────────────────────────────────────────────

const importCategoryRows = async (rows, mapping, registry, onProgress) => {
  const seen = new Map()
  for (const row of rows) {
    const key = MODULES_CONFIG.categories.registryKey(row)
    if (key && !seen.has(key)) seen.set(key, row)
  }
  const uniqueRows = [...seen.values()]
  const total = uniqueRows.length
  const results = { success: 0, errors: [], skipped: rows.length - total }

  for (let i = 0; i < total; i++) {
    const row = uniqueRows[i]
    const catKey = MODULES_CONFIG.categories.registryKey(row)
    try {
      const xml = buildXmlFromMapping(row, 'categories', mapping, registry)
      const resp = await postXml('categories', xml)
      const id = extractIdFromResponse(resp)
      if (!id) throw new Error('ID catégorie non récupéré')
      registry.set('categories', catKey, { id })
      results.success++
    } catch (err) {
      results.errors.push({ line: i + 2, message: err.response?.data || err.message, row })
    }
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}

// ─── Import PRODUCTS ──────────────────────────────────────────────────────────

const importProductRows = async (rows, mapping, registry, onProgress) => {
  const total = rows.length
  const results = { success: 0, errors: [], skipped: 0 }

  for (let i = 0; i < total; i++) {
    const row = rows[i]
    const ref = MODULES_CONFIG.products.registryKey(row)
    try {
      // Extraire le taux de taxe du CSV (ex: "11,65%" → 0.1165)
      const taxeRaw  = getCsvFieldCi(row, 'Taxe', 'taxe', 'TVA', 'tva', 'Tax', 'tax')
      const taxRate  = parseTaxRate(taxeRaw)

      // Extraire le prix TTC du CSV (pour le registre — le XML envoyé à PS utilise la valeur brute)
      const prixTTCKey = Object.keys(row).find(k =>
        ['prixttc', 'prix_ttc'].includes(k.toLowerCase().replace(/[^a-z0-9]/g, ''))
      )
      const prixTTC = prixTTCKey ? parseCsvFloat(row[prixTTCKey]) : 0

      // Envoyer prix_ttc tel quel — PS fait sa propre conversion TTC→HT en interne
      const xml = buildXmlFromMapping(row, 'products', mapping, registry)
      const resp = await postXml('products', xml)
      const id = extractIdFromResponse(resp)
      if (!id) throw new Error('ID produit non récupéré')
      const stockAvailableId = extractStockAvailableIdFromProductResponse(resp)

      // HT calculé localement = ce que PS stockera (utilisé uniquement pour les deltas des déclinaisons)
      const priceHT = taxRate > 0 ? prixTTC / (1 + taxRate) : prixTTC

      registry.set('products', ref, { id, stockAvailableId, priceHT, taxRate })
      results.success++
    } catch (err) {
      results.errors.push({ line: i + 2, message: err.response?.data || err.message, row })
    }
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < total) await sleep(BATCH_DELAY_MS)
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}

// ─── Import COMBINATIONS ──────────────────────────────────────────────────────

const importCombinationRows = async (rows, mapping, registry, onProgress) => {
  const total = rows.length
  const results = { success: 0, errors: [], skipped: 0 }

  const optionRegistry = new ImportRegistry()
  const optionValueRegistry = new ImportRegistry()

  const getSpecKey = (row) => {
    const k = Object.keys(row).find(k => {
      const n = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '')
      return n === 'specificite'
    })
    return k ? row[k] : ''
  }
  const getValKey = (row) => {
    const k = Object.keys(row).find(k => k.toLowerCase() === 'karazany')
    return k ? row[k] : ''
  }
  const getPrixKey = (row) => {
    const k = Object.keys(row).find(k => {
      const n = k.toLowerCase().replace(/[^a-z0-9_]/g, '')
      return n === 'prix_vente_ttc' || n === 'prixventtc' || n === 'prixvettc'
    })
    return k ? row[k] : ''
  }
  for (let i = 0; i < total; i++) {
    const row = rows[i]
    const ref = row['reference'] || row['Reference'] || ''
    const specificite = getSpecKey(row)
    const karazany = getValKey(row)
    const prixVenteTTCRaw = getPrixKey(row)

    const productEntry = registry.get('products', ref)
    if (!productEntry?.id) {
      results.errors.push({
        line: i + 2,
        message: `Produit "${ref}" introuvable dans le registre — importer d'abord les produits`,
        row,
      })
      onProgress?.(Math.round(((i + 1) / total) * 100), results)
      continue
    }
    const idProduct = productEntry.id

    try {
      // Produit simple (pas de déclinaison) : rien à créer ici,
      // le stock sera mis à jour par importStockRows
      if (!specificite || !karazany) {
        results.success++
        onProgress?.(Math.round(((i + 1) / total) * 100), results)
        continue
      }

      if (!optionRegistry.has('opt', specificite)) {
        const optXml = buildProductOptionXml(specificite)
        const optResp = await postXml('product_options', optXml)
        const idOpt = extractIdFromResponse(optResp)
        if (!idOpt) throw new Error(`ID product_option non récupéré pour "${specificite}"`)
        optionRegistry.set('opt', specificite, { id: idOpt })
      }
      const idAttribute = optionRegistry.get('opt', specificite).id

      const valKey = `${specificite}|${karazany}`
      if (!optionValueRegistry.has('val', valKey)) {
        const valXml = buildProductOptionValueXml(karazany, idAttribute)
        const valResp = await postXml('product_option_values', valXml)
        const idVal = extractIdFromResponse(valResp)
        if (!idVal) throw new Error(`ID option_value non récupéré pour "${karazany}"`)
        optionValueRegistry.set('val', valKey, { id: idVal })
      }
      const idOptionValue = optionValueRegistry.get('val', valKey).id

      // delta TTC = prix de cette déclinaison − prix de base du produit
      // buildCombinationXml(priceTTC_delta, taxRate_percent) calcule l'écart HT = deltaTTC / (1 + taxRate/100)
      const prixVenteTTC  = parseCsvFloat(prixVenteTTCRaw)
      const { priceHT: baseHT = 0, taxRate: baseTaxRate = 0 } = productEntry
      const baseTTC    = baseHT * (1 + baseTaxRate)   // recompose le prix_ttc de base
      const deltaTTC   = prixVenteTTC > 0 ? prixVenteTTC - baseTTC : 0
      const taxRatePct = baseTaxRate * 100              // 0.1165 → 11.65

      const combiRef = `${ref}_${karazany}`
      const combXml = buildCombinationXml(idProduct, [idOptionValue], String(deltaTTC), taxRatePct, combiRef)
      const combResp = await postXml('combinations', combXml)
      const idCombination = extractIdFromResponse(combResp)
      if (!idCombination) throw new Error('ID combination non récupéré')

      // Stocker dans le registre : importStockRows s'en servira pour mettre à jour le stock
      registry.set('combinations', `${ref}|${karazany}`, { id: idCombination, idProduct })
      results.success++
    } catch (err) {
      results.errors.push({ line: i + 2, message: err.response?.data || err.message, row })
    }
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < total) await sleep(BATCH_DELAY_MS)
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}

// ─── Import STOCK ─────────────────────────────────────────────────────────────
// Runs after combinations (importOrder 5 > 4).
// Lit le registre pour résoudre produits ET combinaisons, puis met à jour stock_availables.

const importStockRows = async (rows, mapping, registry, onProgress) => {
  const total = rows.length
  const results = { success: 0, errors: [], skipped: 0 }

  const getKarazany = (row) => {
    const k = Object.keys(row).find(k => k.toLowerCase() === 'karazany')
    return k ? (row[k] || '').trim() : ''
  }
  const getStockQty = (row) => {
    const k = Object.keys(row).find(k => {
      const n = k.toLowerCase().replace(/[^a-z0-9_]/g, '')
      return n === 'stock_initial' || n === 'stockinitial' || n === 'stock'
    })
    return k ? (row[k] || '').trim() : ''
  }

  for (let i = 0; i < total; i++) {
    const row = rows[i]
    const ref      = (row['reference'] || row['Reference'] || '').trim()
    const karazany = getKarazany(row)
    const stockQty = getStockQty(row)

    if (!stockQty) { results.skipped++; onProgress?.(Math.round(((i + 1) / total) * 100), results); continue }

    const productEntry = registry.get('products', ref)
    if (!productEntry?.id) {
      results.errors.push({ line: i + 2, message: `Produit "${ref}" introuvable dans le registre`, row })
      onProgress?.(Math.round(((i + 1) / total) * 100), results)
      continue
    }

    try {
      if (karazany) {
        // Déclinaison : récupérer l'ID combination depuis le registre
        const combEntry = registry.get('combinations', `${ref}|${karazany}`)
        if (!combEntry?.id) {
          results.errors.push({ line: i + 2, message: `Déclinaison "${ref}|${karazany}" introuvable dans le registre`, row })
          onProgress?.(Math.round(((i + 1) / total) * 100), results)
          continue
        }
        // Chercher le stock_available créé par PrestaShop pour cette combination
        const stockSearchResp = await axiosInstance.get(
          `/stock_availables?display=full&filter[id_product]=${productEntry.id}&filter[id_product_attribute]=${combEntry.id}`
        )
        const stockId = extractFieldFromResponse(stockSearchResp.data, 'stock_available id')
        if (!stockId) throw new Error(`stock_available introuvable pour ${ref}|${karazany}`)
        const xml = buildStockUpdateXml(stockId, productEntry.id, stockQty, combEntry.id)
        await putXml('stock_availables', stockId, xml)
        try { await postStockMovementRecord(stockId, parseInt(stockQty), 1) } catch (e) { console.warn('[Import] mvt entrée stock:', e.message) }
      } else {
        // Produit simple : utiliser le stockAvailableId stocké lors de la création produit
        if (!productEntry.stockAvailableId) throw new Error(`stockAvailableId manquant pour "${ref}"`)
        const xml = buildStockUpdateXml(productEntry.stockAvailableId, productEntry.id, stockQty, '0')
        await putXml('stock_availables', productEntry.stockAvailableId, xml)
        try { await postStockMovementRecord(productEntry.stockAvailableId, parseInt(stockQty), 1) } catch (e) { console.warn('[Import] mvt entrée stock:', e.message) }
      }
      results.success++
    } catch (err) {
      results.errors.push({ line: i + 2, message: err.response?.data || err.message, row })
    }
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}

// ─── Import CUSTOMERS ─────────────────────────────────────────────────────────
// Stocke registry.customers[email] = { id }
// Stocke registry.addresses[email] = { id } pour résolution dans les commandes

const importCustomerRows = async (rows, mapping, registry, onProgress) => {
  // Récupérer l'ID de France (ISO=FR) actif dans ce PS — ne pas hardcoder
  let importCountryId = '8'  // fallback PS8 standard
  try {
    const ctryResp = await axiosInstance.get('/countries?display=full&filter[active]=[1]&filter[iso_code]=[FR]')
    const ctryParsed = parseXML(ctryResp.data)
    const rawC = ctryParsed?.prestashop?.countries?.country
    const ctries = rawC ? (Array.isArray(rawC) ? rawC : [rawC]) : []
    const france = ctries.find(c => getVal(c.active) === '1') || ctries[0]
    if (france) importCountryId = getVal(france.id) || '8'
    console.log('[Import] Pays trouvés :', JSON.stringify(ctries.map(c => ({ id: getVal(c.id), iso: getVal(c.iso_code), active: getVal(c.active) }))))
  } catch { /* fallback '8' */ }
  console.log('[Import] ID pays France :', importCountryId)
  

  const seen = new Map()
  for (const row of rows) {
    const key = MODULES_CONFIG.customers.registryKey(row)
    if (key && !seen.has(key)) seen.set(key, row)
  }
  const uniqueRows = [...seen.values()]
  const total = uniqueRows.length
  const results = { success: 0, errors: [], skipped: rows.length - total }

  for (let i = 0; i < total; i++) {
    const row = uniqueRows[i]
    const email = MODULES_CONFIG.customers.registryKey(row)
    try {
      const rawPwd = row['pwd'] || row['password'] || row['passwd'] || ''
      // PS re-hashe le mot de passe avec password_hash() côté PHP lors du Customer::add()
      // → envoyer le mot de passe en clair, PS stockera $2y$... (bcrypt PHP)
      // → le FO peut ensuite comparer avec bcrypt.compare après $2y$→$2b$ conversion
      const customerXml = buildCustomerXml(row, rawPwd)

      let idCustomer = null
      try {
        console.log('[Import] Customer XML:', customerXml)
        const resp = await postXml('customers', customerXml)
        // parseXML gère CDATA + warnings PHP, contrairement à DOMParser
        const custParsed = parseXML(resp)
        idCustomer = getVal(custParsed?.prestashop?.customer?.id) || ''
      } catch (postErr) {
        console.error('[Import] Erreur PS customers:', postErr.response?.data)
        // Code PS 140 = email déjà utilisé → récupérer le client existant (upsert)
        const errData = String(postErr.response?.data || '')
        if (errData.includes('<errors>') && errData.includes('140')) {
          const findResp = await axiosInstance.get(
            `/customers?display=full&filter[email]=[${encodeURIComponent(email)}]`
          )
          const findParsed = parseXML(findResp.data)
          const raw = findParsed?.prestashop?.customers?.customer
          const first = Array.isArray(raw) ? raw[0] : raw
          idCustomer = getVal(first?.id) || ''
        } else {
          throw postErr
        }
      }
      if (!idCustomer) throw new Error('ID customer non récupéré')
      registry.set('customers', email, { id: idCustomer })

      const adresse = row['adresse'] || row['address'] || ''
      const nom = row['nom'] || row['name'] || ''
      // Toujours créer une nouvelle adresse depuis le CSV (pays actif = 72).
      // On ne réutilise pas les adresses PS existantes : elles peuvent avoir un pays
      // inactif si elles viennent d'imports précédents avec un mauvais id_country.
      if (adresse) {
        try {
          const addrXml = buildAddressXml(idCustomer, nom, adresse, importCountryId)
          const addrResp = await postXml('addresses', addrXml)
          const addrParsed = parseXML(addrResp)
          const idAddress = getVal(addrParsed?.prestashop?.address?.id) || ''
          if (idAddress) {
            registry.set('addresses', email, { id: idAddress })
            console.log('[Import] Adresse créée pour', email, '→ ID:', idAddress)
          } else {
            console.warn('[Import] ⚠ Adresse SANS ID pour', email,
              '— réponse PS:', String(addrResp || '').substring(0, 300))
          }
        } catch (addrErr) {
          console.warn('[Import] ⚠ Adresse EXCEPTION pour', email, ':',
            addrErr.response?.data ? String(addrErr.response.data).substring(0, 300) : addrErr.message)
        }
      }
      results.success++
    } catch (err) {
      results.errors.push({ line: i + 2, message: err.response?.data || err.message, row })
    }
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}


// ─── XML customers + addresses ────────────────────────────────────────────────

const buildCustomerXml = (row, hashedPwd) => {
  const nom = row['nom'] || row['name'] || ''
  const email = row['email'] || row['Email'] || ''
  const parts = nom.trim().split(' ')
  const firstname = parts.length > 1 ? parts.slice(0, -1).join(' ') : nom
  const lastname = parts.length > 1 ? parts[parts.length - 1] : nom
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <firstname><![CDATA[${firstname}]]></firstname>
    <lastname><![CDATA[${lastname}]]></lastname>
    <email><![CDATA[${email}]]></email>
    <passwd>${hashedPwd}</passwd>
    <active>1</active>
    <id_default_group>3</id_default_group>
    <newsletter>0</newsletter>
    <optin>0</optin>
  </customer>
</prestashop>`
}

const buildAddressXml = (idCustomer, nom, adresse, countryId = '8') => {
  const parts = nom.trim().split(' ')
  const firstname = parts.length > 1 ? parts.slice(0, -1).join(' ') : nom
  const lastname = parts.length > 1 ? parts[parts.length - 1] : nom
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <address>
    <id_customer>${idCustomer}</id_customer>
    <id_country>${countryId}</id_country>
    <alias>Mon adresse</alias>
    <firstname><![CDATA[${firstname}]]></firstname>
    <lastname><![CDATA[${lastname}]]></lastname>
    <address1><![CDATA[${adresse}]]></address1>
    <city><![CDATA[${adresse}]]></city>
    <postcode>75000</postcode>
    <active>1</active>
  </address>
</prestashop>`
}

// ─── Import ORDERS — flux cart → order ───────────────────────────────────────
// etat vide → créer le panier seulement ("dans le panier")
// etat non-vide → créer panier + commande + changer état

const parseAchat = (achatStr) => {
  if (!achatStr) return []
  const items = []
  const regex = /\("([^"]+)";(\d+);"([^"]*)"\)/g
  let match
  while ((match = regex.exec(achatStr)) !== null) {
    items.push({ reference: match[1], quantity: parseInt(match[2], 10), variant: match[3] })
  }
  return items
}

const mapEtatToStateId = (etat) => {
  if (!etat || etat.trim() === '') return null  // vide → Dans le panier
  const e = etat.toLowerCase().trim()
  if (e.includes('panier') || e.includes('cart'))               return null                         // Dans le panier
  if (e.includes('livr')   || e.includes('deliver'))            return ORDER_STATES.DELIVERED        // Livré
  if (e.includes('accept') || e.includes('effectu') || e.includes('pay')) return ORDER_STATES.PAYMENT_ACCEPTED  // Paiement accepté
  if (e.includes('annul')  || e.includes('cancel'))             return ORDER_STATES.CANCELLED        // Annulé
  return ORDER_STATES.PAYMENT_ACCEPTED
}

const buildImportCartXml = (idCustomer, idAddress, carrierId, currencyId, dateAdd) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${idCustomer}</id_customer>
    <id_address_delivery>${idAddress}</id_address_delivery>
    <id_address_invoice>${idAddress}</id_address_invoice>
    <id_carrier>${carrierId}</id_carrier>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <delivery_option></delivery_option>
    <allow_seperated_package>0</allow_seperated_package>
    <date_add>${dateAdd}</date_add>
    <date_upd>${dateAdd}</date_upd>
  </cart>
</prestashop>`

const buildImportCartUpdateXml = (cartId, idCustomer, idAddress, carrierId, currencyId, secureKey, rowsXml, dateAdd) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id>${cartId}</id>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${idCustomer}</id_customer>
    <id_address_delivery>${idAddress}</id_address_delivery>
    <id_address_invoice>${idAddress}</id_address_invoice>
    <id_carrier>${carrierId}</id_carrier>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <delivery_option></delivery_option>
    <allow_seperated_package>0</allow_seperated_package>
    <date_add>${dateAdd}</date_add>
    <date_upd>${dateAdd}</date_upd>
    <secure_key>${secureKey}</secure_key>
    <associations>
      <cart_rows nodeType="cart_row" api="cart_rows">
${rowsXml}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`

const buildImportOrderXml = (idCustomer, idAddress, cartId, carrierId, currencyId, secureKey, dateAdd) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery>${idAddress}</id_address_delivery>
    <id_address_invoice>${idAddress}</id_address_invoice>
    <id_cart>${cartId}</id_cart>
    <id_currency>${currencyId}</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${idCustomer}</id_customer>
    <id_carrier>${carrierId}</id_carrier>
    <module>ps_cashondelivery</module>
    <payment>Paiement a la livraison</payment>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <total_discounts>0</total_discounts>
    <total_discounts_tax_incl>0</total_discounts_tax_incl>
    <total_discounts_tax_excl>0</total_discounts_tax_excl>
    <total_paid>0</total_paid>
    <total_paid_tax_incl>0</total_paid_tax_incl>
    <total_paid_tax_excl>0</total_paid_tax_excl>
    <total_paid_real>0</total_paid_real>
    <total_products>0</total_products>
    <total_products_wt>0</total_products_wt>
    <total_shipping>0</total_shipping>
    <total_shipping_tax_incl>0</total_shipping_tax_incl>
    <total_shipping_tax_excl>0</total_shipping_tax_excl>
    <carrier_tax_rate>0</carrier_tax_rate>
    <total_wrapping>0</total_wrapping>
    <total_wrapping_tax_incl>0</total_wrapping_tax_incl>
    <total_wrapping_tax_excl>0</total_wrapping_tax_excl>
    <round_mode>2</round_mode>
    <round_type>1</round_type>
    <conversion_rate>1</conversion_rate>
    <secure_key>${secureKey}</secure_key>
    <id_shop_group>1</id_shop_group>
    <id_shop>1</id_shop>
    <valid>1</valid>
    <date_add>${dateAdd}</date_add>
    <date_upd>${dateAdd}</date_upd>
    <invoice_date>0000-00-00 00:00:00</invoice_date>
    <invoice_number>0</invoice_number>
    <shipping_number></shipping_number>
  </order>
</prestashop>`

// Crée un enregistrement dans ps_stock_mvt via POST /stock_movements.
// N'affecte PAS stock_available (déjà géré séparément).
const postStockMovementRecord = async (idStockAvailable, physicalQty, sign, dateAdd) => {
  const now = dateAdd || new Date().toISOString().replace('T', ' ').substring(0, 19)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_mvt>
    <id_stock>${idStockAvailable}</id_stock>
    <id_stock_mvt_reason>${sign > 0 ? 1 : 2}</id_stock_mvt_reason>
    <id_employee>0</id_employee>
    <physical_quantity>${Math.abs(physicalQty)}</physical_quantity>
    <sign>${sign > 0 ? 1 : -1}</sign>
    <price_te>0</price_te>
    <date_add>${now}</date_add>
  </stock_mvt>
</prestashop>`
  await axiosInstance.post('/stock_movements', xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

// Pour les commandes livrées importées : enregistre la sortie dans stock_mvt.
// PS a déjà décrémenté stock_available via validateOrder() → on crée juste la trace.
const recordStockExitForItems = async (resolvedItems, dateAdd) => {
  for (const item of resolvedItems) {
    try {
      const combId = (item.idCombination && item.idCombination !== '0') ? item.idCombination : '0'
      const resp = await axiosInstance.get(
        `/stock_availables?display=full&filter[id_product]=[${item.idProduct}]&filter[id_product_attribute]=[${combId}]`
      )
      const parsed = parseXML(resp.data)
      const raw    = parsed?.prestashop?.stock_availables?.stock_available
      const stock  = raw ? (Array.isArray(raw) ? raw[0] : raw) : null
      if (!stock) {
        console.warn(`[Import] stock_available introuvable pour sortie P${item.idProduct}/${combId}`)
        continue
      }
      await postStockMovementRecord(getVal(stock.id), item.quantity, -1, dateAdd)
    } catch (err) {
      console.warn(`[Import] Mouvement sortie stock P${item.idProduct}:`, err.message)
    }
  }
}

// Re-incrémente le stock après création d'un ordre via l'import.
// PS décrémente automatiquement via validateOrder() à la création de TOUT ordre.
// Le stock ne doit décroître qu'à la livraison (bouton "Livrer") → on annule systématiquement.
const reIncrementStockForOrderItems = async (resolvedItems) => {
  for (const item of resolvedItems) {
    try {
      const combId = (item.idCombination && item.idCombination !== '0') ? item.idCombination : '0'
      const resp = await axiosInstance.get(
        `/stock_availables?display=full&filter[id_product]=[${item.idProduct}]&filter[id_product_attribute]=[${combId}]`
      )
      const parsed  = parseXML(resp.data)
      const raw     = parsed?.prestashop?.stock_availables?.stock_available
      const stock   = raw ? (Array.isArray(raw) ? raw[0] : raw) : null
      if (!stock) {
        console.warn(`[Import] Stock introuvable pour produit ${item.idProduct} / déclinaison ${combId}`)
        continue
      }
      const stockId    = getVal(stock.id)
      const currentQty = parseInt(getVal(stock.quantity) || '0', 10)
      const newQty     = currentQty + item.quantity  // ré-incrément : annule le décréement PS
      const xml        = buildStockUpdateXml(stockId, item.idProduct, String(newQty), combId)
      await putXml('stock_availables', stockId, xml)
    } catch (err) {
      console.warn(`[Import] Ré-incrément stock P${item.idProduct}:`, err.message)
    }
  }
}

const importOrderRows = async (rows, mapping, registry, onProgress) => {
  const total = rows.length
  const results = { success: 0, errors: [], skipped: 0 }

  // Récupérer les valeurs par défaut une seule fois
  const getVal = (f) => {
    if (f === null || f === undefined) return ''
    if (typeof f === 'object') return String(f['#text'] ?? '')
    return String(f)
  }
  const toArr = (d) => !d ? [] : Array.isArray(d) ? d : [d]

  let defaultCarrierId = '1'
  let defaultCurrencyId = '1'

  try {
    const cResp = await axiosInstance.get('/carriers?display=full&filter[deleted]=[0]')
    const cParsed = parseXML(cResp.data)
    const carriers = toArr(cParsed?.prestashop?.carriers?.carrier)
      .filter(c => getVal(c.deleted) !== '1')

    // Les noms de transporteurs sont multilingues : { language: { '#text': '...' } }
    // getVal() ne remonte pas jusqu'à language → il faut lire explicitement
    const getCarrierName = (c) => {
      const n = c.name
      if (!n) return ''
      if (typeof n === 'string') return n
      if (typeof n !== 'object') return String(n)
      if ('#text' in n) return String(n['#text'])
      const lang = n.language
      if (!lang) return ''
      const first = Array.isArray(lang) ? lang[0] : lang
      return typeof first === 'object' ? String(first['#text'] || '') : String(first || '')
    }

    // Préférer le transporteur "Click & Collect" (compatible ps_cashondelivery)
    const click  = carriers.find(c => getCarrierName(c).toLowerCase().includes('click'))
    const active = carriers.find(c => getVal(c.active) === '1')
    const best   = click || active || carriers[0]
    if (best) defaultCarrierId = getVal(best.id) || '1'
    console.log('[Import] Transporteur sélectionné :', defaultCarrierId, '—', getCarrierName(best || {}))
  } catch { /* fallback '1' */ }

  try {
    const curResp = await axiosInstance.get('/currencies?display=full&filter[deleted]=0')
    const curParsed = parseXML(curResp.data)
    const currencies = toArr(curParsed?.prestashop?.currencies?.currency)
    const def = currencies.find(c => getVal(c.conversion_rate) === '1') || currencies[0]
    if (def) defaultCurrencyId = getVal(def.id) || '1'
  } catch { /* fallback '1' */ }

  // Trouver ou créer l'état PS "Dans le panier" (pour les lignes etat vide)
  // Cet état permet à la commande d'apparaître dans PS BO Commandes avec le bon libellé.
  let dansPanierStateId = null
  try {
    const statesResp = await axiosInstance.get('/order_states?display=full')
    const statesParsed = parseXML(statesResp.data)
    const rawStates = toArr(statesParsed?.prestashop?.order_states?.order_state)
    const getStateName = (s) => {
      const n = s.name
      if (!n) return ''
      if (typeof n === 'string') return n
      const lang = n.language
      if (!lang) return ''
      const first = Array.isArray(lang) ? lang[0] : lang
      return typeof first === 'object' ? String(first['#text'] || '') : String(first || '')
    }
    const existing = rawStates.find(s => getStateName(s).toLowerCase() === 'dans le panier')
    if (existing) {
      dansPanierStateId = getVal(existing.id)
    } else {
      // Créer l'état "Dans le panier" dans PS
      const stateXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_state>
    <name><language id="1"><![CDATA[Dans le panier]]></language></name>
    <color>#d97706</color>
    <logable>0</logable>
    <invoice>0</invoice>
    <send_email>0</send_email>
    <delivery>0</delivery>
    <hidden>0</hidden>
    <shipped>0</shipped>
    <paid>0</paid>
    <pdf_delivery>0</pdf_delivery>
    <pdf_invoice>0</pdf_invoice>
    <deleted>0</deleted>
  </order_state>
</prestashop>`
      const stateResp = await postXml('order_states', stateXml)
      const stateId = extractIdFromResponse(stateResp)
      if (stateId) {
        dansPanierStateId = stateId
        console.log('[Import] État "Dans le panier" créé dans PS avec ID:', dansPanierStateId)
      }
    }
  } catch (stateErr) {
    console.warn('[Import] État "Dans le panier" non créé:', stateErr.message)
  }

  for (let i = 0; i < total; i++) {
    const row = rows[i]
    // Lecture insensible à la casse pour tous les champs commande
    const getCsvField = (row, key) => {
      const direct = row[key] || row[key[0].toUpperCase() + key.slice(1)] || row[key.toUpperCase()]
      if (direct) return String(direct)
      const entry = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase())
      return entry ? String(entry[1] || '') : ''
    }
    const email    = getCsvField(row, 'email')
    const achatStr = getCsvField(row, 'achat')
    const etat     = getCsvField(row, 'etat')
    const dateStr  = getCsvField(row, 'date')

    try {
      // 1. Résoudre client
      const customerEntry = registry.get('customers', email)
      if (!customerEntry?.id) throw new Error(`Client "${email}" non trouvé dans le registre`)
      const idCustomer = customerEntry.id

      // 2. Résoudre adresse (registre d'abord, fallback PS)
      let idAddress = null
      const addrEntry = registry.get('addresses', email)
      if (addrEntry?.id) {
        idAddress = addrEntry.id
        console.log('[Import] Adresse commande', email, '→ registre #', idAddress)
      } else {
        console.warn('[Import] ⚠ Adresse commande', email, '→ PAS dans registre, fallback PS')
        try {
          const addrResp = await axiosInstance.get(
            `/addresses?display=full&filter[id_customer]=[${idCustomer}]`
          )
          idAddress = extractFieldFromResponse(addrResp.data, 'address id')
          console.warn('[Import] Fallback adresse trouvée:', idAddress, '(peut avoir pays inactif!)')
        } catch { /* idAddress reste null → erreur levée ci-dessous */ }
      }
      if (!idAddress) throw new Error(`Adresse introuvable pour "${email}"`)

      // 3. Parser les articles
      const items = parseAchat(achatStr)
      if (items.length === 0) throw new Error('Aucun article dans la commande')

      // 4. Résoudre produits et combinaisons depuis le registre
      const resolvedMap = new Map()
      for (const item of items) {
        const productEntry = registry.get('products', item.reference)
        if (!productEntry?.id) throw new Error(`Produit "${item.reference}" non trouvé dans le registre`)
        let idCombination = '0'
        if (item.variant) {
          const combEntry = registry.get('combinations', `${item.reference}|${item.variant}`)
          if (combEntry?.id) idCombination = combEntry.id
        }
        const key = `${productEntry.id}|${idCombination}`
        if (resolvedMap.has(key)) {
          resolvedMap.get(key).quantity += item.quantity
        } else {
          resolvedMap.set(key, { ...item, idProduct: productEntry.id, idCombination })
        }
      }
      const resolvedItems = [...resolvedMap.values()]

      // 5. Convertir la date CSV (JJ/MM/AAAA → AAAA-MM-JJ HH:MM:SS)
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      let dateAdd = now
      if (dateStr) {
        const parts = String(dateStr).split('/')
        if (parts.length === 3) dateAdd = `${parts[2]}-${parts[1]}-${parts[0]} 00:00:00`
      }

      // 6. Créer le panier
      const cartXml = buildImportCartXml(idCustomer, idAddress, defaultCarrierId, defaultCurrencyId, dateAdd)
      const cartRaw = await postXml('carts', cartXml)
      const cartParsed = parseXML(cartRaw)
      const cartId = getVal(cartParsed?.prestashop?.cart?.id) || ''
      if (!cartId || cartId === '0') throw new Error('ID panier non récupéré')

      // PS ne retourne pas secure_key dans la réponse POST → GET display=full pour l'obtenir
      const cartFullResp = await axiosInstance.get(`/carts/${cartId}?display=full`)
      const cartFullParsed = parseXML(cartFullResp.data)
      const cartSecureKey = getVal(cartFullParsed?.prestashop?.cart?.secure_key) || ''
      console.log('[Import] Cart', cartId, '— secure_key :', cartSecureKey ? '✓' : '⚠ toujours vide')

      // 7. Peupler le panier avec les lignes
      const cartRowsXml = resolvedItems.map(item =>
        `        <cart_row>
          <id_product>${item.idProduct}</id_product>
          <id_product_attribute>${item.idCombination}</id_product_attribute>
          <id_address_delivery>${idAddress}</id_address_delivery>
          <id_customization>0</id_customization>
          <quantity>${item.quantity}</quantity>
        </cart_row>`
      ).join('\n')

      const cartUpdateXml = buildImportCartUpdateXml(
        cartId, idCustomer, idAddress, defaultCarrierId, defaultCurrencyId, cartSecureKey, cartRowsXml, dateAdd
      )
      await putXml('carts', cartId, cartUpdateXml)

      // 8. Créer TOUJOURS la commande PS depuis le cart
      // → etat vide : order créé, état laissé à l'état initial PS (visible dans PS BO Commandes)
      // → etat non-vide : order créé + état changé (paiement accepté, annulé…)
      const stateId = mapEtatToStateId(etat)

      const orderXml = buildImportOrderXml(
        idCustomer, idAddress, cartId, defaultCarrierId, defaultCurrencyId, cartSecureKey, dateAdd
      )
      let orderId = ''
      try {
        const orderRaw = await postXml('orders', orderXml)
        const orderParsed = parseXML(orderRaw)
        const raw = orderParsed?.prestashop?.order?.id
        orderId = raw && typeof raw === 'object' ? String(raw['#text'] || '') : String(raw || '')
      } catch (err) {
        // Toute erreur 500 sur POST /orders peut masquer une commande déjà committée
        // (module gamification, hooks tiers, body vide…). On tente la récupération via id_cart.
        if (err.response?.status === 500) {
          console.warn('[Import] Erreur 500 POST /orders (hook PS), récupération via cart', cartId)
          try {
            const findResp = await axiosInstance.get(`/orders?display=full&filter[id_cart]=[${cartId}]`)
            const findParsed = parseXML(findResp.data)
            const rawOrders = findParsed?.prestashop?.orders?.order
            const found = rawOrders ? (Array.isArray(rawOrders) ? rawOrders[0] : rawOrders) : null
            orderId = found ? getVal(found.id) : ''
            if (orderId) console.log('[Import] Commande #' + orderId + ' récupérée malgré erreur 500')
          } catch { /* orderId reste vide → erreur levée ci-dessous */ }
        } else {
          console.error('Order creation error (import):', String(err.response?.data || err.message))
          throw err
        }
      }
      if (!orderId || orderId === '0') {
        throw new Error('ID commande non récupéré depuis PrestaShop')
      }

      await sleep(600)

      // PS ne met à jour date_add via PUT que pour les états "payés" (logable=1 / paid=1, ex: état 2).
      // Pour l'état "Dans le panier" (paid=0), PS ignore date_add dans le PUT → date reste NOW.
      // Solution : passer d'abord par l'état 2 avec dateAdd (PS applique la date),
      // puis basculer vers "Dans le panier" sans dateAdd (PS ne réécrit pas date_add déjà en base).
      if (stateId === null && dansPanierStateId) {
        // Étape A : état 2 + dateAdd → PS met à jour date_add pour les états payés
        if (dateStr) {
          try {
            await updateOrderState(orderId, '2', { dateAdd })
            await sleep(400)
          } catch (e) {
            console.warn(`Import: étape date via état 2 échouée pour #${orderId}:`, e.message)
          }
        }
        // Étape B : état final "Dans le panier" sans dateAdd — PS ne réécrit pas date_add
        try {
          await updateOrderState(orderId, dansPanierStateId)
        } catch (e) {
          console.warn(`Import: état "Dans le panier" non appliqué pour #${orderId}:`, e.message)
        }
      } else {
        // Paiement accepté, annulé… : transition directe avec dateAdd (PS l'applique pour ces états)
        const targetStateId = stateId !== null ? stateId : dansPanierStateId
        if (targetStateId) {
          try {
            await updateOrderState(orderId, targetStateId, { dateAdd })
          } catch (stateErr) {
            console.warn(`Import: état ${targetStateId} non appliqué pour commande #${orderId}:`, stateErr.message)
          }
        }
        // Filet de sécurité sur la date pour paiement accepté / annulé
        if (dateStr) {
          try {
            await updateOrderDateAdd(orderId, dateAdd)
          } catch (dateErr) {
            console.warn(`Import: date_add non corrigée pour commande #${orderId}:`, dateErr.message)
          }
        }
      }

      // PS validateOrder() décrémente le stock à la création de tout ordre.
      // - Livré   : on conserve le décréement (livraison effective)
      // - Annulé  : PS restaure automatiquement le stock lors du changement d'état → on ne touche pas
      // - Autres  : on annule le décréement PS (stock ne baisse qu'à la livraison)
      const shouldReIncrement = stateId !== ORDER_STATES.DELIVERED
                             && stateId !== ORDER_STATES.CANCELLED
      if (shouldReIncrement) {
        await reIncrementStockForOrderItems(resolvedItems)
      }
      // Pour les livrés : PS a déjà décrémenté via validateOrder() → on trace la sortie dans stock_mvt
      if (stateId === ORDER_STATES.DELIVERED) {
        await recordStockExitForItems(resolvedItems, dateAdd)
      }

      results.success++
    } catch (err) {
      // Montrer le corps de réponse PS si disponible (plus utile que le message axios générique)
      const psBody = err.response?.data
      const msg = psBody
        ? (typeof psBody === 'string' ? psBody.slice(0, 500) : JSON.stringify(psBody).slice(0, 500))
        : err.message
      results.errors.push({ line: i + 2, message: msg, row })
    }
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}

// ─── Import IMAGES (ZIP) ──────────────────────────────────────────────────────
// Nom du fichier dans le ZIP = référence produit (ex: T_01.jpg)
// Upload vers POST /images/products/{idProduct}

const importImages = async (zipFile, registry, onProgress) => {
  const results = { success: 0, errors: [] }
  try {
    const zip = await JSZip.loadAsync(zipFile)
    const imageFiles = Object.values(zip.files).filter(f => {
      const name = f.name.split('/').pop()
      return !f.dir &&
        /\.(jpe?g|png|gif|webp)$/i.test(name) &&
        !name.startsWith('._') &&   // fichiers de métadonnées macOS
        !name.startsWith('__MACOSX') // dossier macOS
    })
    const total = imageFiles.length
    if (total === 0) return results

    for (let i = 0; i < total; i++) {
      const zipEntry = imageFiles[i]
      const filename = zipEntry.name.split('/').pop()
      const reference = filename.replace(/\.[^.]+$/, '')

      const productEntry = registry.get('products', reference)
      if (!productEntry?.id) {
        results.errors.push({
          line: i + 1,
          message: `Produit "${reference}" introuvable dans le registre`,
          row: { filename },
        })
        onProgress?.(Math.round(((i + 1) / total) * 100), results)
        continue
      }

      try {
        const blob = await zipEntry.async('blob')
        const formData = new FormData()
        formData.append('image', blob, filename)
        await axiosInstance.post(`/images/products/${productEntry.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        results.success++
      } catch (err) {
        results.errors.push({
          line: i + 1,
          message: err.response?.data || err.message,
          row: { filename },
        })
      }
      onProgress?.(Math.round(((i + 1) / total) * 100), results)
    }
  } catch (err) {
    results.errors.push({ line: 0, message: `Erreur ZIP : ${err.message}`, row: {} })
  }
  return results
}

// ─── Routeur principal par module ─────────────────────────────────────────────

const MODULE_IMPORTERS = {
  taxes:        importTaxRows,
  categories:   importCategoryRows,
  products:     importProductRows,
  combinations: importCombinationRows,
  stock:        importStockRows,
  customers:    importCustomerRows,
  orders:       importOrderRows,
}

export const importModuleRows = async (rows, moduleKey, mapping, registry, onProgress) => {
  const importer = MODULE_IMPORTERS[moduleKey]
  if (!importer) return importGenericRows(rows, moduleKey, mapping, registry, onProgress)
  return importer(rows, mapping, registry, onProgress)
}

const importGenericRows = async (rows, moduleKey, mapping, registry, onProgress) => {
  const config = MODULES_CONFIG[moduleKey]
  const total = rows.length
  const results = { success: 0, errors: [], skipped: 0 }
  for (let i = 0; i < total; i++) {
    const row = rows[i]
    try {
      const xml = buildXmlFromMapping(row, moduleKey, mapping, registry)
      await postXml(config.apiEndpoint, xml)
      results.success++
    } catch (err) {
      results.errors.push({ line: i + 2, message: err.response?.data || err.message, row })
    }
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < total) await sleep(BATCH_DELAY_MS)
    onProgress?.(Math.round(((i + 1) / total) * 100), results)
  }
  return results
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Lance l'import multi-fichiers avec un registre partagé.
 * csvPlan : [{ moduleKey, rows, mapping }] — tous les modules CSV de tous les fichiers
 * zipFile : File (ZIP d'images) ou null
 */
export const importMultiModule = async (csvPlan, zipFile, onModuleProgress, onModuleDone) => {
  const registry = new ImportRegistry()
  const globalReport = {}

  // Trier tous les modules CSV par importOrder global
  const sorted = [...csvPlan].sort(
    (a, b) => (MODULES_CONFIG[a.moduleKey]?.importOrder ?? 99) - (MODULES_CONFIG[b.moduleKey]?.importOrder ?? 99)
  )

  for (const { moduleKey, rows, mapping } of sorted) {

    const results = await importModuleRows(
      rows, moduleKey, mapping, registry,
      (pct, partial) => onModuleProgress?.(moduleKey, pct, partial)
    )
    globalReport[moduleKey] = results
    onModuleDone?.(moduleKey, results)
  }

  // Images en dernier (produits déjà dans le registre)
  if (zipFile) {
    const imageResults = await importImages(
      zipFile, registry,
      (pct, partial) => onModuleProgress?.('images', pct, partial)
    )
    globalReport['images'] = imageResults
    onModuleDone?.('images', imageResults)
  }

  return globalReport
}
