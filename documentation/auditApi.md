Audit complet des APIs par module
En croisant les APIs disponibles dans votre PrestaShop avec les tables concernées, voici l'audit complet :

Module Produits
API principale :
/api/products                     → CRUD produit principal

APIs liées (suppression en cascade recommandée) :
/api/combinations                 → déclinaisons du produit
/api/product_options              → attributs (Taille, Couleur...)
/api/product_option_values        → valeurs attributs (M, L, Bleu...)
/api/product_features             → caractéristiques (Matière, Poids...)
/api/product_feature_values       → valeurs caractéristiques
/api/product_customization_fields → champs personnalisation
/api/product_suppliers            → fournisseurs liés au produit
/api/stock_availables             → stock lié au produit

APIs NON supprimables directement :
/api/images/products              → ❌ DELETE non supporté
                                     (supprimé automatiquement
                                      quand le produit est supprimé)

Module Clients
API principale :
/api/customers                    → CRUD client principal

APIs liées :
/api/addresses                    → adresses du client
/api/orders                       → commandes du client
                                     (si on supprime le client
                                      ses commandes restent orphelines)

APIs NON concernées directement :
/api/groups                       → groupes (partagés, pas supprimables)
/api/genders                      → civilités (statiques, jamais supprimées)

Module Commandes
API principale :
/api/orders                       → CRUD commande principale

APIs liées :
/api/order_details                → produits dans la commande
/api/order_carriers               → transporteur de la commande
/api/order_cart_rules             → codes promo appliqués
/api/order_histories              → historique des états
/api/order_invoices               → factures liées
/api/order_payments               → paiements liés
/api/order_slip                   → bons d'avoir / remboursements

Module Catégories
API principale :
/api/categories                   → CRUD catégorie principale

APIs liées :
/api/products                     → produits dans la catégorie
                                     (liaison ps_category_product)

APIs NON supprimables :
Catégories id=1 et id=2           → réservées PrestaShop (racine + accueil)
                                     ne jamais supprimer

Module Stock
API principale :
/api/stock_availables             → quantités disponibles par produit

APIs liées :
/api/stocks                       → stock multi-entrepôt
/api/stock_movements              → historique des mouvements de stock
/api/stock_movement_reasons       → raisons des mouvements
                                     (statiques, pas supprimables)

Module Déclinaisons
API principale :
/api/combinations                 → CRUD déclinaison principale

APIs liées :
/api/product_options              → attributs (Taille, Couleur...)
/api/product_option_values        → valeurs (M, L, Bleu, Rouge...)
/api/stock_availables             → stock par déclinaison
                                     (id_product_attribute > 0)

Réponse à vos questions
Est-ce que la réinitialisation produit touche les autres modules automatiquement ?
✅ Oui pour :
   - ps_product_lang         (supprimé en cascade par PrestaShop)
   - ps_category_product     (supprimé en cascade)
   - ps_image                (supprimé en cascade)

❌ Non pour (à faire manuellement via API) :
   - /api/combinations       → restent orphelines
   - /api/stock_availables   → restent orphelines
   - /api/product_features   → restent orphelines
   - /api/product_suppliers  → restent orphelines

Plan de la nouvelle ResetPage
Étape 1 : Compter les items de chaque API
          GET /api/[endpoint]?display=full
          → afficher le nombre sur chaque ligne

Étape 2 : Checklist modulaire
          Chaque module = section dépliable
          Chaque API = ligne avec checkbox + nb items

Étape 3 : Bouton Tout Supprimer
          → supprime uniquement les APIs cochées
          → dans l'ordre pour éviter les conflits
            (ex: supprimer combinations avant products)

Étape 4 : Rapport
          → nb supprimés par API
          → erreurs éventuelles

Ordre de suppression recommandé
L'ordre est crucial pour éviter les erreurs de clés étrangères :
1. order_slip          (dépend de orders)
2. order_payments      (dépend de orders)
3. order_invoices      (dépend de orders)
4. order_histories     (dépend de orders)
5. order_cart_rules    (dépend de orders)
6. order_carriers      (dépend de orders)
7. order_details       (dépend de orders)
8. orders              (dépend de customers)
9. addresses           (dépend de customers)
10. customers          (table principale)
11. stock_availables   (dépend de products + combinations)
12. stock_movements    (dépend de stocks)
13. combinations       (dépend de products)
14. product_option_values (dépend de product_options)
15. product_options    (indépendant)
16. product_features   (dépend de products)
17. product_feature_values (dépend de product_features)
18. product_suppliers  (dépend de products)
19. product_customization_fields (dépend de products)
20. products           (table principale)
21. categories         (sauf id 1 et 2)


Okey je valide ceci, et on peut lister les modules dans l'ordre de supression que tu as donnee