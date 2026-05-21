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

const useEnrichedStock = () => {
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEnriched = async () => {
      try {
        setLoading(true)
        setError(null)

        const [stockData, productsData, combinationsData, ordersData, orderDetailsData] = await Promise.all([
          fetchAll('stock_availables'),
          fetchAll('products'),
          fetchAll('combinations'),
          fetchAll('orders'),
          fetchAll('order_details'),
        ])

        const rawStock        = toArray(stockData?.prestashop?.stock_availables?.stock_available)
        const rawProducts     = toArray(productsData?.prestashop?.products?.product)
        const rawCombinations = toArray(combinationsData?.prestashop?.combinations?.combination)
        const rawOrders       = toArray(ordersData?.prestashop?.orders?.order)
        const rawOrderDetails = toArray(orderDetailsData?.prestashop?.order_details?.order_detail)

        // Map produit : id → { name, reference }
        const productMap = {}
        rawProducts.forEach((p) => {
          const id = String(getVal(p.id))
          productMap[id] = {
            name: p.name?.language?.['#text'] || p.name?.language || '—',
            reference: getVal(p.reference) || '—',
          }
        })

        // Map déclinaison : id → référence
        const combinationMap = {}
        rawCombinations.forEach((c) => {
          const id = String(getVal(c.id))
          combinationMap[id] = getVal(c.reference) || null
        })

        // IDs des commandes avec état paiement accepté (stateId = '2')
        const paidOrderIds = new Set(
          rawOrders
            .filter(o => String(getVal(o.current_state)) === '2')
            .map(o => String(getVal(o.id)))
        )

        // Réservé par clé "productId_combinationId" (pour tableau principal par déclinaison)
        const reservedMap = {}
        rawOrderDetails.forEach(d => {
          const orderId = String(getVal(d.id_order))
          if (!paidOrderIds.has(orderId)) return
          const pid    = String(getVal(d.product_id))
          const combId = String(getVal(d.product_attribute_id) || '0')
          const qty    = parseInt(getVal(d.product_quantity) || 0)
          const key    = `${pid}_${combId}`
          reservedMap[key] = (reservedMap[key] || 0) + qty
        })

        // Réservé global par productId (toutes déclinaisons) pour physique/disponible catégorie
        const reservedByProduct = {}
        rawOrderDetails.forEach(d => {
          const orderId = String(getVal(d.id_order))
          if (!paidOrderIds.has(orderId)) return
          const pid = String(getVal(d.product_id))
          const qty = parseInt(getVal(d.product_quantity) || 0)
          reservedByProduct[pid] = (reservedByProduct[pid] || 0) + qty
        })

        // Map productId → quantité ligne attr=0 = stock physique total (maintenu par PrestaShop)
        const physicalByProduct = {}
        rawStock.forEach(s => {
          const combId = String(getVal(s.id_product_attribute) || '0')
          if (combId === '0') {
            const pid = String(getVal(s.id_product))
            physicalByProduct[pid] = parseInt(getVal(s.quantity) || 0)
          }
        })

        // Produits qui ont au moins une déclinaison
        const productsWithCombinations = new Set(
          rawStock
            .filter(s => {
              const c = String(getVal(s.id_product_attribute))
              return c && c !== '0'
            })
            .map(s => String(getVal(s.id_product)))
        )

        // Filtrer les lignes attr=0 pour produits avec déclinaisons (redondantes pour le tableau principal)
        const filteredStock = rawStock.filter(s => {
          const productId = String(getVal(s.id_product))
          const combId    = String(getVal(s.id_product_attribute))
          const isProductLevel = !combId || combId === '0'
          return !(isProductLevel && productsWithCombinations.has(productId))
        })

        // Enrichissement
        const enriched = filteredStock.map((s) => {
          const productId     = String(getVal(s.id_product))
          const combinationId = String(getVal(s.id_product_attribute))
          const quantity      = parseInt(getVal(s.quantity) || 0)

          const product = productMap[productId] || { name: `Produit #${productId}`, reference: '—' }

          const hasCombination = combinationId && combinationId !== '0'
          const combinationRef = hasCombination
            ? combinationMap[combinationId] || `Déclinaison #${combinationId}`
            : null

          // Réservé pour cette déclinaison précise (tableau principal)
          const key         = `${productId}_${hasCombination ? combinationId : '0'}`
          const reservedQty = reservedMap[key] || 0

          // physique = ligne attr=0 = total brut du produit (PrestaShop le maintient automatiquement)
          const physicalQty = physicalByProduct[productId] ?? quantity

          // disponible = physique - réservé total du produit (toutes déclinaisons)
          const totalReserved = reservedByProduct[productId] || 0
          const availableQty  = physicalQty - totalReserved

          const outOfStock = availableQty <= 0
          const lowStock   = availableQty > 0 && availableQty <= 5

          return {
            id: String(getVal(s.id)),
            productId,
            productName: product.name,
            productReference: product.reference,
            combinationId: hasCombination ? combinationId : null,
            combinationRef,
            quantity,        // stock par déclinaison — tableau principal
            availableQty,    // disponible = physique - réservé total — tableau catégorie
            reservedQty,     // réservé par déclinaison — tableau principal
            physicalQty,     // physique = ligne attr=0 — tableau catégorie
            outOfStock,
            lowStock,
            dependsOnStock: getVal(s.depends_on_stock),
            outOfStockAction: getVal(s.out_of_stock),
            raw: s,
          }
        })

        enriched.sort((a, b) => {
          if (a.outOfStock !== b.outOfStock) return a.outOfStock ? -1 : 1
          if (a.lowStock !== b.lowStock) return a.lowStock ? -1 : 1
          return a.productName.localeCompare(b.productName)
        })

        setStock(enriched)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchEnriched()
  }, [])

  return { stock, loading, error }
}

export default useEnrichedStock