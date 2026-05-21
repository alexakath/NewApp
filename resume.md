### Résumé complet du projet NewApp

Contexte général
Le projet consiste à créer NewApp, une application React connectée à PrestaShop 8.2.6 via son API REST. L'échange de données se fait exclusivement en XML. PrestaShop tourne en local et NewApp communique avec lui via un proxy Vite pour éviter les problèmes CORS.

Stack technique
Frontend  : React + Vite
Routing   : React Router DOM
HTTP      : Axios
XML       : fast-xml-parser
CSV       : PapaParse
Auth      : JWT maison (localStorage)
Icons     : Tabler Icons (webfont)
Style     : CSS pur (pas de framework UI)

Architecture générale
NewApp (React : 5173)
    ↓ Axios (auth Basic + headers XML)
Vite Proxy (évite CORS)
    ↓
PrestaShop API (localhost/prestashop_edition_classic_version_8.2.6)
    ↓ répond en XML
fast-xml-parser (XML → objet JS)
    ↓
Hooks enrichis (jointure JS des données)
    ↓
Composants React (affichage)

### BACKOFFICE
Structure des fichiers
src/
├── api/
│   ├── axiosInstance.js          ← config Axios (baseURL, auth, headers XML)
│   ├── xmlParser.js              ← parsing XML → objet JS
│   ├── services/
│   │   ├── productService.js     ← GET, DELETE produits
│   │   ├── customersService.js   ← GET, DELETE clients
│   │   ├── ordersService.js      ← GET, DELETE, PUT état commande
│   │   ├── categoriesService.js  ← GET, DELETE catégories
│   │   ├── combinationsService.js← GET, DELETE déclinaisons
│   │   └── stockService.js       ← GET stock
│   │   └── stockMovementService.js       ← GET stock mouvement
│   │   └── authService.js        ← GET employees : login, logout, JWT, getCurrentUser
│   └── utils/
│       ├── modulesConfig.js      ← config centralisée tous les modules
│       ├── detectModules.js      ← detection automatique des modules lors de l'import
│       └── csvToXml.js           ← conversion CSV row → XML PrestaShop
│       └── validateImport.js          ← validation du fichier import
│
├── hooks/
│   ├── useAuth.js          ← hook générique display=full
│   ├── usePrestaShop.js          ← hook générique display=full
│   ├── useEnrichedProducts.js    ← produits enrichis
│   ├── useEnrichedCustomers.js   ← clients enrichis
│   ├── useEnrichedOrders.js      ← commandes enrichies
│   ├── useEnrichedCategories.js  ← catégories enrichies
│   ├── useEnrichedStock.js       ← stock enrichi
│   └── useEnrichedCombinations.js← déclinaisons enrichies
│
├── components/
│   ├── Layout.jsx + .css         ← sidebar + topbar + content
│   ├── ProtectedRoute.jsx        ← garde les routes privées
│   ├── ProductList.jsx           ← tableau produits enrichis
│   ├── CustomersList.jsx         ← tableau clients enrichis
│   ├── OrdersList.jsx            ← tableau commandes + dropdown état
│   ├── CategoriesList.jsx        ← tableau catégories arborescentes
│   ├── CombinationsList.jsx      ← tableau déclinaisons enrichies
│   ├── StockList.jsx             ← tableau stock enrichi
│   ├── ResetModuleItem.jsx            ← reinitialisation
│   └── List.css                  ← styles partagés tous les tableaux
│
└── pages/
    ├── Dashboard.jsx + .css      ← stats + dernières commandes + alertes
    ├── LoginPage.jsx + .css      ← formulaire login prérempli
    ├── ImportPage.jsx + .css     ← import CSV multi-étapes
    └── ResetPage.jsx + .css      ← réinitialisation par module
    └── StockEntryPage.jsx + .css      ← ajout de stock
    └── StockHistoryPage.jsx + .css      ← historique 
    

Ce qu'on a implémenté
1. Connexion PrestaShop ↔ NewApp : A voir

Proxy Vite configuré pour éviter les CORS
Instance Axios centralisée avec authentification Basic Auth via clé API PrestaShop
Parser XML fast-xml-parser configuré pour gérer les attributs et le texte
Helper getVal() pour extraire les valeurs des champs PrestaShop (simples ou xlink)
Helper toArray() pour normaliser les réponses en tableau

2. Affichage des données — 6 modules
Chaque module suit le même pattern :

useEnriched[Module] charge toutes les données en parallèle via Promise.all
Jointure côté JS via des Maps pour enrichir les données
Composant List affiche un tableau avec données enrichies
Message Aucun [module] détecté si liste vide

Produits : image, nom, catégorie parente, catégorie enfant, référence, prix HT, prix TTC, quantité, état
Clients : civilité (mapping statique), nom, email, groupe, nb commandes, nb adresses, date inscription, état
Commandes : référence, client, transporteur, total HT, total TTC, devise, nb produits, état modifiable, date
Catégories : arborescence visuelle (parent en bleu, enfant indenté), catégorie parente, nb produits, état
Stock : produit lié, référence, déclinaison liée, quantité, statut (disponible / stock faible / rupture)
Déclinaisons : produit parent, attributs (Taille: M / Couleur: Bleu), impact prix, prix final, stock

3. Dashboard

4 stats dynamiques : total produits, clients, commandes, ruptures de stock
Detail commande date du systeme
Liste des commandes par jour : nb de commande + montant
Total general
Champ de recherche de commande par date

4. Import CSV : A voir
Fonctionnement en 5 étapes :

Choix du module (6 modules disponibles)
Configuration séparateurs (champ + valeurs multiples, modifiables)
Affichage des champs requis et optionnels du module choisi
Upload fichier avec validation : extension, taille max 10MB, colonnes obligatoires, compatibilité séparateur
Prévisualisation 5 premières lignes avec colonnes requises marquées
Import par batch de 10 avec pause 300ms entre batches
Rapport final : nb succès + erreurs avec numéro de ligne

Modules supportés : products, customers, orders, categories, combinations, stock

5. Réinitialisation

Suppression par module individuel avec confirmation
Bouton "Tout supprimer" avec double confirmation
Feedback visuel : spinner, badge succès / erreur par module
Protection catégories système PrestaShop (id 1 et 2 non supprimables)

6. Modification état commande : A VOIR ENCORE

Dropdown inline dans le tableau commandes
3 états disponibles : Paiement effectué (2), Dans le panier (localStates), Annulé (6)
Mise à jour locale immédiate (optimistic update) sans recharger la liste
PUT vers PrestaShop avec objet commande complet (PrestaShop exige le PUT complet)
Feedback : spinner pendant la mise à jour, erreur sur la ligne si échec

7. Authentification

Récupération employé PrestaShop via GET /api/employees pour préremplir le formulaire
Formulaire login avec email et mot de passe préremplis
Vérification email + mot de passe (mot de passe stocké dans .env)
Génération token JWT maison stocké dans localStorage (durée 8h)
ProtectedRoute protège toutes les routes sauf /login
Bouton logout dans la topbar qui supprime le token et redirige

### FRONTOFFICE:
Structure des fichiers
src/
├── front/
│   ├── FrontLayout.jsx          ← navbar
│   ├── FrontLayout.css          
│   ├── services/
│   │   ├── frontAuthService.js     ← getVal, generateToken, verifyToken, frontLogin,frontLogout,frontIsAuthenticated,frontGetCurrentUser : bcrypt
│   └── hooks/
│       ├── useProductDetail.js    ← fiche produit
│   └── pages/
│       ├── CartPage.css    ← panier css
│       ├── CartPage.jsx    ← page panier
│       ├── FrontLoginPage.css    ← login css
│       ├── FrontLoginPage.jsx   ← page login
│       ├── FrontHomePage.css    ← Home page css
│       ├── FrontHomePage.jsx   ← page kliste utilisateur
│       ├── ProductPage.css   ← fiche produit css
│       ├── ProductPage.jsx     ← page fiche produit
│       ├── ShopPage.css   ← liste produit css
│       ├── ShopPage.jsx   ← page liste produit
│       ├── MyOrdersPage.jsx   ← page liste produit
│       ├── OrderConfirmPage.jsx   ← page liste produit

# AVANCEMENT PROJET — J1 & J2

## Consignes générales
- Utiliser **France** comme pays
- Utiliser **Euro (€)** comme devise
- Créer uniquement les pages demandées
- Ne pas ajouter de menu ou d’affichage non demandé

---

# JOUR 1

# NewAPP

## Backoffice

| Fonctionnalité | État | Remarques |
|---|---|---|
| Login / mot de passe administrateur | ⚠️ À revoir | Fonctionnel mais amélioration nécessaire |
| Protection des pages du backoffice | ❌ À faire | Empêcher l’accès sans authentification |
| Page de réinitialisation des données | ✅ Fait |  |
| Page d’import des fichiers | ❌ À refaire complètement | Structure et logique à revoir |
| Affichage des commandes | ⚠️ À confirmer | Vérifier la logique métier |
| Modification de l’état des commandes | ⚠️ À confirmer | États utilisés : paiement effectué / annulé |

### Fichiers d’import : A tester quand import est fait

| Fichier | État / Remarque |
|---|---|
| `import-data-mai-26` | 3 fichiers CSV pour les données |
| CSV modifié le 11/05 à 13:15 | Vérifier les modifications (couleur rouge) |
| `images.zip` | Fichier ZIP contenant les images |

---

## FrontOffice

| Fonctionnalité | État | Remarques |
|---|---|---|
| Page d’accueil produits | ✅ Fait |  |
| Fiche produit | ✅ Fait |  |
| Workflow d’achat complet | ✅ Fait
| Gestion du panier | ✅ Fait
| Validation de commande | ✅ Fait
| Paiement à la livraison uniquement | ✅ Fait
| Frais de livraison | ✅ Fait
| Page “Mes commandes” | ❌ À faire |  |

---

# ExistingApp (PrestaShop)

| Vérification | État | Remarques |
|---|---|---|
| Les données importées sont visibles dans le backoffice PrestaShop | ❌ À vérifier |  |
| Les modifications des données impactent la NewAPP | ❌ À vérifier | Synchronisation à confirmer |

---

# JOUR 2

# NewAPP

## Backoffice

| Fonctionnalité | État | Remarques |
|---|---|---|
| États des commandes importés | ⚠️ À confirmer | Logique métier à valider |
| Tableau de bord | ✅ Fait |  |
| Statistiques par jour | ✅ Fait | Nombre de commandes + montant |
| Total général | ✅ Fait |  |

### États utilisés

| État | Remarque |
|---|---|
| Dans le panier | Cart uniquement, pas encore commande |
| Paiement effectué |  |
| Annulé |  |

### Point à clarifier

| Sujet | Remarque |
|---|---|
| “Ny import 1 ihany ny déclinaison, fa tsisy combinaison” | À clarifier complètement |

---

## FrontOffice

| Fonctionnalité | État | Remarques |
|---|---|---|
| Nouvelle page d’accueil : liste des utilisateurs existants | ✅ Fait |  |
| Choix de l’utilisateur pour connexion | ✅ Fait | |
| Option “utilisateur anonyme” | ❌ À faire |  |
| Affichage des marques HOT / NEW | ❌ À faire | Basé sur `date_availability_produit` |
| Recherche multicritère produits | ✅ Fait |  |

### Règles des badges produits

| Badge | Condition |
|---|---|
| HOT | Produit sorti il y a 1 jour |
| NEW | Produit sorti il y a moins d’1 semaine |

### Recherche multicritère

- Nom
- Catégorie
- Intervalle de prix

---

# RÉCAPITULATIF GLOBAL

## ✅ Fonctionnalités terminées

- Page accueil produits
- Fiche produit
- Tableau de bord statistiques
- Recherche multicritère
- Page réinitialisation données
- Liste des utilisateurs existants
- Login utilisateur frontoffice
- Gestion panier : un panier = un client, panier garder pour le compte meme deconnexion
- Workflow d’achat complet : login, choix produit, ajout panier, modal validation commande : adresse
- Validation commande
- Paiement à la livraison + sans frais de livraison 

---

## ⚠️ Fonctionnalités à revoir / confirmer

- Login backoffice : Protection backoffice
- Import fichiers + import images 
- Logique des états de commande
- Synchronisation ExistingApp ↔ NewAPP
- Gestion des déclinaisons / combinaisons


---

## ❌ Fonctionnalités restantes à faire
- Dans l'etat des commandes : tsy /orders rery no alaina fa lasa maka /cart?card (le panier) ko izy dia lasa afficher ao am liste commande ze ao anaty panier (mifandray am client) io le etat : dans le panier
- Apres avoir cliquer sur valider commande : etat commande : tonga dia paiement effectue tsy afaka ovaina dans le panier tsony fa afaka ovaina annule, annule afaka ovaina paiement effectue fa tsisy afaka miverina dans le panier tsony, sans erreur ? appercu dans prestashop et nexapp backoffice?
- Page “Mes commandes”
- Utilisateur anonyme
- Badges HOT / NEW
- Vérification des imports dans PrestaShop
- Import image, import fichier 2 et 3, (fichier 3 mot de passe en clair)


### IMPORT :

On s'est concentre sur l'import du backoffice 
Voici la nouvelle version du backoffice:
Étape 0 : Upload fichier → détection auto
Étape 1 : Validation modules détectés (modifiable)
Étape 2 : Configuration séparateurs
Étape 3 : Aperçu par module
Étape 4 : Import séquentiel + rapport
Logique de détection
Chaque module a des signatures (headers CSV normalisés → score) :
fichier 1 headers : date_availability_produit, nom, reference, prix_ttc, Taxe, categorie, prix_achat
→ products  : reference, nom, prix_ttc, prix_achat     → score 4  ✅ détecté
→ categories: categorie                                 → score 1  ✅ détecté  
→ taxes     : Taxe, prix_ttc                           → score 2  ✅ détecté

fichier 2 headers : reference, specificité, karazany, stock_initial, prix_vente_ttc
→ combinations: specificité, karazany                  → score 2  ✅
→ stock       : stock_initial                          → score 1  ✅

fichier 3 headers : date, nom, email, pwd, adresse, achat, etat
→ customers: nom, email, pwd, adresse                  → score 4  ✅
→ orders   : achat, etat                               → score 2  ✅
Seuil minimum : score ≥ 1 → détecté, affiché avec niveau de confiance (haut/moyen/faible).
src/api/utils/detectModules.js — moteur de détection (nouveau)
src/api/utils/modulesConfig.js — on ajoute les signatures de détection (ajout seulement, rien cassé)
src/api/services/importService.js — on remplace importCsv + on garde parseCsvFile/detectDelimiter
src/pages/ImportPage.jsx — refonte complète du flux
Mais il ya encore des erreurs a corriger, et on se concentre sur le fichier 1 d'abord

voici ce qu'il faut revoir :
le lien de des modules detectes doit aussi etre fait, ici par exemple fichier 1 = 3 modules : products, categories, taxes , la regle est dans un fichier csv meme si il y a 3 modules si c'est 3 modules sont regroupes dans un seul fichier csv ca veut dire que ces 3 modules sont lies

Dans le fichier 1: FICHIER 1 REGLE : import du fichier 1 = entree dans produits (4 : lie a cahque categorie), entree dans categorie (lie au produit), entree dans taxes (liee au produit)
date_availability_produit,nom,reference,prix_ttc,Taxe,categorie,prix_achat
01/12/2025,Tshirt,T_01,"12,5","11,65%",Akanjo,"8,5"
02/05/2026,Pantalon,P_01,"18,99","11,65%",Akanjo,"14,33"
08/05/2026,Casquette,C_03,5,"5,60%",Accessoire,2
08/05/2026,Montre,M_02,56,"5,60%",Accessoire,40
ex : T_01 est lie a categorie Akanjo et le TVA s'applique au prix de T_01
Donc quand je vois dans categorie Akanjo je dois voir que 2 produits est lie a cela, ect : FAIT
Je sais pas si tu comprends
Et de meme pour les autres fichiers
fichier 2: 2 module detecte : declinaison et stock : erreurs , produit non reconnu, declinaison : attribut inserer, stock non insere, j'ai refais 2 module detecte + selection manuel de produit : reference dans produit : mais erreur 6 erreurs
reference,specificité,karazany,stock_initial,prix_vente_ttc

T_01,taille,ngoza,13,"12,5"

T_01,taille,kely,10,15

P_01,couleur,mainty,5,"23,49"

P_01,couleur,fotsy,3,"18,99"

C_03,,,10,

M_02,,,11,
LA ref T_01 est le produit qu'on a cree tout a l'heure et ceci est donc le detail de ce produit,....
fichier 3: module detecte : client et commande, client inserer : mais gestion mot de passe? quand je teste dans frontoffice erreur : commande 0 inserer
date,nom,email,pwd,adresse,achat,etat
09/05/2026,Rakoto,rakoto@yopmail.com,XvzsX5O0!GBD0uXQ,Andoharanofotsy,"[(""T_01"";3;""ngoza"")]",
16/04/2026,Rajao,rajao1970@yopmail.com,BAC?UoxjQIW;Na8ix,Analakely,"[(""T_01"";2;""kely""),(""C_03"";1;"""")]",paiement accepté
07/05/2026,Rakoto,rakoto@yopmail.com,XvzsX5O0!GBD0uXQ,Andoharanofotsy,"[(""T_01"";1;""kely"")]",paiement accepté

Donc pour tous les imports c'est comme cela si un fichier = plusieurs modules c'est que ces modules sont lies

On doit corriger cela alors
Le lien entre modules dans un même fichier CSV se traduit par des associations PrestaShop :

Produit → Catégorie : id_category_default + associations/categories
Produit → Taxe : id_tax_rules_group
Déclinaison → Produit : id_product
Stock → Produit : id_product
Le problème central : au moment d'importer les produits, les catégories et taxes viennent d'être créées — il faut récupérer leurs IDs depuis les réponses PrestaShop et les injecter dans les lignes produits avant de les envoyer.
PS : La reference dans le fichier 2 correspond à la reference du produit créé depuis le fichier 1. Donc le lien se fait via la colonne reference commune aux deux fichiers.
les déclinaisons du fichier 2 — specificité + karazany — c'est le type d'attribut (taille, couleur) et la valeur (ngoza, kely, mainty...). Ces attributs doivent être créés dans PrestaShop (product_options + product_option_values) avant de créer les combinaisons. C'est un import en 3 étapes : option → option_value → combination.
Ce qui change dans l'ordre d'import pour un fichier multi-modules :
Fichier 1 :  taxes → categories → products (avec id_tax + id_category injectés)
Fichier 2 :  product_options → product_option_values → combinations + stock (avec id_product injecté)
Fichier 3 :  customers → addresses → orders (avec id_customer injecté)
Mécanisme : après chaque POST réussi, on stocke la réponse dans un "registre" en mémoire { reference → id_prestashop }. Les modules suivants puisent dans ce registre pour injecter les IDs manquants.
3 fichiers modifiés :

detectModules.js — ajout d'un ImportRegistry + logique d'injection par module dans buildXmlFromMapping
importService.js — sendOne retourne la réponse, importModuleRows alimente le registre
modulesConfig.js — ajout de registryKey (comment extraire la clé d'une réponse) et resolvers (comment injecter les IDs)
Fichier 1 :

taxes POST → stocke { "11.65" → id_tax_rules_group_id } — mais attention, PrestaShop crée une tax pas un tax_rules_group. Il faut aussi créer un tax_rule_group puis le lier. C'est 3 appels : tax_rules_groups → tax_rules → puis injecter id_tax_rules_group dans le produit
categories POST → stocke { "Akanjo" → 25, "Accessoire" → 26 }
products POST → lit la colonne categorie + Taxe de la même ligne, injecte id_category_default + associations/categories + id_tax_rules_group

Fichier 2 :

product_options POST → stocke { "taille" → id, "couleur" → id }
product_option_values POST → stocke { "ngoza" → id, "kely" → id, ... }
combinations POST avec id_product résolu via reference
stock PUT (pas POST) sur le stock_available déjà créé par PrestaShop lors du POST produit

Fichier 3 :

customers POST → stocke { "rakoto@yopmail.com" → id_customer }
addresses POST avec id_customer injecté
orders POST avec id_customer + order_details construits depuis le champ achat
PrestaShop ne lie pas directement tax à un produit. La chaîne est : tax → tax_rules_group → tax_rule → produit via id_tax_rules_group. C'est 3 endpoints. on gère ça complètement
le stock du fichier 2 — C'est un PUT sur stock_availables/{id} avec l'ID récupéré depuis la réponse du POST produit
