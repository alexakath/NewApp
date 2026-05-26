j'ai un projet d'évaluation à faire. le sujet concerne un nouveau site (NewApp) une application React(Vite) qui sert d'interface alternative (Backoffice + FrontOffice) pour une boutique Prestashop 8.2.6(ExistingApp ar API REST webService XML de prestashop, via un proxy Vite pour éviter les CORS.en premier lieu, il faut faire marcher localement Prestashop qui est déjà faite puis comprendre les modules de ce e-commerce (produit, client, commande, etc..).
maintenant passons au cœur du projet de NewApp.
voici des notes et règles importante à respecter:
-dans ExistingApp, il faut s'assurer que: toutes les données importées sont visibles quelque part dans le backoffice de prestashop et que la modification des données aient un impact sur la NewApp.
-on utilisera aussi France comme Pays, et Euro comme devise
-l'échange des données avec l'API prestashop se fera au format XML uniquement

en J-1 voici ce qu'il faut faire:
-dans le Backoffice, il faut mettre un login/mdp qui est mise par défaut sur le formulaire.il est prioritaire de protéger les pages du backoffice(ceci doit passer par bcrypt). puis il faut crée r une page avec un bouton pour réinitialiser les données des modules du site. cela fait on créera une page pour importer les 4 fichiers: 3 fichiers cvs et 1 fichier zip pour les images. et enfin on créera une page pour afficher les commandes et modifier l'état de commande sont paiement effectué et annulé.
-dans le FrontOffice, on créera d'abord la page d'accueil pour afficher les produits avec leurs fiche de produits(nom du produit, description, nb en stock, prix, déclinaison). puis  on fera marcher le workflow d'achat c'est à dire la création de plusieurs pages pour la gestion des panier, la validation de commande ( avec uniquement le choix "paiemnet à la livraison" et pas de frais de livraison) et enfin la page mes commandes.

maintenant en J-2, il y a de nouvelles fonctionnalités et quelques modifications:
-dans le backoffice, les nouveaux états de commandes sont dans le panier, paiement effectué et annulé. ensuite, il faut créer un tableau de bord qui gère par jour le nombre de commande et les montants et aussi le total général.
-dans le FrontOffice, il faut changer la page d'accueil par défaut par une page qui affiche la liste des utilisateurs existants c'est à dire qu'on peut choisir avec quel utilisateur on veut se connecter. avec ceci un menu de la liste des produits pour les utilisateur "guest" qui veulent juste visiter le site et il faut aussi ajouter une option "utilisateur anonyme". ensuite mettre une marque sur les produits(voir date_availability_produit):HOT pour les produits sorties 1jour avant et NEW pour les produits sorties 1 semaines avant. et enfin implémenter une recherche multicritère par produit:nom, catégorie, intervalle de prix.

ensuite pour J-3, de nouvelles fonctionnalitées s'impose:
-pour le Backoffice, il faut vérifier les erreurs suivants dans l'import: nom de colonne non conforme, format de date différent de DD/MM/YYY et un montant positif. pui  il faut rajouter une pages qui permet d'ajouter en stock les poduits. après rajouter un tableau sur l'évolution du stock journalier d'un produit( par appel API).
-pour le FrontOffice, il faut afficher la quantité en stock disponible sur la fiche de produit.

enfin pour le J-4, quelques modifications s'appliquent:
-pour ExistingApp, il faut créer manuellement l'Endpoint pour gérer manuellement le chargement d'état de commande( on ajoute 2 autres types d'état de commande): livré(idOrderState=5) et annulé (idOrderState=6). utiliser cette Endpoint:
$order= new Order((int)$id_order);
$history = new OrderHistory();
$history->id_order=$order->id;
$history->changeIdOrderState(4,$order);
-pour NewApp, dans Backoffice, voici les nouvelles états de commande utilisées: dans le panier(pas encore dans commande mais dans cart), paiement effectué, annulé, livré. puis ajouter un bouton "annuler" et "livrer" dan sla liste des commandes. après ajouter une page statique( danssahboard) qui permet d'avoir le montant total des ventes (hors taxe), le montant total d'achat(déjà hors taxe, ce total est le total des achat des produits en ventes)et le bénéfuce par catégorie de produit. et enfin crée le tableau suivant:
catégorie|qté physique|qté reservé| qté disponible|
- - - - -|- - - - - - |- - - - - -|- - - - - - - -|
Habillement|    X     |     Y     |       Z       |

maintenant voici 3 aléas à faire:
-dans NewApp , dans Backoffice, il faut créer un checkbox ( sur l'import de l'image), dans la page import.ce chackbox permet d'importer ou non les images. si le chckbox est true, il peut être importer mais si il est false, il ne peut pas être importer.

-dans NewApp, dans "mes commandes" du frontoffice, sur chaque ligne de commandes (si l'état de commande est "paiement accepté" ou "livré" ), on ajoute un bouton "+commander" sur la ligne. ce bouton a pour fonction une sorte de duplication et la création d'une nouvelle commande : lorsqu'on appuie sur ce bouton , un petit popup(comme dans l'ajout de stock) apparait. dans ce popup, on aura l'id de la commande a dupliquer, les produits à dupliquer et un champs de multiplicateur (par défaut le nombre est 1 ). sur ce champs on insère des nombres de duplication de produits de commande( ex: dans une commande il y a 5 tshirts et 2 casquettes, lorsqu'on duplique cette commande et sur le champs on insère 2 donc les 5 tshirts est multiplié par 2 pareil pour les casquettes(5*2=10 et 2*2=4), ce qui nous fait que la nouvelle commande est 10 tshirts et 4 casquettes), puis cliquer sur le bouton "ajouter"(ce bouton permet l'ajout au panier d'une création d'une nouvelle commande) mais cette fois ci lorsqu'on click sur commander on est rediriger vers une page de "confirmation commande". dans cette page de confirmation se  trouvera la check de stock: si le stock est suffisant on peut confirmer la commande mais si le stock est insuffisant donc on ne peut pas confirmer la commande( affichage d'erreur, ex: manque de stock de n tshirt). la règle de gestion est que tous doit être valide pour pouvoir confirmer la commande(bouton "commande" bloquer). Apres la confirmation de la nouvelle commande, l'état de commande est tout de suite "livré" (donc il est déjà passer par "paiement effectué"(création de commande)) ce qui entraine la décrémentation de stock.

-dans le frontoffice de NewApp, dans la liste des produits: ajouter un lien "remove stock". quand on click sur ce lien, on demande le mot de passe de l'administrateur( si le mot de passe incorrecte, renvoie une erreur mais si le mot de passe est correcte, un popup apparait). 
ce popup a pour fonction de supprimer des stocks de produits dans une catégorie.dans ce popup: il y a une liste déroulante de sélection de catégorie et un champ input de quantité et un bouton "valider" c'est à dire qu'on choisit une catégorie à supprimer, on insère la quantité à supprimer et on valide(ex: on choisit la catégorie: akanjo, quantité à supprimer: 5. donc tous les stocks des produits de ce catégorie est décrémenter de 5 (appliquer aussi aux declinaison des produits)). le résultat (toujours dans un popup): un tableau affichant le catégorie , le quantité à supprimer(la quantité insérer dans le champs) et la somme des quantités de produits dont le stock est réduite.
règle de gestion: si la quantité insérer est plus grand que la quantité de produits en stock. le stock réduit ne devient pas négatif mais s'arrete à 0 (ex: si la quantité insérer est 5 et que la quantité du produits d'un catégorie est 2, la réduction de stock de ce produit devient 0 mais non négatif). cette action aura une impacte dans le stock.


maintenant voici la structure complète de NewApp:

Microsoft Windows [version 10.0.22000.2538]
(c) Microsoft Corporation. Tous droits réservés.

C:\xampp\htdocs\NewApp>tree /F
Structure du dossier
Le numéro de série du volume est 4E47-BE4E
C:.
│   .env
│   .gitattributes
│   alea.md
│   eslint.config.js
│   index.html
│   package-lock.json
│   package.json
│   projetGlobal.md
│   README.md
│   resume.md
│   vite.config.js
│
├───.claude
├───docs
├───documentation
├───node_modules
├───public
│
└───src
    │   App.jsx
    │   index.css
    │   main.jsx
    │
    ├───api
    │   │   axiosInstance.js
    │   │   xmlParser.js
    │   │
    │   ├───services
    │   │       authService.js
    │   │       categoriesService.js
    │   │       combinationsService.js
    │   │       customersService.js
    │   │       importService.js
    │   │       ordersService.js
    │   │       productService.js
    │   │       resetService.js
    │   │       stockMovementService.js
    │   │       stockService.js
    │   │
    │   └───utils
    │           csvToXml.js
    │           detectModules.js
    │           modulesConfig.js
    │           validateImport.js
    │
    ├───assets
    ├───components
    │       CategoriesList.jsx
    │       CombinationsList.jsx
    │       CustomersList.jsx
    │       Layout.css
    │       Layout.jsx
    │       List.css
    │       OrdersList.jsx
    │       ProductList.jsx
    │       ProtectedRoute.jsx
    │       ResetModuleItem.css
    │       ResetModuleItem.jsx
    │       StockList.jsx
    │
    ├───front
    │   │   FrontLayout.css
    │   │   FrontLayout.jsx
    │   │
    │   ├───hooks
    │   │       useMyOrders.js
    │   │       useProductDetail.js
    │   │
    │   ├───pages
    │   │       CartPage.css
    │   │       CartPage.jsx
    │   │       FrontHomePage.css
    │   │       FrontHomePage.jsx
    │   │       FrontLoginPage.css
    │   │       FrontLoginPage.jsx
    │   │       MyOrdersPage.css
    │   │       MyOrdersPage.jsx
    │   │       OrderConfirmPage.css
    │   │       OrderConfirmPage.jsx
    │   │       ProductPage.css
    │   │       ProductPage.jsx
    │   │       ShopPage.css
    │   │       ShopPage.jsx
    │   │
    │   └───services
    │           frontAuthService.js
    │           orderService.js
    │
    ├───hooks
    │       useAuth.js
    │       useEnrichedCategories.js
    │       useEnrichedCombinations.js
    │       useEnrichedCustomers.js
    │       useEnrichedOrders.js
    │       useEnrichedProducts.js
    │       useEnrichedStock.js
    │       usePrestaShop.js
    │       useProfitStats.js
    │       useStockMovements.js
    │
    └───pages
            Dashboard.css
            Dashboard.jsx
            ImportPage.css
            ImportPage.jsx
            LoginPage.css
            LoginPage.jsx
            ResetPage.css
            ResetPage.jsx
            StockEntryPage.css
            StockEntryPage.jsx
            StockHistoryPage.css
            StockHistoryPage.jsx

j'ai ici pour objectif d'apprendre à coder à la main à partir de ce projet et de faire ces 2 aléas en priorité. mais avant tous de comprendre le vrai fonctionnement et les codes de ce projet à savoir que j'ai déjà des codes existants à l'intérieur de ces fichier et je veux qu'on parte à partir de ces fichiers alors tu me demanderas les codes nécessaires.

j'ai déjà fini le 2ème aléa mais il y a des corrections à faire. je veux que tu retiens bien tous nos converstion pour ne pas dévier .
on va commencer petit à petit en commençant par ta compréhension de l'aléa

Voici la logique complète et corrigée de cet aléa dans le FrontOffice :Condition d'affichage : 
- Le bouton +commander apparaît sur chaque ligne de la page "Mes commandes" (MyOrdersPage.jsx), uniquement si l'état actuel est "paiement effectué" ou "livré".
- Le Popup de configuration : Au clic sur ce bouton, un popup s'ouvre et affiche :
    # L'ID de la commande à dupliquer.
    # La liste des produits contenus dans cette commande.
    # Un champ multiplicateur (qui vaut $1$ par défaut). Si l'utilisateur saisit $2$, les quantités initiales de chaque produit de la commande sont multipliées par 2 (ex: 5 t-shirts et 2 casquettes deviennent 10 t-shirts et 4 casquettes).
- Action du bouton "Ajouter" (Création du panier) : En cliquant sur "Ajouter", l'application prend ces produits multipliés pour créer un nouveau panier (Cart). Une fois ce panier virtuel initialisé, l'utilisateur est automatiquement redirigé vers la page de confirmation (OrderConfirmPage.jsx). 
- 🔄La Page de Confirmation & Vérification des stocks : C'est sur cette page que se fait la validation de sécurité :
    # L'application interroge l'API PrestaShop en XML pour vérifier si le stock disponible est suffisant pour tous les produits multipliés.
    # Règle bloquante : Si un seul produit manque de stock, un message d'erreur s'affiche (ex: "Manque de stock de n tshirt") et le bouton de confirmation finale est bloqué (désactivé). Tout doit être valide pour commander. 🛑
- Finalisation automatique à l'état "Livré" : Si le stock est suffisant et que l'utilisateur confirme, la commande est créée. Techniquement, elle passe d'abord par l'étape de création ("paiement effectué"), puis son état devient immédiatement "livré" ($idOrderState = 5$), ce qui déclenche la décrémentation des stocks dans PrestaShop. 📦

page d'accueil front:
liste des produits de asina lien ray "remove stock", rehefa mikitika anle remove stock de mantany mot de passe admin izy de raha diso le mot de passe de erreur raha marina de popup: choix catégorie et quantité stock esorina de raha kely le anaty stock de atao 0 de miala même quantité ny déclinaison. boutton "valider" manapotra anle résultat: catégorie, produits, qté tokony nesorina de qté tena niala de total anle tena niala (global)
