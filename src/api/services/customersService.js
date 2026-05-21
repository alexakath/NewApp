import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

export const getAllCustomers = async () => {
  const response = await axiosInstance.get('/customers')
  return parseXML(response.data)
}

export const getCustomerById = async (id) => {
  const response = await axiosInstance.get(`/customers/${id}?language=1`) // 👈 ajout
  return parseXML(response.data)
}

export const deleteCustomerById = async (id) => {
  await axiosInstance.delete(`/customers/${id}`)
}

export const deleteAllCustomers = async () => {
  const data = await getAllCustomers()
  const customerList = data?.prestashop?.customers?.customer
  if (!customerList) return
  const customersArray = Array.isArray(customerList) ? customerList : [customerList]
  await Promise.all(customersArray.map((c) => deleteCustomerById(c['@_id'])))
}