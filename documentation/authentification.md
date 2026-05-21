# Authentification NewApp

## Contexte et contraintes

PrestaShop expose les employés via `GET /api/employees` mais
ne renvoie **pas** le hash du mot de passe pour des raisons
de sécurité. Il est donc impossible de vérifier le mot de passe
directement via l'API.

La stratégie choisie :
- L'email est récupéré depuis l'API PrestaShop (préremplissage)
- Le mot de passe est stocké dans `.env` (saisi lors de l'installation)
- La vérification se fait côté client
- Un token JWT maison est généré et stocké dans `localStorage`

---

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `src/auth/authService.js` | Logique métier : login, logout, JWT, session |
| `src/auth/useAuth.js` | Hook React exposant l'état auth aux composants |
| `src/components/ProtectedRoute.jsx` | Garde les routes privées |
| `src/pages/LoginPage.jsx` | Formulaire de connexion |
| `.env` | Stockage du mot de passe et secret JWT |

---

## Configuration `.env`

```env
VITE_ADMIN_PASSWORD=votremdpici
VITE_JWT_SECRET=newapp_secret_key_2026
```

- `VITE_ADMIN_PASSWORD` : mot de passe créé lors de l'installation PrestaShop
- `VITE_JWT_SECRET` : clé secrète pour signer les tokens JWT

Ces variables sont accessibles dans le code via
`import.meta.env.VITE_[NOM]` (préfixe `VITE_` obligatoire avec Vite).

---

## Flux d'authentification
Utilisateur arrive sur n'importe quelle route
↓
ProtectedRoute vérifie le token dans localStorage
↓
Token absent ou expiré ?
↓ OUI                         ↓ NON
Redirige /login              Affiche la page
↓
LoginPage charge le profil
via GET /api/employees
(email prérempli)
↓
Utilisateur soumet le formulaire
↓
authService.login(email, password)
├── Vérifie email vs employé API
├── Vérifie password vs .env
└── Génère token JWT → localStorage
↓
✅ Succès → redirige vers /
❌ Échec  → message d'erreur affiché

---

## `authService.js` — Fonctions exportées

### `getEmployeeFromApi()`
Rôle    : Récupère le premier employé actif depuis PrestaShop
Endpoint: GET /api/employees?display=full
Retourne: { id, firstname, lastname, email } ou null si erreur
Utilité : Préremplir le formulaire de login

### `login(email, password)`
Rôle    : Vérifie les credentials et génère un token JWT
Étapes  :

Appelle getEmployeeFromApi()
Compare email (insensible à la casse)
Compare password vs VITE_ADMIN_PASSWORD
Génère un token JWT (durée 8h)
Stocke token + user dans localStorage
Retourne: { id, firstname, lastname, email } si succès
Erreurs : "Email incorrect" / "Mot de passe incorrect" /
"Impossible de récupérer le profil employé"


### `logout()`
Rôle    : Supprime le token et la session de localStorage
Utilité : Appelé depuis le bouton logout dans la topbar

### `isAuthenticated()`
Rôle    : Vérifie si un token valide existe dans localStorage
Retourne: true si token valide et non expiré, false sinon
Utilité : Utilisé par ProtectedRoute à chaque navigation

### `getCurrentUser()`
Rôle    : Récupère l'utilisateur connecté depuis localStorage
Retourne: { id, firstname, lastname, email } ou null
Utilité : Afficher le nom dans la topbar

### `getToken()`
Rôle    : Retourne le token JWT brut depuis localStorage
Retourne: string token ou null

---

## Token JWT maison

Le token JWT est généré sans librairie serveur.
Structure : `header.payload.signature` encodés en base64.
Header    : { alg: "HS256", typ: "JWT" }
Payload   : { id, email, firstname, lastname, exp }
Signature : btoa(payload + VITE_JWT_SECRET)

**Durée de validité** : 8 heures depuis la connexion.
Passé ce délai, `isAuthenticated()` retourne `false`
et l'utilisateur est redirigé vers `/login`.

**Vérifications lors du décodage** :
- Token bien formé (3 parties)
- Non expiré (`Date.now() > payload.exp`)
- Signature correcte (recalculée et comparée)

---

## `useAuth.js` — Hook React

Expose l'état d'authentification à tous les composants.

### Valeurs retournées

| Propriété | Type | Description |
|-----------|------|-------------|
| `user` | `object \| null` | Utilisateur connecté |
| `authenticated` | `boolean` | `true` si token valide |
| `loading` | `boolean` | `true` pendant le login |
| `error` | `string \| null` | Message d'erreur login |
| `employee` | `object \| null` | Profil PrestaShop pour préremplissage |
| `login(email, password)` | `function` | Tente la connexion |
| `logout()` | `function` | Déconnecte l'utilisateur |

### Comportement

```js
// Chargement du profil employé uniquement si non connecté
useEffect(() => {
  if (!authenticated) loadEmployee()
}, [authenticated])

// login() retourne true si succès, false si échec
// L'erreur est accessible via error
const success = await login(email, password)
```

---

## `ProtectedRoute.jsx`

Composant qui enveloppe toutes les routes privées dans `App.jsx`.
Si isAuthenticated() → affiche children
Si non authentifié  → <Navigate to="/login" replace />

`replace` évite que `/login` s'empile dans l'historique
du navigateur, donc le bouton retour ne ramène pas
à une page protégée après déconnexion.

---

## `LoginPage.jsx`

### Comportement

- Au montage : charge le profil employé via `useAuth`
- Quand employé chargé : prérempli `email` + `password` via `formData`
- Si déjà connecté : redirige vers `/` automatiquement
- Submit : appelle `login()` → redirige si succès, affiche erreur si échec

### État `formData`

Un seul objet state pour email + password pour éviter
les conflits de synchronisation dans le `useEffect` :

```js
const [formData, setFormData] = useState({ email: '', password: '' })

// Mise à jour atomique des deux champs en même temps
setFormData({
  email: employee.email,
  password: import.meta.env.VITE_ADMIN_PASSWORD || '',
})
```

### Fonctionnalités UI

- Affichage du profil employé (avatar initiales + nom + rôle)
- Bouton œil pour afficher/masquer le mot de passe
- Spinner pendant la connexion
- Message d'erreur rouge si credentials incorrects

---

## Sécurité — Limitations connues

Cette implémentation est adaptée pour une **démo en local**.
Pour un environnement de production il faudrait :
❌ Mot de passe en clair dans .env
→ À remplacer par une vérification bcrypt côté serveur
❌ JWT signé côté client (secret accessible dans le navigateur)
→ À remplacer par un JWT signé côté serveur (Node.js/PHP)
❌ localStorage vulnérable aux attaques XSS
→ À remplacer par des cookies httpOnly en production
✅ Adapté pour démonstration locale avec PrestaShop
✅ Token expirant après 8h
✅ Vérification signature JWT à chaque navigation

---

## Généralisation

Ce pattern d'authentification peut être réutilisé
pour tout backoffice React avec ces adaptations :

Remplacer getEmployeeFromApi() par n'importe quel
endpoint qui retourne le profil utilisateur
Remplacer la vérification .env par un appel API
POST /login avec email + password hashé
Le reste (JWT, ProtectedRoute, useAuth)
reste identique quel que soit le backend