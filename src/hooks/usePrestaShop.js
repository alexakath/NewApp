import { useState, useEffect } from 'react'
import axiosInstance from '../api/axiosInstance'
import { parseXML } from '../api/xmlParser'

/**
 * Hook générique pour récupérer des données depuis l'API PrestaShop
 * Utilise display=full pour récupérer tous les champs en une seule requête
 */
const usePrestaShop = (endpoint, options = {}) => {
  const {
    displayFull = true,
    language = 1,
    params = {},
    skip = false,
  } = options

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (skip) { setLoading(false); return }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const queryParams = {
          ...(displayFull && { display: 'full' }),
          ...(language && { language }),
          ...params,
        }

        const queryString = new URLSearchParams(queryParams).toString()
        const url = `/${endpoint}${queryString ? `?${queryString}` : ''}`

        const response = await axiosInstance.get(url)
        const parsed = parseXML(response.data)
        setData(parsed)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [endpoint, skip])

  return { data, loading, error }
}

export default usePrestaShop