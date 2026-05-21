import { useState, useEffect } from 'react'
import axiosInstance from '../api/axiosInstance'
import { parseXML } from '../api/xmlParser'
import { getStockMovements } from '../api/services/stockMovementService'

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
 * Hook qui récupère les mouvements de stock filtrés pour UN produit/déclinaison.
 * Enrichit avec : nom produit, déclinaison, raison du mouvement, type (entrée/sortie).
 *
 * @param {string|number} productId - id du produit ciblé
 * @param {string|number|null} combinationId - id déclinaison (null ou 0 si produit simple)
 */
const useStockMovements = (productId, combinationId = 0) => {
  const [movements, setMovements] = useState([])
  const [productInfo, setProductInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEnriched = async () => {
      try {
        setLoading(true)
        setError(null)

        // Mouvements : WS PS /stock_movements filtrés par id_stock (= id_stock_available)
        // Enrichissements : WS PS pour noms produit, raisons, références déclinaisons
        const [rawMovements, productsData, reasonsData, combinationsData] = await Promise.all([
          getStockMovements(productId, combinationId),
          fetchAll('products'),
          fetchAll('stock_movement_reasons'),
          fetchAll('combinations'),
        ])

        const rawProducts     = toArray(productsData?.prestashop?.products?.product)
        const rawReasons      = toArray(reasonsData?.prestashop?.stock_movement_reasons?.stock_movement_reason)
        const rawCombinations = toArray(combinationsData?.prestashop?.combinations?.combination)

        // Map produits
        const productMap = {}
        rawProducts.forEach((p) => {
          const id = String(getVal(p.id))
          productMap[id] = {
            name: p.name?.language?.['#text'] || p.name?.language || '—',
            reference: getVal(p.reference) || '—',
          }
        })

        // Map raisons mouvement : id → nom
        const reasonMap = {}
        rawReasons.forEach((r) => {
          const id = String(getVal(r.id))
          reasonMap[id] = {
            name: r.name?.language?.['#text'] || r.name?.language || '—',
            sign: parseInt(getVal(r.sign) || 0), // 1 = entrée, -1 = sortie
          }
        })

        // Map déclinaisons : id → référence
        const combinationMap = {}
        rawCombinations.forEach((c) => {
          const id = String(getVal(c.id))
          combinationMap[id] = getVal(c.reference) || `Décl. #${id}`
        })

        // Info produit ciblé
        const targetProduct = productMap[String(productId)]
        if (targetProduct) {
          setProductInfo({
            id: String(productId),
            name: targetProduct.name,
            reference: targetProduct.reference,
            combinationId: combinationId ? String(combinationId) : null,
            combinationRef: combinationId && combinationId !== '0'
              ? combinationMap[String(combinationId)] || null
              : null,
          })
        }

        // Les mouvements sont déjà filtrés par id_stock côté WS PS — pas de post-filtre nécessaire.
        // id_product / id_product_attribute sont nuls dans le résultat WS (join ps_stock absent),
        // on utilise les params productId / combinationId directement.
        const enriched = rawMovements.map((m) => {
          const id           = String(getVal(m.id))
          const reasonId     = String(getVal(m.id_stock_mvt_reason))
          const reason       = reasonMap[reasonId] || { name: '—', sign: 0 }
          const physicalQty  = parseInt(getVal(m.physical_quantity) || 0)
          const sign         = parseInt(getVal(m.sign) || reason.sign || 0)
          const dateAdd      = getVal(m.date_add) || ''

          // delta signé : entrée positive, sortie négative
          const delta = sign >= 0 ? physicalQty : -physicalQty
          const isEntry = delta >= 0

          return {
            id,
            productId:     String(productId),
            combinationId: String(combinationId || 0),
            dateAdd,
            quantity:      Math.abs(delta),
            delta,
            isEntry,
            reasonName:    reason.name,
            employeeId:    getVal(m.id_employee) || null,
            raw: m,
          }
        })

        // Tri date décroissante
        enriched.sort((a, b) => (b.dateAdd || '').localeCompare(a.dateAdd || ''))

        setMovements(enriched)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (productId) {
      fetchEnriched()
    }
  }, [productId, combinationId])

  return { movements, productInfo, loading, error }
}

export default useStockMovements