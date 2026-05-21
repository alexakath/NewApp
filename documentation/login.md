### PrestaShop stocke les employés dans ps_employees
L'API expose : GET /api/employees
Le mot de passe est hashé en bcrypt dans PrestaShop
On ne peut PAS vérifier le mot de passe via l'API
car l'API ne renvoie pas le hash bcrypt pour sécurité

### Plan:
1. On récupère le premier employé actif via GET /api/employees
2. On prérempli email dans le formulaire
3. Le mot de passe est stocké localement dans .env
   (celui créé lors de l'installation PrestaShop)
4. On vérifie email + mot de passe côté client
5. Si correct → token JWT stocké dans localStorage
6. Token protège toutes les routes de NewApp

### Plan d'implentation:
Étape 1 : Configuration (.env)
          └── VITE_ADMIN_PASSWORD=votremdp
              VITE_JWT_SECRET=unesecretkey

Étape 2 : authService.js
          ├── getEmployeeFromApi()
          │   └── GET /api/employees → récupère email
          ├── login(email, password)
          │   ├── Vérifie email + password vs .env
          │   └── Génère token JWT → localStorage
          └── logout()
              └── Supprime token localStorage

Étape 3 : useAuth.js (hook)
          ├── isAuthenticated()
          ├── getToken()
          └── getCurrentUser()

Étape 4 : LoginPage.jsx
          ├── Email prérempli depuis API
          ├── Password prérempli depuis .env
          ├── Bouton connexion
          └── Message erreur si mauvais credentials

Étape 5 : ProtectedRoute.jsx
          ├── Vérifie token JWT valide
          ├── Token valide → affiche la page
          └── Token invalide → redirige vers /login

Étape 6 : Mise à jour App.jsx
          ├── /login → public
          └── Toutes autres routes → protégées

Flux complet:
Utilisateur arrive sur /products
        ↓
ProtectedRoute vérifie le token
        ↓
Token absent ou expiré ?
        ↓ oui
Redirige → /login
        ↓
LoginPage charge le profil employé
via GET /api/employees (email prérempli)
        ↓
Utilisateur valide le formulaire
        ↓
authService vérifie email + password
        ↓
✅ Correct → génère JWT → stocke localStorage
            → redirige vers /
❌ Incorrect → message d'erreur
        ↓
Toutes les pages sont accessibles
jusqu'à logout ou expiration du token