// src/api/utils/detectModules.js

import { MODULES_CONFIG, MODULE_KEYS } from './modulesConfig'

const normalize = (str) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '')

const scoreModule = (moduleKey, headers) => {
  const config = MODULES_CONFIG[moduleKey]
  if (!config?.detectionSignatures) return { score: 0, mapping: {} }

  const mapping = {}
  let score = 0

  for (const header of headers) {
    const norm = normalize(header)
    const sig = config.detectionSignatures[norm]
    if (sig) {
      score += sig.weight
      mapping[header] = sig.xml
    }
  }

  return { score, mapping }
}

export const detectModulesFromHeaders = (headers) => {
  const results = []

  for (const moduleKey of MODULE_KEYS) {
    const config = MODULES_CONFIG[moduleKey]
    if (!config?.detectionSignatures) continue

    const { score, mapping } = scoreModule(moduleKey, headers)
    const threshold = config.detectionThreshold ?? 2

    results.push({
      moduleKey,
      label: config.label,
      score,
      detected: score >= threshold,
      confidence: score === 0 ? 'none'
        : score >= threshold * 2 ? 'high'
        : score >= threshold ? 'medium'
        : 'low',
      mapping,
      importOrder: config.importOrder ?? 99,
    })
  }

  return results.sort((a, b) => {
    if (a.detected && !b.detected) return -1
    if (!a.detected && b.detected) return 1
    if (a.detected && b.detected) return a.importOrder - b.importOrder
    return b.score - a.score
  })
}

export const getDetectedModules = (headers) => {
  return detectModulesFromHeaders(headers)
    .filter(r => r.detected)
    .sort((a, b) => a.importOrder - b.importOrder)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const escapeXml = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const parseTaxRate = (str) => {
  if (!str) return null
  const clean = String(str).replace(',', '.').replace('%', '').trim()
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

const parsePrice = (str) => {
  if (!str) return null
  const clean = String(str).replace(',', '.').trim()
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

const slugify = (str) => {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Registre global d'IDs ────────────────────────────────────────────────────
// Structure : { moduleKey: { lookupKey: { id, ...extra } } }
// ex: { taxes: { "11.65": { id: "3", taxRulesGroupId: "5" } } }
//     { categories: { "Akanjo": { id: "25" } } }
//     { products: { "T_01": { id: "12", stockAvailableId: "8" } } }

export class ImportRegistry {
  constructor() {
    this._store = {}
  }

  set(moduleKey, lookupKey, data) {
    if (!this._store[moduleKey]) this._store[moduleKey] = {}
    this._store[moduleKey][String(lookupKey).trim()] = data
  }

  get(moduleKey, lookupKey) {
    return this._store[moduleKey]?.[String(lookupKey).trim()] || null
  }

  has(moduleKey, lookupKey) {
    return !!this.get(moduleKey, lookupKey)
  }
}

// ─── Complétions par module ────────────────────────────────────────────────────

const completeForTaxes = (row, mapping) => {
  const extra = {}
  const rateKey = Object.keys(mapping).find(k => mapping[k] === 'rate')
  const rawRate = rateKey ? row[rateKey] : null
  const rate = parseTaxRate(rawRate)
  if (rate !== null) {
    extra.name = `TVA ${rate}%`
    extra.rate = String(rate)
  }
  extra.active = '1'
  return extra
}

const completeForCategories = (row, mapping) => {
  const extra = {}
  const nameKey = Object.keys(mapping).find(k => mapping[k] === 'name')
  const rawName = nameKey ? row[nameKey] : null
  if (rawName) {
    extra.link_rewrite = slugify(rawName)
  }
  extra.active = '1'
  extra.id_parent = '2'
  return extra
}

const completeForProducts = (row, mapping, registry) => {
  const extra = {}

  // link_rewrite depuis name
  const nameKey = Object.keys(mapping).find(k => mapping[k] === 'name')
  const rawName = nameKey ? row[nameKey] : null
  if (rawName) {
    extra.link_rewrite = slugify(rawName)
  }

  // Prix HT calculé depuis TTC + taux
  const priceKey = Object.keys(mapping).find(k => mapping[k] === 'price')
  const rawPrice = priceKey ? row[priceKey] : null
  const taxKey = Object.keys(row).find(k => {
    const n = normalize(k)
    return n === 'taxe' || n === 'tax' || n === 'tva' || n === 'taux'
  })
  const rawTax = taxKey ? row[taxKey] : null
  const rate = parseTaxRate(rawTax)
  const priceTTC = parsePrice(rawPrice)
  if (priceTTC !== null && rate !== null) {
    extra.price = (priceTTC / (1 + rate / 100)).toFixed(6)
  } else if (priceTTC !== null) {
    extra.price = priceTTC.toFixed(6)
  }

  // Prix achat
  const wholesaleKey = Object.keys(mapping).find(k => mapping[k] === 'wholesale_price')
  const rawWholesale = wholesaleKey ? row[wholesaleKey] : null
  const wholesale = parsePrice(rawWholesale)
  if (wholesale !== null) {
    extra.wholesale_price = wholesale.toFixed(6)
  }

  // id_tax_rules_group depuis le registre taxes
  if (registry && rawTax) {
    const taxLookup = String(rawTax).replace(',', '.').replace('%', '').trim()
    const taxEntry = registry.get('taxes', taxLookup)
    if (taxEntry?.taxRulesGroupId) {
      extra.id_tax_rules_group = taxEntry.taxRulesGroupId
    }
  }

  // id_category_default depuis le registre categories
  const catKey = Object.keys(row).find(k => {
    const n = normalize(k)
    return n === 'categorie' || n === 'category' || n === 'cat'
  })
  const rawCat = catKey ? row[catKey] : null
  if (registry && rawCat) {
    const catEntry = registry.get('categories', rawCat.trim())
    if (catEntry?.id) {
      extra.id_category_default = catEntry.id
    }
  }

  // date de disponibilité
  const dateKey = Object.keys(mapping).find(k => mapping[k] === 'available_date')
  const rawDate = dateKey ? row[dateKey] : null
  if (rawDate) {
    const parts = String(rawDate).split('/')
    if (parts.length === 3) {
      extra.available_date = `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }

  extra.state = '1'
  extra.active = '1'
  extra.available_for_order = '1'
  extra.show_price = '1'
  extra.condition = 'new'
  extra.minimal_quantity = '1'
  extra.visibility = 'both'
  extra.id_shop_default = '1'
  extra.advanced_stock_management = '0'

  return extra
}

// ─── Dispatch des complétions ──────────────────────────────────────────────────

const COMPLETIONS = {
  taxes:      (row, mapping) => completeForTaxes(row, mapping),
  categories: (row, mapping) => completeForCategories(row, mapping),
  products:   (row, mapping, registry) => completeForProducts(row, mapping, registry),
}

// ─── buildXmlFromMapping ───────────────────────────────────────────────────────
// registry est optionnel — utilisé uniquement pour products/combinations/stock/orders

export const buildXmlFromMapping = (row, moduleKey, mapping, registry = null) => {
  const config = MODULES_CONFIG[moduleKey]
  if (!config) throw new Error(`Module inconnu : ${moduleKey}`)

  const { xmlTag, multilingualFields = [] } = config

  const fields = {}
  for (const [csvHeader, xmlField] of Object.entries(mapping)) {
    const value = row[csvHeader]
    if (value === undefined || value === null || String(value).trim() === '') continue
    // On ne copie pas les champs bruts qui seront recalculés (price, wholesale_price)
    if (moduleKey === 'products' && (xmlField === 'price' || xmlField === 'wholesale_price')) continue
    fields[xmlField] = String(value).trim()
  }

  const completeFn = COMPLETIONS[moduleKey]
  if (completeFn) {
    const extra = completeFn(row, mapping, registry)
    for (const [xmlField, value] of Object.entries(extra)) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        fields[xmlField] = String(value).trim()
      }
    }
  }

  // Associations catégories pour les produits
  let associationsXml = ''
  if (moduleKey === 'products' && registry) {
    const catKey = Object.keys(row).find(k => {
      const n = normalize(k)
      return n === 'categorie' || n === 'category' || n === 'cat'
    })
    const rawCat = catKey ? row[catKey] : null
    if (rawCat) {
      const catEntry = registry.get('categories', rawCat.trim())
      if (catEntry?.id) {
        associationsXml = `
    <associations>
      <categories>
        <category><id>${escapeXml(catEntry.id)}</id></category>
      </categories>
    </associations>`
      }
    }
  }

  let xmlFields = ''
  for (const [xmlField, value] of Object.entries(fields)) {
    if (multilingualFields.includes(xmlField)) {
      xmlFields += `\n    <${xmlField}><language id="1"><![CDATA[${value}]]></language></${xmlField}>`
    } else {
      xmlFields += `\n    <${xmlField}>${escapeXml(value)}</${xmlField}>`
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <${xmlTag}>${xmlFields}${associationsXml}
  </${xmlTag}>
</prestashop>`
}

// ─── XML spécialisés (hors mapping CSV) ───────────────────────────────────────

export const buildTaxRulesGroupXml = (taxName) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax_rules_group>
    <name><![CDATA[${escapeXml(taxName)}]]></name>
    <active>1</active>
    <date_add>${new Date().toISOString().slice(0, 19).replace('T', ' ')}</date_add>
    <date_upd>${new Date().toISOString().slice(0, 19).replace('T', ' ')}</date_upd>
  </tax_rules_group>
</prestashop>`

export const buildTaxRuleXml = (idTaxRulesGroup, idTax) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax_rule>
    <id_tax_rules_group>${escapeXml(idTaxRulesGroup)}</id_tax_rules_group>
    <id_tax>${escapeXml(idTax)}</id_tax>
    <id_country>8</id_country>
    <id_state>0</id_state>
    <zipcode_from>0</zipcode_from>
    <zipcode_to>0</zipcode_to>
    <behavior>0</behavior>
    <description></description>
  </tax_rule>
</prestashop>`

// Combinaison : product_option + product_option_value + combination
export const buildProductOptionXml = (name) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option>
    <name><language id="1"><![CDATA[${escapeXml(name)}]]></language></name>
    <public_name><language id="1"><![CDATA[${escapeXml(name)}]]></language></public_name>
    <is_color_group>0</is_color_group>
    <group_type>select</group_type>
    <position>0</position>
  </product_option>
</prestashop>`

export const buildProductOptionValueXml = (name, idAttribute) => `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group>${escapeXml(idAttribute)}</id_attribute_group>
    <name><language id="1"><![CDATA[${escapeXml(name)}]]></language></name>
    <position>0</position>
  </product_option_value>
</prestashop>`

export const buildCombinationXml = (idProduct, idOptionValues, priceTTC, taxRate, reference) => {
  const priceImpact = (priceTTC && taxRate != null)
    ? (parsePrice(priceTTC) / (1 + taxRate / 100)).toFixed(6)
    : '0.000000'

  const optionValuesXml = idOptionValues.map(id =>
    `<product_option_value><id>${escapeXml(id)}</id></product_option_value>`
  ).join('\n        ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product>${escapeXml(idProduct)}</id_product>
    <reference>${escapeXml(reference || '')}</reference>
    <price>${priceImpact}</price>
    <minimal_quantity>1</minimal_quantity>
    <associations>
      <product_option_values>
        ${optionValuesXml}
      </product_option_values>
    </associations>
  </combination>
</prestashop>`
}

export const buildStockUpdateXml = (idStockAvailable, idProduct, quantity, idProductAttribute = '0') =>
  `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id>${escapeXml(idStockAvailable)}</id>
    <id_product>${escapeXml(idProduct)}</id_product>
    <id_product_attribute>${escapeXml(idProductAttribute)}</id_product_attribute>
    <id_shop>1</id_shop>
    <id_shop_group>0</id_shop_group>
    <quantity>${escapeXml(String(quantity))}</quantity>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>2</out_of_stock>
  </stock_available>
</prestashop>`