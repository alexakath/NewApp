import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

export const getAllCombinations = async () => {
  const response = await axiosInstance.get('/combinations')
  return parseXML(response.data)
}

export const getCombinationById = async (id) => {
  const response = await axiosInstance.get(`/combinations/${id}`)
  return parseXML(response.data)
}

export const deleteCombinationById = async (id) => {
  await axiosInstance.delete(`/combinations/${id}`)
}

export const deleteAllCombinations = async () => {
  const data = await getAllCombinations()
  const list = data?.prestashop?.combinations?.combination
  if (!list) return
  const arr = Array.isArray(list) ? list : [list]
  await Promise.all(arr.map((c) => deleteCombinationById(c['@_id'])))
}