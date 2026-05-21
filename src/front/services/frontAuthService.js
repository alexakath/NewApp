import axiosInstance from '../../api/axiosInstance'
import { parseXML } from '../../api/xmlParser'
import bcrypt from 'bcryptjs'

const TOKEN_KEY = 'front_token'
const USER_KEY  = 'front_user'
const TOKEN_DURATION_MS = 8 * 60 * 60 * 1000

const ANONYMOUS_ID = '1'

const getVal = (field) => {
  if (field === null || field === undefined) return null
  if (typeof field === 'object') {
    if (field['#text'] !== undefined) return field['#text']
    return null
  }
  return field
}

const generateToken = (user) => {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    id:        user.id,
    email:     user.email,
    firstname: user.firstname,
    lastname:  user.lastname,
    anonymous: user.anonymous || false,
    exp:       Date.now() + TOKEN_DURATION_MS,
  }))
  const signature = btoa(`${payload}.${import.meta.env.VITE_JWT_SECRET}`)
  return `${header}.${payload}.${signature}`
}

const verifyToken = (token) => {
  try {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    if (Date.now() > payload.exp) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      return null
    }
    const expectedSig = btoa(`${parts[1]}.${import.meta.env.VITE_JWT_SECRET}`)
    if (parts[2] !== expectedSig) return null
    return payload
  } catch {
    return null
  }
}

// Clé panier isolée par utilisateur
// Non connecté → null (pas de panier accessible)
export const getCartKey = () => {
  try {
    const user = localStorage.getItem(USER_KEY)
    if (!user) return null
    const parsed = JSON.parse(user)
    return parsed?.id ? `front_cart_${parsed.id}` : null
  } catch {
    return null
  }
}

export const frontLogin = async (email, password) => {
  const params = new URLSearchParams({ display: 'full' })
  const response = await axiosInstance.get(`/customers?${params}`)
  const parsed = parseXML(response.data)

  const rawList = parsed?.prestashop?.customers?.customer
  if (!rawList) throw new Error('Aucun compte trouvé')

  const customers = Array.isArray(rawList) ? rawList : [rawList]

  const match = customers.find(c =>
    (getVal(c.email) || '').trim().toLowerCase() === email.trim().toLowerCase()
  )

  if (!match) throw new Error('Aucun compte associé à cet email')
  if (String(getVal(match.active)) !== '1') throw new Error('Ce compte est désactivé')

  const storedHash = getVal(match.passwd)
  const passwordMatch = await bcrypt.compare(password, storedHash.replace(/^\$2y\$/, '$2b$'))
  if (!passwordMatch) throw new Error('Mot de passe incorrect')

  const user = {
    id:        String(getVal(match.id)),
    email:     getVal(match.email),
    firstname: getVal(match.firstname),
    lastname:  getVal(match.lastname),
  }

  const token = generateToken(user)
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))

  return user
}

/**
 * Connexion directe depuis la liste des comptes (FrontHomePage).
 * Crée la session JWT sans vérification de mot de passe.
 * Utilisé uniquement dans un contexte démo/backoffice où l'admin
 * sélectionne un compte client sans avoir à saisir un mot de passe.
 */
export const frontLoginDirect = (customer) => {
  const user = {
    id:        String(customer.id),
    email:     customer.email,
    firstname: customer.firstname,
    lastname:  customer.lastname,
  }
  const token = generateToken(user)
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

/**
 * Connexion anonyme : utilise le customer PS id=1.
 * Le flag anonymous=true est encodé dans le JWT et dans USER_KEY.
 */
export const frontLoginAsAnonymous = () => {
  const user = {
    id:        ANONYMOUS_ID,
    email:     'anonymous@newapp.local',
    firstname: 'Anonyme',
    lastname:  '',
    anonymous: true,
  }
  const token = generateToken(user)
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export const frontLogout = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  // Le panier reste intact dans front_cart_{id} — volontaire
}

export const frontIsAuthenticated = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  return verifyToken(token) !== null
}

export const frontGetCurrentUser = () => {
  try {
    const user = localStorage.getItem(USER_KEY)
    return user ? JSON.parse(user) : null
  } catch {
    return null
  }
}

/**
 * Retourne true si l'utilisateur connecté est le compte anonyme.
 */
export const frontIsAnonymous = () => {
  const user = frontGetCurrentUser()
  return user?.anonymous === true || String(user?.id) === ANONYMOUS_ID
}