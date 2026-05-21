import { useState, useEffect } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { parseXML } from '../../api/xmlParser'

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

const fetchAll = async (endpoint) => {
  const params = new URLSearchParams({ display: 'full', language: 1 })
  const response = await axiosInstance.get(`/${endpoint}?${params}`)
  return parseXML(response.data)
}

const useProductDetail = (productId) => {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!productId) return

    const fetch = async () => {
      try {
        setLoading(true)
        setError(null)

        const [
          productData,
          stockData,
          combinationsData,
          optionsData,
          optionValuesData,
          taxesData,
          taxRulesData,
        ] = await Promise.all([
          axiosInstance.get(`/products/${productId}?language=1`).then(r => parseXML(r.data)),
          fetchAll('stock_availables'),
          fetchAll('combinations'),
          fetchAll('product_options'),
          fetchAll('product_option_values'),
          fetchAll('taxes'),
          fetchAll('tax_rules'),
        ])

        const raw = productData?.prestashop?.product
        if (!raw) throw new Error('Produit introuvable')

        // Map taux réels : tax_id → rate (%), group_id → rate
        const taxRateById = {}
        toArray(taxesData?.prestashop?.taxes?.tax).forEach(t => {
          taxRateById[String(getVal(t.id))] = parseFloat(String(getVal(t.rate) || '0').replace(',', '.'))
        })
        const taxRateByGroup = {}
        toArray(taxRulesData?.prestashop?.tax_rules?.tax_rule).forEach(r => {
          const gid = String(getVal(r.id_tax_rules_group))
          const tid = String(getVal(r.id_tax))
          if (!taxRateByGroup[gid] && taxRateById[tid] !== undefined) taxRateByGroup[gid] = taxRateById[tid]
        })

        const name = raw.name?.language?.['#text'] || raw.name?.language || '—'
        const description = raw.description?.language?.['#text'] || raw.description?.language || ''
        const priceHT   = parseFloat(getVal(raw.price) || 0)
        const groupId   = String(getVal(raw.id_tax_rules_group))
        const taxRate   = taxRateByGroup[groupId] || 0   // ex: 11.65
        const priceTTC  = (priceHT * (1 + taxRate / 100)).toFixed(2)
        const reference = getVal(raw.reference) || '—'

        // Détection pack via product_type ou cache_is_pack
        const productType = getVal(raw.product_type) || ''
        const isPack = productType === 'pack' || String(getVal(raw.cache_is_pack)) === '1'

        // Image principale
        const imageId = getVal(raw.id_default_image)
        const imageUrl = imageId
          ? `${import.meta.env.VITE_PRESTASHOP_URL}/api/images/products/${productId}/${imageId}`
          : null

        const allImageIds = toArray(raw.associations?.images?.image)
          .map(img => getVal(img.id))
          .filter(Boolean)
        const allImages = allImageIds.map(id =>
          `${import.meta.env.VITE_PRESTASHOP_URL}/api/images/products/${productId}/${id}`
        )

        // Stock simple
        const rawStock = toArray(stockData?.prestashop?.stock_availables?.stock_available)
        const stockEntry = rawStock.find(s =>
          String(getVal(s.id_product)) === String(productId) &&
          String(getVal(s.id_product_attribute)) === '0'
        )
        const quantity = stockEntry ? parseInt(getVal(stockEntry.quantity) || 0) : 0

        // ── Items du pack via /products?filter[type]=pack ──
        let packItems = []
        if (isPack) {
          try {
            // Récupérer les items du pack via l'endpoint dédié
            const packResponse = await axiosInstance.get(
              `/products?display=full&language=1&filter[id]=${productId}`
            )
            const packData = parseXML(packResponse.data)
            const packRaw = toArray(packData?.prestashop?.products?.product)[0]

            // Lire product_bundle depuis ce résultat
            const bundleItems = toArray(packRaw?.associations?.product_bundle?.product)

            if (bundleItems.length > 0 && getVal(bundleItems[0]?.id)) {
              // Récupérer chaque produit du bundle individuellement
              const bundleDetails = await Promise.all(
                bundleItems.map(async (item) => {
                  const pid = String(getVal(item.id))
                  const bundleQty = parseInt(getVal(item.quantity) || 1)
                  try {
                    const res = await axiosInstance.get(`/products/${pid}?language=1`)
                    const d = parseXML(res.data)
                    const p = d?.prestashop?.product
                    const pname = p?.name?.language?.['#text'] || p?.name?.language || `Produit #${pid}`
                    const imgId = getVal(p?.id_default_image)
                    const imgUrl = imgId
                      ? `${import.meta.env.VITE_PRESTASHOP_URL}/api/images/products/${pid}/${imgId}`
                      : null
                    return { id: pid, name: pname, quantity: bundleQty, imageUrl: imgUrl }
                  } catch {
                    return { id: pid, name: `Produit #${pid}`, quantity: bundleQty, imageUrl: null }
                  }
                })
              )
              packItems = bundleDetails.filter(i => i.id && i.id !== '0')
            }
          } catch (e) {
            console.warn('Impossible de charger les items du pack', e)
          }
        }

        // Déclinaisons
        const rawCombinations = toArray(combinationsData?.prestashop?.combinations?.combination)
          .filter(c => String(getVal(c.id_product)) === String(productId))

        const rawOptions = toArray(optionsData?.prestashop?.product_options?.product_option)
        const rawOptionValues = toArray(optionValuesData?.prestashop?.product_option_values?.product_option_value)

        const optionMap = {}
        rawOptions.forEach(o => {
          optionMap[String(getVal(o.id))] = o.name?.language?.['#text'] || o.name?.language || '—'
        })

        const optionValueMap = {}
        rawOptionValues.forEach(v => {
          optionValueMap[String(getVal(v.id))] = {
            name: v.name?.language?.['#text'] || v.name?.language || '—',
            optionId: String(getVal(v.id_attribute_group)),
          }
        })

        const stockByCombo = {}
        rawStock.forEach(s => {
          const attrId = String(getVal(s.id_product_attribute))
          if (attrId !== '0') stockByCombo[attrId] = parseInt(getVal(s.quantity) || 0)
        })

        const combinations = rawCombinations.map(combo => {
          const id = String(getVal(combo.id))
          const linkedValues = toArray(combo.associations?.product_option_values?.product_option_value)
          const attributeLabel = linkedValues.map(lv => {
            const valueId = String(getVal(lv.id))
            const value = optionValueMap[valueId]
            if (!value) return null
            return `${optionMap[value.optionId] || '—'}: ${value.name}`
          }).filter(Boolean).join(' / ') || '—'

          const priceImpact   = parseFloat(getVal(combo.price) || 0)
          const comboPriceTTC = ((priceHT + priceImpact) * (1 + taxRate / 100)).toFixed(2)
          const qty = stockByCombo[id] ?? 0

          return { id, attributeLabel, priceImpact, priceTTC: comboPriceTTC, quantity: qty }
        })

        setProduct({
          id: String(productId),
          name, description,
          priceHT: priceHT.toFixed(2), priceTTC,
          reference, imageUrl, allImages,
          quantity, active: getVal(raw.active),
          isPack, packItems,
          hasCombinations: combinations.length > 0,
          combinations,
          raw,
        })
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [productId])

  return { product, loading, error }
}

export default useProductDetail