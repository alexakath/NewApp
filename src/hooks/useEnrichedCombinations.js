import { useState, useEffect } from 'react'
import axiosInstance from '../api/axiosInstance'
import { parseXML } from '../api/xmlParser'

export const getVal = (field) => {
  if (field === null || field === undefined) return null
  if (typeof field === 'object') {
    if (field['#text'] !== undefined) return field['#text']
    return null
  }
  return field
}

const toArray = (data) => {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

const fetchAll = async (endpoint, language = 1) => {
  const params = new URLSearchParams({ display: 'full', language })
  const response = await axiosInstance.get(`/${endpoint}?${params}`)
  return parseXML(response.data)
}

/**
 * Hook qui récupère les déclinaisons enrichies avec :
 * - Nom du produit parent
 * - Référence du produit parent
 * - Attributs (Taille: M, Couleur: Bleu...)
 * - Stock disponible pour cette déclinaison
 * - Impact sur le prix
 */
const useEnrichedCombinations = () => {
  const [combinations, setCombinations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEnriched = async () => {
      try {
        setLoading(true)
        setError(null)

        // Étape 1 : Requêtes en parallèle
        const [
          combinationsData,
          productsData,
          productOptionsData,
          productOptionValuesData,
          stockData,
        ] = await Promise.all([
          fetchAll('combinations'),
          fetchAll('products'),
          fetchAll('product_options'),
          fetchAll('product_option_values'),
          fetchAll('stock_availables'),
        ])

        // Étape 2 : Normalisation
        const rawCombinations        = toArray(combinationsData?.prestashop?.combinations?.combination)
        const rawProducts            = toArray(productsData?.prestashop?.products?.product)
        const rawOptions             = toArray(productOptionsData?.prestashop?.product_options?.product_option)
        const rawOptionValues        = toArray(productOptionValuesData?.prestashop?.product_option_values?.product_option_value)
        const rawStock               = toArray(stockData?.prestashop?.stock_availables?.stock_available)

        // Étape 3 : Maps

        // Map produit : id → { name, reference, price }
        const productMap = {}
        rawProducts.forEach((p) => {
          const id = String(getVal(p.id))
          productMap[id] = {
            name: p.name?.language?.['#text'] || p.name?.language || '—',
            reference: getVal(p.reference) || '—',
            price: parseFloat(getVal(p.price) || 0),
          }
        })

        // Map option (attribut) : id → nom (ex: "Taille", "Couleur")
        const optionMap = {}
        rawOptions.forEach((o) => {
          const id = String(getVal(o.id))
          optionMap[id] = o.name?.language?.['#text']
            || o.name?.language
            || '—'
        })

        // Map valeur option : id → { name, id_option }
        // ex: { id: "1", name: "M", id_option: "1" (Taille) }
        const optionValueMap = {}
        rawOptionValues.forEach((v) => {
          const id = String(getVal(v.id))
          optionValueMap[id] = {
            name: v.name?.language?.['#text']
              || v.name?.language
              || '—',
            optionId: String(getVal(v.id_attribute_group)),
          }
        })

        // Map stock par déclinaison : id_product_attribute → quantity
        const stockMap = {}
        rawStock.forEach((s) => {
          const attrId = String(getVal(s.id_product_attribute))
          if (attrId && attrId !== '0') {
            stockMap[attrId] = parseInt(getVal(s.quantity) || 0)
          }
        })

        // Étape 4 : Enrichissement
        const enriched = rawCombinations.map((combo) => {
          const id        = String(getVal(combo.id))
          const productId = String(getVal(combo.id_product))
          const product   = productMap[productId] || {
            name: `Produit #${productId}`,
            reference: '—',
            price: 0,
          }

          // Récupération des valeurs d'attributs liées à cette déclinaison
          // PrestaShop stocke les liaisons dans associations.product_option_values
          const linkedValues = toArray(
            combo.associations?.product_option_values?.product_option_value
          )

          // Construction du label attributs : "Taille: M / Couleur: Bleu"
          const attributeLabel = linkedValues
            .map((lv) => {
              const valueId = String(getVal(lv.id))
              const value = optionValueMap[valueId]
              if (!value) return null
              const optionName = optionMap[value.optionId] || '—'
              return `${optionName}: ${value.name}`
            })
            .filter(Boolean)
            .join(' / ') || '—'

          // Impact prix
          const priceImpact = parseFloat(getVal(combo.price) || 0)
          const finalPrice  = (product.price + priceImpact).toFixed(2)

          // Stock de cette déclinaison
          const quantity = stockMap[id] ?? 0

          return {
            id,
            productId,
            productName: product.name,
            productReference: product.reference,
            reference: getVal(combo.reference) || '—',
            ean13: getVal(combo.ean13) || '—',
            attributeLabel,
            priceImpact: priceImpact >= 0
              ? `+${priceImpact.toFixed(2)}`
              : priceImpact.toFixed(2),
            finalPrice,
            quantity,
            outOfStock: quantity <= 0,
            lowStock: quantity > 0 && quantity <= 5,
            raw: combo,
          }
        })

        // Trier par produit parent puis par attributs
        enriched.sort((a, b) => {
          if (a.productName !== b.productName)
            return a.productName.localeCompare(b.productName)
          return a.attributeLabel.localeCompare(b.attributeLabel)
        })

        setCombinations(enriched)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchEnriched()
  }, [])

  return { combinations, loading, error }
}

export default useEnrichedCombinations