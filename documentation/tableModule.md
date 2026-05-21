### Produits — tables concernées
    ps_product                → données principales
    ps_product_lang           → nom, description (multilingue)
    ps_category_product       → liaison produit ↔ catégorie
    ps_category / _lang       → nom des catégories
    ps_image                  → images du produit
    ps_stock_available        → quantité disponible
    ps_tax_rule / ps_tax      → taux de TVA → calcul TTC
    ps_manufacturer           → marque/fabricant
    ps_product_attribute      → déclinaisons liées
Ce qu'on affichera :
ID | Image | Nom | Catégorie | Référence | Prix HT | Prix TTC | Quantité | État

### Clients — tables concernées
    ps_customer               → données principales
    ps_address                → adresses liées
    ps_orders                 → nombre de commandes passées
    ps_gender / _lang         → civilité (M. / Mme)
    ps_group / _lang          → groupe client (VIP, Client, etc.)
Ce qu'on affichera :
ID | Civilité | Nom Prénom | Email | Groupe | Nb commandes | Date inscription | État

### Commandes — tables concernées
    ps_orders                 → données principales
    ps_customer               → nom du client
    ps_address                → adresse livraison
    ps_order_state / _lang    → état (Payé, Expédié, Livré...)
    ps_order_detail           → produits dans la commande
    ps_currency               → devise (EUR, USD...)
    ps_carrier                → transporteur
Ce qu'on affichera :
ID | Référence | Client | Total HT | Total TTC | Devise | État | Date

### Catégories — tables concernées
    ps_category               → données principales
    ps_category_lang          → nom, description (multilingue)
    ps_category (parent)      → nom catégorie parente
    ps_category_product       → nombre de produits liés
Ce qu'on affichera :
ID | Nom | Catégorie parente | Nb produits | État

### Stock — tables concernées
    ps_stock_available        → quantité disponible par produit
    ps_product / _lang        → nom du produit lié
    ps_product_attribute      → déclinaison liée si existe
Ce qu'on affichera :
ID | Produit | Déclinaison | Quantité | En rupture | Dépend stock avancé

### Déclinaisons — tables concernées
    ps_product_attribute          → données principales
    ps_product_attribute_combination → liaison attribut ↔ valeur
    ps_attribute / _lang          → nom attribut (Taille, Couleur...)
    ps_attribute_value / _lang    → valeur (M, L, Bleu, Rouge...)
    ps_product / _lang            → produit parent
Ce qu'on affichera :
ID | Produit parent | Attributs (Taille: M, Couleur: Bleu) | Référence | Impact prix