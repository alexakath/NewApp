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

// Mapping statique des civilités PrestaShop
// 0 = Non défini, 1 = M., 2 = Mme
// Ces valeurs ne changent jamais dans PrestaShop
const GENDER_MAP = {
  '0': '—',
  '1': 'M.',
  '2': 'Mme',
}

const useEnrichedCustomers = () => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEnriched = async () => {
      try {
        setLoading(true)
        setError(null)

        // Étape 1 : Requêtes en parallèle (sans genders)
        const [
          customersData,
          ordersData,
          groupsData,
          addressesData,
        ] = await Promise.all([
          fetchAll('customers'),
          fetchAll('orders'),
          fetchAll('groups'),
          fetchAll('addresses'),
        ])

        // Étape 2 : Normalisation
        const rawCustomers  = toArray(customersData?.prestashop?.customers?.customer)
        const rawOrders     = toArray(ordersData?.prestashop?.orders?.order)
        const rawGroups     = toArray(groupsData?.prestashop?.groups?.group)
        const rawAddresses  = toArray(addressesData?.prestashop?.addresses?.address)

        // Étape 3 : Maps
        const groupMap = {}
        rawGroups.forEach((g) => {
          const id = String(getVal(g.id))
          groupMap[id] = g.name?.language?.['#text']
            || g.name?.language
            || '—'
        })

        const orderCountMap = {}
        rawOrders.forEach((o) => {
          const cid = String(getVal(o.id_customer))
          orderCountMap[cid] = (orderCountMap[cid] || 0) + 1
        })

        const addressCountMap = {}
        rawAddresses.forEach((a) => {
          const cid = String(getVal(a.id_customer))
          if (getVal(a.deleted) != 1) {
            addressCountMap[cid] = (addressCountMap[cid] || 0) + 1
          }
        })

        // Étape 4 : Enrichissement
        const enriched = rawCustomers.map((customer) => {
          const id = String(getVal(customer.id))
          const genderId = String(getVal(customer.id_gender) || '0')
          const groupId = String(getVal(customer.id_default_group))

          return {
            id,
            firstname: customer.firstname || '—',
            lastname: customer.lastname || '—',
            email: customer.email || '—',
            gender: GENDER_MAP[genderId] || '—',
            group: groupMap[groupId] || '—',
            birthday: getVal(customer.birthday) || '—',
            newsletter: getVal(customer.newsletter),
            active: getVal(customer.active),
            orderCount: orderCountMap[id] || 0,
            addressCount: addressCountMap[id] || 0,
            dateAdd: getVal(customer.date_add)?.split(' ')[0] || '—',
            raw: customer,
          }
        })

        setCustomers(enriched)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchEnriched()
  }, [])

  return { customers, loading, error }
}

export default useEnrichedCustomers