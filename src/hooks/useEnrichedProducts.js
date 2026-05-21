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
  const parsed = parseXML(response.data)
  return parsed
}

const computeBadge = (availableDateStr) => {
  if (!availableDateStr || availableDateStr === '0000-00-00') return null
  const availableDate = new Date(availableDateStr)
  if (isNaN(availableDate.getTime())) return null
  const diffDays = Math.floor((new Date() - availableDate) / (1000 * 60 * 60 * 24))
  if (diffDays <= 1) return 'HOT'
  if (diffDays < 7) return 'NEW'
  return null
}

const useEnrichedProducts = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEnriched = async () => {
      try {
        setLoading(true)
        setError(null)

        const [
          productsData,
          categoriesData,
          stockData,
          taxesData,
          taxRulesData,
          manufacturersData,
        ] = await Promise.all([
          fetchAll('products'),
          fetchAll('categories'),
          fetchAll('stock_availables'),
          fetchAll('taxes'),
          fetchAll('tax_rules'),
          fetchAll('manufacturers'),
        ])

        const rawProducts      = toArray(productsData?.prestashop?.products?.product)
        const rawCategories    = toArray(categoriesData?.prestashop?.categories?.category)
        const rawStock         = toArray(stockData?.prestashop?.stock_availables?.stock_available)
        const rawTaxes         = toArray(taxesData?.prestashop?.taxes?.tax)
        const rawTaxRules      = toArray(taxRulesData?.prestashop?.tax_rules?.tax_rule)
        const rawManufacturers = toArray(manufacturersData?.prestashop?.manufacturers?.manufacturer)

        // Map taux réels : tax_id → rate (%), group_id → rate (%)
        const taxRateById = {}
        rawTaxes.forEach(t => {
          taxRateById[String(getVal(t.id))] = parseFloat(String(getVal(t.rate) || '0').replace(',', '.'))
        })
        const taxRateByGroup = {}
        rawTaxRules.forEach(r => {
          const gid = String(getVal(r.id_tax_rules_group))
          const tid = String(getVal(r.id_tax))
          if (!taxRateByGroup[gid] && taxRateById[tid] !== undefined) taxRateByGroup[gid] = taxRateById[tid]
        })

        const categoryMap = {}
        rawCategories.forEach((cat) => {
          const id = getVal(cat.id)
          categoryMap[id] = {
            id,
            name: cat.name?.language?.['#text'] || cat.name?.language || '—',
            parentId: getVal(cat.id_parent),
          }
        })

        const stockMap = {}
        rawStock.forEach((s) => {
          const productId = getVal(s.id_product)
          const attrId = getVal(s.id_product_attribute) || 0
          if (attrId == 0) {
            stockMap[productId] = getVal(s.quantity) ?? 0
          }
        })

        const taxMap = {}
        rawTaxRules.forEach((t) => {
          const id = getVal(t.id)
          taxMap[id] = t.name || '—'
        })

        const manufacturerMap = {}
        rawManufacturers.forEach((m) => {
          const id = getVal(m.id)
          manufacturerMap[id] = m.name || '—'
        })

        const enriched = rawProducts.map((product) => {
          const name = product.name?.language?.['#text']
            || product.name?.language
            || '—'

          const priceHT   = parseFloat(getVal(product.price) || 0)
          const groupId   = String(getVal(product.id_tax_rules_group))
          const taxRate   = (taxRateByGroup[groupId] || 0) / 100  // ex: 0.1165
          const priceTTC  = priceHT * (1 + taxRate)

          const defaultCatId = getVal(product.id_category_default)
          const defaultCategory = categoryMap[defaultCatId] || null
          const parentCategory = defaultCategory?.parentId
            ? categoryMap[defaultCategory.parentId] || null
            : null

          const productId = getVal(product.id)
          const quantity = stockMap[productId] ?? 0

          const manufacturerId = getVal(product.id_manufacturer)
          const manufacturer = manufacturerMap[manufacturerId] || '—'

          const imageId = getVal(product.id_default_image)
          const imageUrl = imageId
            ? `${import.meta.env.VITE_PRESTASHOP_URL}/api/images/products/${productId}/${imageId}`
            : null

          const reference = getVal(product.reference) || '—'
          // Correction: Lire directement la valeur si c'est un nombre, sinon utiliser getVal
          const wholesalePrice = typeof product.wholesale_price === 'number'
            ? product.wholesale_price
            : getVal(product.wholesale_price) || '0'

          const dateAddRaw = getVal(product.date_add)       // ← garder tel quel
          const badge = computeBadge(getVal(product.available_date))  // ← changer ici



          return {
            id: productId,
            name,
            reference,
            priceHT: priceHT.toFixed(2),
            priceTTC: priceTTC.toFixed(2),
            wholesalePrice: parseFloat(wholesalePrice).toFixed(2),
            quantity,
            active: getVal(product.active),
            manufacturer,
            categoryDefault: defaultCategory?.name || '—',
            categoryId: defaultCatId,
            categoryParent: parentCategory?.name || '—',
            imageUrl,
            badge,
            raw: product,
          }
        })

        setProducts(enriched)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    

    fetchEnriched()
  }, [])

  return { products, loading, error }
}

export default useEnrichedProducts