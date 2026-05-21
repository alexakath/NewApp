import axiosInstance from '../axiosInstance'
import { parseXML } from '../xmlParser'

const JWT_SECRET  = import.meta.env.VITE_JWT_SECRET
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD
const TOKEN_KEY   = 'newapp_token'
const USER_KEY    = 'newapp_user'

// Durée de validité du token : 8 heures
const TOKEN_DURATION_MS = 8 * 60 * 60 * 1000

/**
 * Récupère le premier employé actif depuis l'API PrestaShop
 * Utilisé pour préremplir le formulaire de login
 */
export const getEmployeeFromApi = async () => {
  try {
    const params = new URLSearchParams({ display: 'full' })
    const response = await axiosInstance.get(`/employees?${params}`)
    const parsed = parseXML(response.data)

    const employees = parsed?.prestashop?.employees?.employee
    if (!employees) return null

    const arr = Array.isArray(employees) ? employees : [employees]

    // Récupérer le premier employé actif
    const active = arr.find((e) => {
      const activeVal = typeof e.active === 'object'
        ? e.active?.['#text']
        : e.active
      return String(activeVal) === '1'
    })

    if (!active) return null

    return {
      id:        active.id,
      firstname: active.firstname || '',
      lastname:  active.lastname  || '',
      email:     active.email     || '',
    }
  } catch (err) {
    console.error('Erreur récupération employé :', err.message)
    return null
  }
}

/**
 * Génère un token JWT simple (sans librairie serveur)
 * Structure : header.payload.signature (encodé en base64)
 */
const generateToken = (user) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))

  const payload = btoa(JSON.stringify({
    id:        user.id,
    email:     user.email,
    firstname: user.firstname,
    lastname:  user.lastname,
    exp:       Date.now() + TOKEN_DURATION_MS,
  }))

  // Signature simple : hash du payload + secret
  const signature = btoa(`${payload}.${JWT_SECRET}`)

  return `${header}.${payload}.${signature}`
}

/**
 * Vérifie et décode un token JWT
 * Retourne le payload si valide, null sinon
 */
const verifyToken = (token) => {
  try {
    if (!token) return null

    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(atob(parts[1]))

    // Vérification expiration
    if (Date.now() > payload.exp) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      return null
    }

    // Vérification signature
    const expectedSig = btoa(`${parts[1]}.${JWT_SECRET}`)
    if (parts[2] !== expectedSig) return null

    return payload
  } catch {
    return null
  }
}

/**
 * Tente la connexion avec email + mot de passe
 * Vérifie les credentials puis génère un token JWT
 */
export const login = async (email, password) => {
  // Récupérer l'employé depuis l'API
  const employee = await getEmployeeFromApi()
  if (!employee) {
    throw new Error('Impossible de récupérer le profil employé depuis PrestaShop')
  }

  // Vérification email
  if (email.trim().toLowerCase() !== employee.email.trim().toLowerCase()) {
    throw new Error('Email incorrect')
  }

  // Vérification mot de passe (comparaison avec .env)
  if (password !== ADMIN_PASSWORD) {
    throw new Error('Mot de passe incorrect')
  }

  // Génération token JWT
  const token = generateToken(employee)

  // Stockage dans localStorage
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(employee))

  return employee
}

/**
 * Déconnexion : supprime le token et l'utilisateur
 */
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  return verifyToken(token) !== null
}

/**
 * Retourne l'utilisateur connecté depuis localStorage
 */
export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem(USER_KEY)
    return user ? JSON.parse(user) : null
  } catch {
    return null
  }
}

/**
 * Retourne le token stocké
 */
export const getToken = () => localStorage.getItem(TOKEN_KEY)