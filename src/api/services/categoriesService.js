import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

export const getAllCategories = async () => {
  const response = await axiosInstance.get('/categories')
  return parseXML(response.data)
}

export const getCategoryById = async (id) => {
  const response = await axiosInstance.get(`/categories/${id}?language=1`)
  return parseXML(response.data)
}

export const deleteCategoryById = async (id) => {
  await axiosInstance.delete(`/categories/${id}`)
}

export const deleteAllCategories = async () => {
  const data = await getAllCategories()
  const list = data?.prestashop?.categories?.category
  if (!list) return
  const arr = Array.isArray(list) ? list : [list]
  // On ignore les catégories système (id 1 et 2 sont réservées par PrestaShop)
  const deletable = arr.filter((c) => c['@_id'] > 2)
  await Promise.all(deletable.map((c) => deleteCategoryById(c['@_id'])))
}