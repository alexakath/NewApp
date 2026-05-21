### Authentification FrontOffice — NewApp
Contexte
PrestaShop 8.2.6 hashe les mots de passe avec bcrypt ($2y$10$...), un algorithme unidirectionnel. On ne peut pas décrypter, on ne peut que comparer. L'ancienne approche md5 était celle de PrestaShop < 1.7, elle ne s'applique plus.

Flux complet
Utilisateur clique "Accéder" sur un profil (FrontHomePage)
        ↓
navigate('/shop/login?email=xxx@xxx.com')
        ↓
FrontLoginPage lit ?email via useSearchParams
→ champ email pré-rempli en readOnly
→ focus automatique sur le champ mot de passe
        ↓
Utilisateur saisit son mot de passe et soumet
        ↓
frontLogin(email, password)  ← frontAuthService.js
        ↓
GET /api/customers?display=full  ← PrestaShop via Axios
        ↓
Recherche du client par email (toLowerCase)
        ↓
Vérifications dans l'ordre :
  1. Email existe ?       → sinon : "Aucun compte associé à cet email"
  2. Compte actif ?       → sinon : "Ce compte est désactivé"
  3. Mot de passe correct ?
        ↓
bcrypt.compare(password, storedHash.replace($2y$ → $2b$))
→ $2y$ = préfixe PHP,  $2b$ = préfixe Node.js
→ mathématiquement identiques, bcryptjs n'accepte que $2b$
        ↓
  Correct → génération JWT maison + stockage localStorage
  Incorrect → "Mot de passe incorrect"
        ↓
navigate(from)  ← retour à la page demandée ou /shop/products

JWT maison
Le token est structuré comme un vrai JWT mais signé de façon simplifiée :
header.payload.signature

header    = btoa({ alg, typ })
payload   = btoa({ id, email, firstname, lastname, exp })
signature = btoa(payload + VITE_JWT_SECRET)
Stocké dans localStorage sous la clé front_token. Durée de vie : 8h. À chaque appel de frontIsAuthenticated(), le token est vérifié : expiration + signature. Si expiré → supprimé automatiquement.

Ce qui est stocké en localStorage
CléContenufront_tokenJWT maison (header.payload.signature)front_user{ id, email, firstname, lastname }front_cart[{ itemId, productId, name, price, qty, ... }]

Sécurité — ce qu'on a, ce qu'on n'a pas
On a — bcrypt côté comparaison, JWT avec expiration, compte actif vérifié, email normalisé avant comparaison.
Limitations assumées — JWT signé côté client (secret visible dans le bundle Vite), pas de refresh token, pas de HTTPS forcé en local. C'est suffisant pour un projet interne/demo, insuffisant pour une app publique en production.