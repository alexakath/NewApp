import axios from 'axios'
import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

export const getAllStock = async () => {
  const response = await axiosInstance.get('/stock_availables')
  return parseXML(response.data)
}

export const getStockById = async (id) => {
  const response = await axiosInstance.get(`/stock_availables/${id}`)
  return parseXML(response.data)
}

/**
 * Extrait la valeur d'un champ PS (string ou objet {#text}).
 */
const val = (field) => {
  if (field === null || field === undefined) return ''
  if (typeof field === 'object') {
    if (field['#text'] !== undefined) return field['#text']
    return ''
  }
  return field
}

/**
 * Client axios dédié pour l'endpoint custom newapp-api (hors webservice XML).
 * Utilise un token simple dans le header pour l'auth.
 */
const newappApi = axios.create({
  baseURL: '/newapp-api',
  headers: {
    'Content-Type': 'application/json',
    'X-Newapp-Token': import.meta.env.VITE_NEWAPP_TOKEN,
  },
})

/**
 * Ajoute une quantité au stock d'un produit / déclinaison.
 * Passe par l'endpoint custom PHP qui appelle StockAvailable::updateQuantity()
 * → alimente automatiquement stock_mvt (historique des mouvements).
 *
 * @param {string|number} stockId - id de l'enregistrement stock_available (utilisé pour récupérer id_product + id_product_attribute)
 * @param {number} quantityToAdd - quantité à AJOUTER (delta positif)
 * @returns {Promise<{success: boolean, newQuantity: number, previousQuantity: number}>}
 */
export const addStock = async (stockId, quantityToAdd) => {
  // 1. Lire l'enregistrement stock_available pour récupérer id_product + id_product_attribute
  const parsed = await getStockById(stockId)
  const record = parsed?.prestashop?.stock_available
  if (!record) {
    throw new Error(`Enregistrement stock #${stockId} introuvable`)
  }

  const idProduct          = parseInt(val(record.id_product))
  const idProductAttribute = parseInt(val(record.id_product_attribute) || 0)
  const previousQuantity   = parseInt(val(record.quantity) || 0)
  const delta              = parseInt(quantityToAdd)

  if (!idProduct) {
    throw new Error('id_product invalide')
  }
  if (!delta || delta === 0) {
    throw new Error('Quantité invalide')
  }

  // 2. Appel endpoint custom → met à jour stock_available + stock_mvt
  const response = await newappApi.post('/update_stock.php', {
    id_product: idProduct,
    id_product_attribute: idProductAttribute,
    delta: delta,
  })

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Erreur mise à jour stock')
  }

  return {
    success: true,
    newQuantity: response.data.new_quantity,
    previousQuantity,
  }
}

/**
 * Récupère l'historique des mouvements pour un produit/déclinaison.
 * Utilise le GET de l'endpoint custom (dual-purpose) qui lit ps_stock_mvt.
 */
export const getStockMovements = async (productId, combinationId = 0) => {
  const response = await newappApi.get('/update_stock.php', {
    params: {
      id_product:           productId,
      id_product_attribute: combinationId || 0,
    },
  })
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Erreur lecture mouvements')
  }
  return response.data.movements || []
}