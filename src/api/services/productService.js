import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

export const getAllProducts = async () => {
  const response = await axiosInstance.get('/products')
  return parseXML(response.data)
}

export const getProductById = async (id) => {
  const response = await axiosInstance.get(`/products/${id}?language=1`) // 👈 ajout
  return parseXML(response.data)
}

export const deleteProductById = async (id) => {
  await axiosInstance.delete(`/products/${id}`)
}

export const deleteAllProducts = async () => {
  const data = await getAllProducts()
  const productList = data?.prestashop?.products?.product
  if (!productList) return
  const productsArray = Array.isArray(productList) ? productList : [productList]
  await Promise.all(productsArray.map((p) => deleteProductById(p['@_id'])))
}