// src/api/utils/modulesConfig.js

export const MODULES_CONFIG = {
  products: {
    label: 'Produits',
    apiEndpoint: 'products',
    xmlTag: 'product',
    multilingualFields: [
      'name', 'description', 'description_short',
      'meta_title', 'meta_keywords', 'meta_description', 'link_rewrite'
    ],
    md5Fields: [],

    detectionSignatures: {
      'nom':                    { xml: 'name',            weight: 3 },
      'name':                   { xml: 'name',            weight: 3 },
      'reference':              { xml: 'reference',       weight: 3 },
      'ref':                    { xml: 'reference',       weight: 2 },
      'prix_ttc':               { xml: 'price',           weight: 2 },
      'price':                  { xml: 'price',           weight: 2 },
      'prix_achat':             { xml: 'wholesale_price', weight: 2 },
      'wholesale_price':        { xml: 'wholesale_price', weight: 1 },
      'date_availability_produit': { xml: 'available_date', weight: 2 },
      'description':            { xml: 'description',     weight: 1 },
      'actif':                  { xml: 'active',          weight: 1 },
      'active':                 { xml: 'active',          weight: 1 },
    },
    detectionThreshold: 4,
    importOrder: 3,

    registryKey: (row) => row['reference'] || row['Reference'] || row['ref'] || '',
    resolvers: {
      id_tax_rules_group: { registryModule: 'taxes',      lookupField: 'Taxe' },
      id_category_default: { registryModule: 'categories', lookupField: 'categorie' },
    },

    requiredFields: [
      { csv: 'Name *',               xml: 'name',          desc: 'Nom du produit' },
      { csv: 'Price tax excluded',   xml: 'price',         desc: 'Prix HT' },
      { csv: 'Active (0/1)',         xml: 'active',        desc: 'Produit actif' },
    ],
    optionalFields: [
      { csv: 'Reference #',          xml: 'reference',         desc: 'Référence' },
      { csv: 'Description',          xml: 'description',       desc: 'Description longue' },
      { csv: 'Summary',              xml: 'description_short', desc: 'Description courte' },
      { csv: 'Wholesale price',      xml: 'wholesale_price',   desc: 'Prix grossiste' },
      { csv: 'On sale (0/1)',        xml: 'on_sale',           desc: 'En promotion' },
      { csv: 'EAN13',                xml: 'ean13',             desc: 'Code EAN13' },
      { csv: 'UPC',                  xml: 'upc',               desc: 'Code UPC' },
      { csv: 'Width',                xml: 'width',             desc: 'Largeur' },
      { csv: 'Height',               xml: 'height',            desc: 'Hauteur' },
      { csv: 'Depth',                xml: 'depth',             desc: 'Profondeur' },
      { csv: 'Weight',               xml: 'weight',            desc: 'Poids' },
      { csv: 'Quantity',             xml: 'quantity',          desc: 'Quantité en stock' },
      { csv: 'Minimal quantity',     xml: 'minimal_quantity',  desc: 'Quantité minimale' },
      { csv: 'Visibility',           xml: 'visibility',        desc: 'Visibilité' },
      { csv: 'Condition',            xml: 'condition',         desc: 'État (new/used...)' },
      { csv: 'Available for order (0 = No, 1 = Yes)', xml: 'available_for_order', desc: 'Disponible à la commande' },
      { csv: 'Show price (0 = No, 1 = Yes)',          xml: 'show_price',          desc: 'Afficher le prix' },
      { csv: 'Tax rules ID',         xml: 'id_tax_rules_group', desc: 'Règle de taxe' },
      { csv: 'Meta title',           xml: 'meta_title',        desc: 'Titre SEO' },
      { csv: 'Meta keywords',        xml: 'meta_keywords',     desc: 'Mots-clés SEO' },
      { csv: 'Meta description',     xml: 'meta_description',  desc: 'Description SEO' },
      { csv: 'URL rewritten',        xml: 'link_rewrite',      desc: 'URL simplifiée' },
    ],

    reset: {
      order: 5,
      mainEndpoint: 'products',
      label: 'Produits',
      countEndpoint: 'products',
      subEntities: [
        { key: 'images',                       label: 'Images',                        endpoint: 'images' },
        { key: 'combinations',                 label: 'Combinations',                 endpoint: 'combinations' },
        { key: 'product_customization_fields', label: 'Product Customization Fields', endpoint: 'product_customization_fields' },
        { key: 'product_option_values',        label: 'Product Option Values',        endpoint: 'product_option_values' },
        { key: 'product_options',              label: 'Product Options',              endpoint: 'product_options' },
        { key: 'product_feature_values',       label: 'Product Feature Values',       endpoint: 'product_feature_values' },
        { key: 'product_suppliers',            label: 'Product Suppliers',            endpoint: 'product_suppliers' },
        { key: 'product_features',             label: 'Product Features',             endpoint: 'product_features' },
      ]
    }
  },

  customers: {
    label: 'Clients',
    apiEndpoint: 'customers',
    xmlTag: 'customer',
    multilingualFields: [],
    md5Fields: ['passwd'],

    detectionSignatures: {
      'email':      { xml: 'email',     weight: 4 },
      'pwd':        { xml: 'passwd',    weight: 3 },
      'password':   { xml: 'passwd',    weight: 3 },
      'passwd':     { xml: 'passwd',    weight: 3 },
      'nom':        { xml: 'lastname',  weight: 1 },
      'name':       { xml: 'lastname',  weight: 1 },
      'adresse':    { xml: 'address',   weight: 2 },
      'address':    { xml: 'address',   weight: 2 },
      'prenom':     { xml: 'firstname', weight: 2 },
      'firstname':  { xml: 'firstname', weight: 2 },
    },
    detectionThreshold: 4,
    importOrder: 6,

    registryKey: (row) => row['email'] || row['Email'] || '',

    requiredFields: [
      { csv: 'Last Name *',   xml: 'lastname',  desc: 'Nom de famille' },
      { csv: 'First Name *',  xml: 'firstname', desc: 'Prénom' },
      { csv: 'Email *',       xml: 'email',     desc: 'Adresse email' },
      { csv: 'Password *',    xml: 'passwd',    desc: 'Mot de passe (hashé MD5)' },
    ],
    optionalFields: [
      { csv: 'Active (0/1)',                          xml: 'active',           desc: 'Compte actif' },
      { csv: 'Birthday (yyyy-mm-dd)',                 xml: 'birthday',         desc: 'Date de naissance' },
      { csv: 'Titles ID (Mr = 1, Ms = 2, else 0)',   xml: 'id_gender',        desc: 'Civilité' },
      { csv: 'Newsletter (0/1)',                      xml: 'newsletter',       desc: 'Abonné newsletter' },
      { csv: 'Opt-in (0/1)',                          xml: 'optin',            desc: 'Opt-in partenaires' },
      { csv: 'Default group ID',                      xml: 'id_default_group', desc: 'Groupe par défaut' },
    ],

    reset: {
      order: 2,
      mainEndpoint: 'customers',
      label: 'Clients',
      countEndpoint: 'customers',
      // id=1 = compte anonyme PS — ne jamais supprimer
      protectedIds: ['1'],
      subEntities: [
        { key: 'addresses',           label: 'Addresses',             endpoint: 'addresses' },
        { key: 'customer_threads',    label: 'Customer Threads',      endpoint: 'customer_threads' },
        { key: 'customers_messages',  label: 'Customer Messages',     endpoint: 'customer_messages' },
        { key: 'carts',               label: 'Carts',                 endpoint: 'carts' },
        { key: 'cart_rules',          label: 'Cart Rules',            endpoint: 'cart_rules' },
        { key: 'guests',              label: 'Guests',                endpoint: 'guests' },
      ],
      // Adresses protégées : id=1 = adresse du compte anonyme PS
      protectedAddressIds: ['1'],
    }
  },

  orders: {
    label: 'Commandes',
    apiEndpoint: 'orders',
    xmlTag: 'order',
    multilingualFields: [],
    md5Fields: [],

    detectionSignatures: {
      'achat':          { xml: 'products',      weight: 3 },
      'etat':           { xml: 'current_state', weight: 2 },
      'state':          { xml: 'current_state', weight: 2 },
      'total_paid':     { xml: 'total_paid',    weight: 2 },
      'payment':        { xml: 'payment',       weight: 2 },
      'id_customer':    { xml: 'id_customer',   weight: 2 },
    },
    detectionThreshold: 3,
    importOrder: 7,

    resolvers: {
      id_customer: { registryModule: 'customers', lookupField: 'email' },
    },

    requiredFields: [
      { csv: 'Total paid *',    xml: 'total_paid',   desc: 'Total payé' },
      { csv: 'Payment *',       xml: 'payment',      desc: 'Mode de paiement' },
      { csv: 'Customer ID *',   xml: 'id_customer',  desc: 'ID du client' },
    ],
    optionalFields: [
      { csv: 'Currency ID *',   xml: 'id_currency',  desc: 'ID de la devise' },
      { csv: 'Language ID *',   xml: 'id_lang',      desc: 'ID de la langue' },
    ],

    reset: {
      order: 1,
      mainEndpoint: 'orders',
      label: 'Commandes',
      countEndpoint: 'orders',
      subEntities: [
        { key: 'order_carriers',      label: 'Order Carriers',        endpoint: 'order_carriers' },
        { key: 'order_cart_rules',    label: 'Order Cart Rules',      endpoint: 'order_cart_rules' },
        { key: 'order_details',       label: 'Order Details',         endpoint: 'order_details' },
        { key: 'order_histories',     label: 'Order Histories',       endpoint: 'order_histories' },
        { key: 'order_invoices',      label: 'Order Invoices',        endpoint: 'order_invoices' },
        { key: 'order_payments',      label: 'Order Payments',        endpoint: 'order_payments' },
        { key: 'order_slip',          label: 'Order Slip',            endpoint: 'order_slip' },
        // order_states = configuration système PS (PS_OS_WS_PAYMENT, etc.) — ne jamais supprimer
      ]
    }
  },

  categories: {
    label: 'Catégories',
    apiEndpoint: 'categories',
    xmlTag: 'category',
    multilingualFields: ['name', 'description', 'meta_title', 'meta_keywords', 'meta_description', 'link_rewrite'],
    md5Fields: [],

    detectionSignatures: {
      'categorie':  { xml: 'name',   weight: 4 },
      'category':   { xml: 'name',   weight: 4 },
      'cat':        { xml: 'name',   weight: 2 },
    },
    detectionThreshold: 2,
    importOrder: 2,

    registryKey: (row) => row['categorie'] || row['category'] || row['cat'] || '',

    requiredFields: [
      { csv: 'Name *',        xml: 'name',   desc: 'Nom de la catégorie' },
      { csv: 'Active (0/1)',  xml: 'active', desc: 'Catégorie active' },
    ],
    optionalFields: [
      { csv: 'Description',      xml: 'description',      desc: 'Description' },
      { csv: 'Meta title',       xml: 'meta_title',       desc: 'Titre SEO' },
      { csv: 'Meta keywords',    xml: 'meta_keywords',    desc: 'Mots-clés SEO' },
      { csv: 'Meta description', xml: 'meta_description', desc: 'Description SEO' },
      { csv: 'URL rewritten',    xml: 'link_rewrite',     desc: 'URL simplifiée' },
    ],

    reset: {
      order: 6,
      mainEndpoint: 'categories',
      label: 'Catégories',
      countEndpoint: 'categories',
      subEntities: [
        { key: 'tags', label: 'Tags', endpoint: 'tags' },
        // content_management_system = pages CMS PS (CGV, mentions légales…) — configuration système, ne pas supprimer
      ],
      protectedIds: ['1', '2']
    }
  },

  combinations: {
    label: 'Déclinaisons',
    apiEndpoint: 'combinations',
    xmlTag: 'combination',
    multilingualFields: [],
    md5Fields: [],

    detectionSignatures: {
      'specificite':        { xml: 'attribute_type',  weight: 3 },
      'specificité':        { xml: 'attribute_type',  weight: 3 },
      'karazany':           { xml: 'attribute_value', weight: 3 },
      'couleur':            { xml: 'attribute_value', weight: 2 },
      'taille':             { xml: 'attribute_value', weight: 2 },
      'prix_vente_ttc':     { xml: 'price',           weight: 2 },
    },
    detectionThreshold: 3,
    importOrder: 4,

    registryKey: (row) => {
      const ref = row['reference'] || row['Reference'] || ''
      const val = row['karazany'] || row['specificité'] || row['specificite'] || ''
      return val ? `${ref}|${val}` : ref
    },

    resolvers: {
      id_product: { registryModule: 'products', lookupField: 'reference' },
    },

    requiredFields: [
      { csv: 'Product ID *',                    xml: 'id_product', desc: 'ID du produit parent' },
      { csv: 'Attribute (Name:Type:Position)*', xml: 'reference',  desc: 'Attribut de déclinaison' },
    ],
    optionalFields: [
      { csv: 'Reference #',     xml: 'reference',       desc: 'Référence' },
      { csv: 'EAN13',           xml: 'ean13',           desc: 'Code EAN13' },
      { csv: 'Wholesale price', xml: 'wholesale_price', desc: 'Prix grossiste' },
      { csv: 'Impact on price', xml: 'price',           desc: 'Impact sur le prix' },
      { csv: 'Quantity',        xml: 'quantity',        desc: 'Quantité' },
    ],

    reset: {
      order: 3,
      mainEndpoint: 'combinations',
      label: 'Déclinaisons',
      countEndpoint: 'combinations',
      subEntities: [
        { key: 'stock_availables', label: 'Stock lié aux déclinaisons', endpoint: 'stock_availables' },
      ],
      protectedIds: []
    }
  },

  stock: {
    label: 'Stock',
    apiEndpoint: 'stock_availables',
    xmlTag: 'stock_available',
    multilingualFields: [],
    md5Fields: [],

    detectionSignatures: {
      'stock_initial':    { xml: 'quantity', weight: 4 },
      'stock':            { xml: 'quantity', weight: 2 },
      'quantity':         { xml: 'quantity', weight: 2 },
      'quantite':         { xml: 'quantity', weight: 2 },
    },
    detectionThreshold: 2,
    importOrder: 5,

    resolvers: {
      id_product: { registryModule: 'products', lookupField: 'reference' },
    },

    requiredFields: [
      { csv: 'Product ID *', xml: 'id_product', desc: 'ID du produit' },
      { csv: 'Quantity *',   xml: 'quantity',   desc: 'Quantité disponible' },
    ],
    optionalFields: [
      { csv: 'Depends on stock', xml: 'depends_on_stock', desc: 'Dépend du stock avancé' },
      { csv: 'Out of stock',     xml: 'out_of_stock',     desc: 'Comportement rupture' },
    ],

    reset: {
      order: 4,
      mainEndpoint: 'stock_availables',
      label: 'Stock',
      countEndpoint: 'stock_availables',
      subEntities: [
        { key: 'stock_movements',             label: 'Stock Movements',            endpoint: 'stock_movements' },
        // stock_movement_reasons = raisons PS pré-installées (retour client, correction…) — configuration système, ne pas supprimer
        { key: 'stocks',                      label: 'Stocks',                     endpoint: 'stocks' },
        { key: 'warehouse_product_locations', label: 'Warehouse Product Locations', endpoint: 'warehouse_product_locations' },
      ]
    }
  },

  taxes: {
    label: 'Prix & Taxes',
    apiEndpoint: 'taxes',
    xmlTag: 'tax',
    multilingualFields: ['name'],
    md5Fields: [],

    detectionSignatures: {
      'taxe':       { xml: 'rate', weight: 4 },
      'tax':        { xml: 'rate', weight: 4 },
      'tva':        { xml: 'rate', weight: 4 },
      'taux':       { xml: 'rate', weight: 3 },
    },
    detectionThreshold: 2,
    importOrder: 1,

    registryKey: (row) => {
      const raw = row['Taxe'] || row['taxe'] || row['tax'] || row['tva'] || row['taux'] || ''
      return String(raw).replace(',', '.').replace('%', '').trim()
    },

    requiredFields: [
      { csv: 'Tax Name *', xml: 'name', desc: 'Nom de la taxe' },
      { csv: 'Rate *',     xml: 'rate', desc: 'Taux (ex: 20 pour 20%)' },
    ],
    optionalFields: [
      { csv: 'Active (0/1)', xml: 'active', desc: 'Taxe active' },
    ],

    reset: {
      order: 9,
      mainEndpoint: 'taxes',
      label: 'Taxes',
      countEndpoint: 'taxes',
      subEntities: [
        { key: 'specific_prices',      label: 'Specific Prices',      endpoint: 'specific_prices' },
        { key: 'tax_rules',            label: 'Tax Rules',            endpoint: 'tax_rules' },
        { key: 'tax_rule_groups',     label: 'Tax Rules Groups',     endpoint: 'tax_rule_groups' },
      ]
    }
  },

  suppliers: {
    label: 'Fournisseurs',
    apiEndpoint: 'suppliers',
    xmlTag: 'supplier',
    detectionSignatures: {},
    detectionThreshold: 99,
    importOrder: 8,
    reset: {
      order: 7,
      mainEndpoint: 'suppliers',
      label: 'Fournisseurs',
      countEndpoint: 'suppliers',
      subEntities: [
        { key: 'product_suppliers', label: 'Product Suppliers', endpoint: 'product_suppliers' },
      ]
    }
  },

  manufacturers: {
    label: 'Marques / Fabricants',
    apiEndpoint: 'manufacturers',
    xmlTag: 'manufacturer',
    detectionSignatures: {},
    detectionThreshold: 99,
    importOrder: 9,
    reset: {
      order: 8,
      mainEndpoint: 'manufacturers',
      label: 'Marques',
      countEndpoint: 'manufacturers',
      subEntities: []
    }
  },

  warehouses: {
    label: 'Entrepôts & Approvisionnement',
    apiEndpoint: 'warehouses',
    xmlTag: 'warehouse',
    detectionSignatures: {},
    detectionThreshold: 99,
    importOrder: 10,
    reset: {
      order: 3,
      mainEndpoint: 'warehouses',
      label: 'Entrepôts',
      countEndpoint: 'warehouses',
      subEntities: [
        { key: 'deliveries',                    label: 'Deliveries',                   endpoint: 'deliveries' },
        { key: 'supply_orders',                 label: 'Supply Orders',                endpoint: 'supply_orders' },
        { key: 'supply_order_details',          label: 'Supply Order Details',         endpoint: 'supply_order_details' },
        { key: 'supply_order_histories',        label: 'Supply Order Histories',       endpoint: 'supply_order_histories' },
      ]
    }
  },
}

export const MODULE_KEYS = Object.keys(MODULES_CONFIG)

export const getResetOrder = () => {
  return MODULE_KEYS
    .map(key => ({ key, ...MODULES_CONFIG[key].reset }))
    .sort((a, b) => a.order - b.order)
}

export const getImportOrder = () => {
  return MODULE_KEYS
    .filter(key => MODULES_CONFIG[key].importOrder !== undefined)
    .sort((a, b) => MODULES_CONFIG[a].importOrder - MODULES_CONFIG[b].importOrder)
}

export const TYPE_COLUMN_NAMES = ['type', 'Type', 'module', 'Module', 'entity', 'Entity']