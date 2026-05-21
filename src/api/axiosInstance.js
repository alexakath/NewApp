import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml',
  },
  auth: {
    username: 'LE32BY2KLQ83GBCASMYCLEQKPCZFCV2H', 
    password: ''
  }
})

export default axiosInstance