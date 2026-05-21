### display=full
    PrestaShop API supporte le paramètre ?display=full qui renvoie tous les champs d'une ressource au lieu d'une liste d'IDs.       
    Exemple :
    GET /api/products?display=full&language=1
    → renvoie TOUS les produits avec TOUS leurs champs
    au lieu de juste la liste des IDs
    Avantages :
    Sans display=full :
    1 appel pour liste IDs → N appels pour chaque détail
    = 1 + N requêtes

    Avec display=full :
    1 seul appel → tout en une fois
    = 1 requête beaucoup plus rapide

### Utilisation
    Étape 1 : GET /api/products?display=full&language=1
          → tous les produits avec leurs champs + id_category, id_manufacturer...

    Étape 2 : GET /api/categories?display=full&language=1
            → toutes les catégories en une requête

    Étape 3 : GET /api/stock_availables?display=full
            → tout le stock en une requête

    Étape 4 : Jointure côté React (JS)
            → on associe produit ↔ catégorie ↔ stock
                par correspondance d'IDs
Ce pattern s'appelle data enrichment côté client. On charge tout en parallèle puis on joint en JS.