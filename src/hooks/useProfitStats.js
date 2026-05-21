import { useMemo } from 'react'
import { ORDER_STATES } from '../api/services/ordersService'

const getVal = (field) => {
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

const useProfitStats = (orders, products, stock, combinations = []) => {
  return useMemo(() => {

    // ── Wholesale par combinationId ──
    const comboWholesaleMap = {}
    combinations.forEach(c => {
      const id = String(getVal(c.id))
      const wp = typeof c.wholesale_price === 'number'
        ? c.wholesale_price
        : parseFloat(c.wholesale_price?.['#text'] || c.wholesale_price || 0)
      if (wp > 0) comboWholesaleMap[id] = wp
    })

    // ── Wholesale + catégorie par productId ──
    const productWholesaleMap = {}
    products.forEach(p => {
      productWholesaleMap[String(p.id)] = {
        wholesale: parseFloat(p.wholesalePrice || 0),
        cat: p.categoryDefault || '—',
      }
    })

    // ── Résolution wholesale : combo en priorité, sinon produit ──
    const resolveWholesale = (productId, combinationId) => {
      if (combinationId && combinationId !== '0' && comboWholesaleMap[combinationId] !== undefined) {
        return comboWholesaleMap[combinationId]
      }
      return productWholesaleMap[String(productId)]?.wholesale || 0
    }

    // ── Livrés uniquement pour reconstituer stock initial ──
   const deliveredOnly = orders.filter(o => o.stateId === ORDER_STATES.DELIVERED)
const soldQtyMap = {}
deliveredOnly.forEach(order => {
  const rows = toArray(order.raw?.associations?.order_rows?.order_row)
  rows.forEach(row => {
    const pid    = String(getVal(row.product_id))
    const combId = String(getVal(row.product_attribute_id) || '0')
    const key    = `${pid}_${combId}`
    const qty    = parseFloat(getVal(row.product_quantity) || 0)
    soldQtyMap[key] = (soldQtyMap[key] || 0) + qty
  })
})

    // ── Achats HT global = SUM par ligne stock (physicalQty + livrés) × wholesale ──
   let achatsHT = 0
stock.forEach(s => {
  const pid    = String(s.productId)
  const combId = s.combinationId ? String(s.combinationId) : '0'
  const key    = `${pid}_${combId}`
  const wholesale  = resolveWholesale(pid, combId)
  const initialQty = (s.quantity || 0) + (soldQtyMap[key] || 0)
  achatsHT += initialQty * wholesale
})

    // ── Livré + PA pour ventes ──
    const delivered = orders.filter(o =>
      o.stateId === ORDER_STATES.DELIVERED || o.stateId === ORDER_STATES.PAYMENT_ACCEPTED
    )

    // ── Achats HT par catégorie = vendus (livré + PA) × wholesale ──
    const catAchatsMap = {}
    delivered.forEach(order => {
      const rows = toArray(order.raw?.associations?.order_rows?.order_row)
      rows.forEach(row => {
        const pid    = String(getVal(row.product_id))
        const combId = String(getVal(row.product_attribute_id) || '0')
        const qty    = parseFloat(getVal(row.product_quantity) || 0)
        const wholesale = resolveWholesale(pid, combId)
        const cat    = productWholesaleMap[pid]?.cat || '—'
        if (!catAchatsMap[cat]) catAchatsMap[cat] = 0
        catAchatsMap[cat] += qty * wholesale
      })
    })

    // ── Ventes HT ──
    const ventesHT = delivered.reduce((sum, o) => sum + parseFloat(o.totalHT || 0), 0)

    // ── Ventes HT par catégorie ──
    const productCatMap = {}
    products.forEach(p => {
      productCatMap[String(p.id)] = p.categoryDefault || '—'
    })

    const catVentesMap = {}
    delivered.forEach(order => {
      const rows = toArray(order.raw?.associations?.order_rows?.order_row)
      rows.forEach(row => {
        const pid         = String(getVal(row.product_id))
        const qty         = parseFloat(getVal(row.product_quantity) || 0)
        const unitPriceHT = parseFloat(getVal(row.unit_price_tax_excl) || 0)
        const cat         = productCatMap[pid] || '—'
        if (!catVentesMap[cat]) catVentesMap[cat] = 0
        catVentesMap[cat] += unitPriceHT * qty
      })
    })

    const benefice = ventesHT - achatsHT

    const allCats = new Set([...Object.keys(catVentesMap), ...Object.keys(catAchatsMap)])
    const byCategory = Array.from(allCats).map(cat => {
      const v = catVentesMap[cat] || 0
      const a = catAchatsMap[cat] || 0
      return { name: cat, ventesHT: v, achatsHT: a, benefice: v - a }
    }).sort((a, b) => b.ventesHT - a.ventesHT)

    return { ventesHT, achatsHT, benefice, byCategory }
  }, [orders, products, stock, combinations])
}

export default useProfitStats