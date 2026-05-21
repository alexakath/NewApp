// src/api/services/resetService.js

import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'
import { MODULES_CONFIG, getResetOrder } from '../utils/modulesConfig'

/**
 * Cascade de dépendances pour la réinitialisation.
 * Quand un module est sélectionné, tous les modules listés ici sont AUSSI forcés.
 * Logique : si X référence Y en FK, supprimer Y nécessite supprimer X d'abord.
 *
 * Ex: "products" est sélectionné → "combinations" et "orders" sont forcés
 *     car ils contiennent des références FK vers les produits.
 */
export const RESET_CASCADE = {
  taxes:         ['products'],
  categories:    ['products'],
  manufacturers: ['products'],
  suppliers:     ['products'],
  products:      ['combinations', 'orders'],
  combinations:  ['orders'],
  customers:     ['orders'],
  orders:        [],
  stock:         [],
  warehouses:    [],
}

/**
 * Récupère le nombre d'éléments d'un endpoint
 * @param {string} endpoint 
 * @returns {Promise<number>}
 */
const getCount = async (endpoint) => {
  try {
    const response = await axiosInstance.get(`/${endpoint}?display=[id]`)
    const parsed = parseXML(response.data)
    
    const items = parsed?.prestashop?.[endpoint]?.[Object.keys(parsed.prestashop[endpoint])[0]] 
                 || parsed?.prestashop?.[endpoint]
    
    if (!items) return 0
    if (Array.isArray(items)) return items.length
    return 1
  } catch (err) {
    console.warn(`Impossible de compter ${endpoint}`, err)
    return 0
  }
}

/**
 * Supprime un élément par ID
 */
const deleteById = async (endpoint, id) => {
  if (!id) return
  try {
    await axiosInstance.delete(`/${endpoint}/${id}`)
    return true
  } catch (err) {
    console.error(`Erreur suppression ${endpoint}/${id}`, err)
    throw err
  }
}

/**
 * Récupère tous les IDs d'un endpoint
 */
const getAllIds = async (endpoint) => {
  try {
    const response = await axiosInstance.get(`/${endpoint}?display=[id]`)
    const parsed = parseXML(response.data)
    const items = parsed?.prestashop?.[endpoint]?.[Object.keys(parsed.prestashop[endpoint] || {})[0]] 
                 || []

    const array = Array.isArray(items) ? items : [items].filter(Boolean)
    return array.map(item => item['@_id'] || item.id).filter(Boolean)
  } catch (err) {
    console.warn(`Erreur getAllIds ${endpoint}`, err)
    return []
  }
}

/**
 * Récupère les statistiques de suppression pour tous les modules
 */
export const getResetStats = async () => {
  const stats = {}

  for (const key of Object.keys(MODULES_CONFIG)) {
    const config = MODULES_CONFIG[key].reset
    if (!config) continue

    const mainCount = await getCount(config.countEndpoint)

    const subStats = {}
    for (const sub of config.subEntities) {
      if (sub.endpoint) {
        subStats[sub.key] = await getCount(sub.endpoint)
      } else {
        subStats[sub.key] = 0
      }
    }

    stats[key] = {
      label: config.label,
      mainCount,
      subEntities: subStats,
      protectedIds: config.protectedIds || []
    }
  }

  return stats
}

/**
 * Supprime tous les éléments d'un module selon la configuration sélectionnée
 * @param {string} moduleKey 
 * @param {Object} selectedSubEntities - ex: { images: true, combinations: false }
 */
export const deleteModule = async (moduleKey, selectedSubEntities = {}) => {
  const moduleConfig = MODULES_CONFIG[moduleKey]
  if (!moduleConfig?.reset) throw new Error(`Module ${moduleKey} non configurable pour reset`)

  const { mainEndpoint, subEntities, protectedIds = [], protectedAddressIds = [] } = moduleConfig.reset

  // 1. Suppression des sous-entités demandées
  for (const sub of subEntities) {
    if (!sub.endpoint || selectedSubEntities[sub.key] === false) continue
    console.log(`Suppression des ${sub.label}...`)
    const ids = await getAllIds(sub.endpoint)
    for (const id of ids) {
      // Protection spécifique pour les adresses du compte anonyme
      if (sub.endpoint === 'addresses' && protectedAddressIds.includes(String(id))) {
        console.warn(`Adresse id=${id} protégée (compte anonyme), ignorée`)
        continue
      }
      try {
        await deleteById(sub.endpoint, id)
      } catch (err) {
        console.warn(`Suppression ignorée ${sub.endpoint}/${id} [${err.response?.status || err.message}]`)
      }
    }
  }

  // 2. Suppression de l'entité principale
  console.log(`Suppression des ${moduleConfig.label}...`)
  const ids = await getAllIds(mainEndpoint)

  for (const id of ids) {
    if (protectedIds.includes(id) || protectedIds.includes(String(id))) {
      console.warn(`ID ${id} protégé, ignoré`)
      continue
    }
    try {
      await deleteById(mainEndpoint, id)
    } catch (err) {
      console.warn(`Suppression ignorée ${mainEndpoint}/${id} [${err.response?.status || err.message}]`)
    }
  }
}

/**
 * Suppression complète dans l'ordre recommandé
 * @param {Object} selectedModules - ex: { orders: true, products: false, ... }
 * @param {Object} selectedSubEntities - ex: { orders: { order_details: true }, products: { images: true } }
 */
export const deleteAllSelected = async (selectedModules, selectedSubEntities = {}) => {
  const orderedModules = getResetOrder()
  const results = {
    success: [],
    errors: []
  }

  for (const module of orderedModules) {
    const moduleKey = module.key

    if (selectedModules[moduleKey] === false) continue

    try {
      await deleteModule(moduleKey, selectedSubEntities[moduleKey] || {})
      results.success.push({
        module: moduleKey,
        label: module.label
      })
    } catch (err) {
      console.error(`Erreur lors de la suppression de ${module.label}`, err)
      results.errors.push({
        module: moduleKey,
        label: module.label,
        error: err.message
      })
    }
  }

  return results
}

// Fonctions legacy pour compatibilité temporaire
export const deleteAllProducts = () => deleteModule('products')
export const deleteAllCustomers = () => deleteModule('customers')
export const deleteAllOrders = () => deleteModule('orders')
export const deleteAllCategories = () => deleteModule('categories')
export const deleteAllCombinations = () => deleteModule('combinations')

export default {
  getResetStats,
  deleteModule,
  deleteAllSelected,
}