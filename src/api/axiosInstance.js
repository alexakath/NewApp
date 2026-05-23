import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml',
  },
  auth: {
    username: 'EVL7ZAVYX1YEQIJ86AND1SFEZF5VK2L8', 
    password: ''
  }
})

export default axiosInstance