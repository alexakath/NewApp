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

const useEnrichedCategories = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEnriched = async () => {
      try {
        setLoading(true)
        setError(null)

        const [categoriesData, productsData] = await Promise.all([
          fetchAll('categories'),
          fetchAll('products'),
        ])

        const rawCategories = toArray(categoriesData?.prestashop?.categories?.category)
        const rawProducts   = toArray(productsData?.prestashop?.products?.product)

        // Map catégorie : id → infos
        const categoryMap = {}
        rawCategories.forEach((cat) => {
          const id = String(getVal(cat.id))
          categoryMap[id] = {
            id,
            name: cat.name?.language?.['#text'] || cat.name?.language || '—',
            parentId: String(getVal(cat.id_parent)),
            level: parseInt(getVal(cat.level_depth) || 0),
            active: getVal(cat.active),
            description: cat.description?.language?.['#text']
              ? String(cat.description.language['#text'])
                  .replace(/<[^>]+>/g, '')
                  .slice(0, 60)
              : '—',
          }
        })

        // Comptage produits par catégorie
        // On utilise toutes les catégories associées au produit
        // pas seulement id_category_default
        const productCountMap = {}
        rawProducts.forEach((p) => {
          // Récupérer toutes les catégories du produit
          const linkedCats = toArray(
            p.associations?.categories?.category
          )

          if (linkedCats.length > 0) {
            linkedCats.forEach((c) => {
              const catId = String(getVal(c.id))
              productCountMap[catId] = (productCountMap[catId] || 0) + 1
            })
          } else {
            // Fallback sur id_category_default
            const catId = String(getVal(p.id_category_default))
            productCountMap[catId] = (productCountMap[catId] || 0) + 1
          }
        })

        // Déterminer les catégories racines de PrestaShop
        // id 1 = racine absolue (cachée)
        // id 2 = "Accueil" (première catégorie visible)
        // isParent = true si une autre catégorie a cette catégorie comme parent
        const parentIds = new Set(
          Object.values(categoryMap).map((c) => c.parentId)
        )

        // Enrichissement
        const enriched = rawCategories.map((cat) => {
          const id = String(getVal(cat.id))
          const info = categoryMap[id]
          const parentInfo = categoryMap[info.parentId] || null

          // Une catégorie est "parent visible" si :
          // - son parent direct est id 1 ou id 2 (racine PrestaShop)
          // - ET elle a des enfants
          const isTopLevel = info.parentId === '1' || info.parentId === '2'
          const hasChildren = parentIds.has(id)
          const isRoot = id === '1' || id === '2'

          return {
            ...info,
            parentName: isTopLevel || isRoot ? '—' : (parentInfo?.name || '—'),
            isTopLevel,
            hasChildren,
            isRoot,
            productCount: productCountMap[id] || 0,
          }
        })

        // Filtrer la catégorie racine id=1 (invisible dans PrestaShop)
        const filtered = enriched.filter((c) => c.id !== '1')

        // Trier : par niveau puis par nom
        filtered.sort((a, b) => {
          if (a.level !== b.level) return a.level - b.level
          return a.name.localeCompare(b.name)
        })

        setCategories(filtered)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchEnriched()
  }, [])

  return { categories, loading, error }
}

export default useEnrichedCategories