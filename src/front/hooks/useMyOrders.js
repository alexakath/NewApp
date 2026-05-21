import { useState, useEffect } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { parseXML } from '../../api/xmlParser'

const getVal = (field) => {
  if (field === null || field === undefined) return null
  if (typeof field === 'object' && field['#text'] !== undefined) return field['#text']
  return field
}

const toArray = (data) => {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

const IN_CART_COLOR = '#d97706'

const useMyOrders = (customerId) => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [ordersRes, cartsRes, statesRes, currenciesRes, productsRes, taxesRes, taxRulesRes] = await Promise.all([
          axiosInstance.get(`/orders?display=full&filter[id_customer]=[${customerId}]`),
          axiosInstance.get(`/carts?display=full&filter[id_customer]=[${customerId}]`),
          axiosInstance.get('/order_states?display=full'),
          axiosInstance.get('/currencies?display=full'),
          axiosInstance.get('/products?display=full'),
          axiosInstance.get('/taxes?display=full'),
          axiosInstance.get('/tax_rules?display=full'),
        ])

        const rawOrders      = toArray(parseXML(ordersRes.data)?.prestashop?.orders?.order)
        const rawCarts       = toArray(parseXML(cartsRes.data)?.prestashop?.carts?.cart)
        const rawOrderStates = toArray(parseXML(statesRes.data)?.prestashop?.order_states?.order_state)
        const rawCurrencies  = toArray(parseXML(currenciesRes.data)?.prestashop?.currencies?.currency)
        const rawProducts    = toArray(parseXML(productsRes.data)?.prestashop?.products?.product)
        const rawTaxes       = toArray(parseXML(taxesRes.data)?.prestashop?.taxes?.tax)
        const rawTaxRules    = toArray(parseXML(taxRulesRes.data)?.prestashop?.tax_rules?.tax_rule)

        // Map taux de taxe réels
        const taxRateById = {}
        rawTaxes.forEach((t) => {
          taxRateById[String(getVal(t.id))] = parseFloat(String(getVal(t.rate) || '0').replace(',', '.'))
        })
        const taxRateByGroup = {}
        rawTaxRules.forEach((r) => {
          const groupId = String(getVal(r.id_tax_rules_group))
          const taxId   = String(getVal(r.id_tax))
          if (!taxRateByGroup[groupId] && taxRateById[taxId] !== undefined) {
            taxRateByGroup[groupId] = taxRateById[taxId]
          }
        })

        // Map état : id → { name, color }
        const stateMap = {}
        rawOrderStates.forEach((s) => {
          const id = String(getVal(s.id))
          const lang = s.name?.language
          const stateName = typeof lang === 'string'
            ? lang
            : (lang?.['#text'] != null ? String(lang['#text']) : null)
              ?? (Array.isArray(lang) && lang[0]?.['#text'] != null ? String(lang[0]['#text']) : null)
              ?? '—'
          stateMap[id] = {
            name:  stateName || '—',
            color: getVal(s.color) || '#64748b',
          }
        })

        // Map devise : id → iso_code
        const currencyMap = {}
        rawCurrencies.forEach((c) => {
          const id = String(getVal(c.id))
          currencyMap[id] = getVal(c.iso_code) || '—'
        })

        // Map prix produit : id → priceTTC avec taux réel par produit
        const productPriceMap = {}
        rawProducts.forEach((p) => {
          const id      = String(getVal(p.id))
          const priceHT = parseFloat(getVal(p.price) || 0)
          const groupId = String(getVal(p.id_tax_rules_group))
          const taxRate = taxRateByGroup[groupId] || 0
          productPriceMap[id] = priceHT * (1 + taxRate / 100)
        })

        // Enrichir les commandes
        const enrichedOrders = rawOrders.map((order) => {
          const id         = String(getVal(order.id))
          const stateId    = String(getVal(order.current_state))
          const currencyId = String(getVal(order.id_currency))
          const totalTTC   = parseFloat(getVal(order.total_paid_tax_incl) || 0)

          return {
            id,
            type: 'order',
            reference:  getVal(order.reference) || '—',
            state:      stateMap[stateId]?.name  || '—',
            stateColor: stateMap[stateId]?.color || '#64748b',
            stateId,
            totalTTC:   totalTTC.toFixed(2),
            currency:   currencyMap[currencyId] || '—',
            dateAdd:    getVal(order.date_add)?.split(' ')[0] || '—',
          }
        })

        // Carts déjà convertis en commande → exclus
        const cartIdsWithOrders = new Set(rawOrders.map((o) => String(getVal(o.id_cart))))

        // Si le cart PS stocké localement a été converti (BO valide) ou supprimé (BO annule),
        // on vide le panier local pour que le FO reflète la réalité PS.
        try {
          const storedRaw = localStorage.getItem(`ps_cart_${customerId}`)
          const stored = storedRaw ? JSON.parse(storedRaw) : null
          if (stored?.cartId) {
            const cartId = String(stored.cartId)
            const allCartIds = new Set(rawCarts.map((c) => String(getVal(c.id))))
            const converted = cartIdsWithOrders.has(cartId)
            const deleted   = !allCartIds.has(cartId)
            if (converted || deleted) {
              localStorage.removeItem(`ps_cart_${customerId}`)
              localStorage.removeItem(`front_cart_${customerId}`)
              window.dispatchEvent(new Event('storage'))
            }
          }
        } catch { /* ignore localStorage errors */ }

        // Enrichir les paniers actifs
        const enrichedCarts = rawCarts
          .filter((cart) => {
            const cartId = String(getVal(cart.id))
            if (cartIdsWithOrders.has(cartId)) return false
            const rows = toArray(cart?.associations?.cart_rows?.cart_row)
            return rows.length > 0
          })
          .map((cart) => {
            const cartId     = String(getVal(cart.id))
            const currencyId = String(getVal(cart.id_currency))
            const rows       = toArray(cart?.associations?.cart_rows?.cart_row)

            let totalTTC = 0
            rows.forEach((row) => {
              const productId = String(getVal(row.id_product))
              const qty = parseInt(getVal(row.quantity) || 0, 10)
              const priceTTC = productPriceMap[productId] || 0
              if (qty > 0) totalTTC += priceTTC * qty
            })

            return {
              id:         `cart-${cartId}`,
              type:       'cart',
              reference:  '—',
              state:      'Dans le panier',
              stateColor: IN_CART_COLOR,
              stateId:    'cart',
              totalTTC:   totalTTC.toFixed(2),
              currency:   currencyMap[currencyId] || '—',
              dateAdd:    getVal(cart.date_add)?.split(' ')[0] || '—',
            }
          })

        const allItems = [...enrichedCarts, ...enrichedOrders].sort((a, b) => {
          const da = a.dateAdd === '—' ? '' : a.dateAdd
          const db = b.dateAdd === '—' ? '' : b.dateAdd
          return db.localeCompare(da)
        })

        setOrders(allItems)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [customerId])

  return { orders, loading, error }
}

export default useMyOrders
