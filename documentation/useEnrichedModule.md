# Hooks `useEnriched[Module]`

## Rôle
Les hooks `useEnriched` récupèrent les données d'un module PrestaShop
enrichies avec leurs données associées via d'autres endpoints de l'API.
Ils utilisent le pattern **data enrichment côté client** :
toutes les données sont chargées en parallèle puis jointes en JS.

## Localisation
`src/hooks/useEnriched[Module].js`
Ex : `useEnrichedProducts.js`, `useEnrichedCustomers.js`, etc.


src/hooks/
├── usePrestaShop.js            ← hook générique (base)
├── useEnrichedProducts.js      ← produits + catégories + stock + TVA + fabricant
├── useEnrichedCustomers.js     ← clients + groupes + civilité + nb commandes
├── useEnrichedOrders.js        ← commandes + clients + états + devise + transporteur
├── useEnrichedCategories.js    ← catégories + parente + nb produits
├── useEnrichedStock.js         ← stock + produits + déclinaisons
└── useEnrichedCombinations.js  ← déclinaisons + produits + attributs + stock

---

## Pattern général

Tous les hooks `useEnriched` suivent exactement la même structure
en 4 étapes :
    Étape 1 : Promise.all
    → toutes les requêtes lancées en parallèle
    → évite les requêtes séquentielles (plus rapide)
    Étape 2 : toArray()
    → normalise chaque réponse en tableau
    → gère les cas : undefined, objet seul, tableau
    Étape 3 : Construction des Maps
    → une Map par donnée associée
    → accès en O(1) par ID au lieu de O(n) avec find()
    Étape 4 : Enrichissement
    → pour chaque item du module principal
    → on joint les données via les Maps
    → on retourne un objet enrichi propre

---

## Helpers partagés

Ces deux helpers sont utilisés dans tous les hooks `useEnriched`.
Ils peuvent être centralisés dans `src/api/utils/prestashopHelpers.js`
et importés dans chaque hook.

### `getVal(field)`

PrestaShop renvoie ses champs sous 3 formes possibles :
- Valeur simple : `"100.00"`, `1`, `"Peter"`
- Objet xlink : `{ '#text': 2, '@_xlink:href': 'http://...' }`
- Absent : `undefined` ou `null`

`getVal` extrait toujours la valeur utilisable :

```js
export const getVal = (field) => {
  if (field === null || field === undefined) return null
  if (typeof field === 'object') {
    if (field['#text'] !== undefined) return field['#text']
    return null
  }
  return field
}
```

| Entrée | Sortie |
|--------|--------|
| `"100.00"` | `"100.00"` |
| `1` | `1` |
| `{ '#text': 2, '@_xlink:href': '...' }` | `2` |
| `undefined` | `null` |
| `null` | `null` |
| `{}` | `null` |

### `toArray(data)`

PrestaShop renvoie une liste différemment selon le nombre d'éléments :
- 0 élément → `undefined`
- 1 élément → un objet seul
- 2+ éléments → un tableau

`toArray` normalise toujours en tableau :

```js
const toArray = (data) => {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}
```

| Entrée | Sortie |
|--------|--------|
| `undefined` | `[]` |
| `{ id: 1 }` | `[{ id: 1 }]` |
| `[{ id: 1 }, { id: 2 }]` | `[{ id: 1 }, { id: 2 }]` |

### `fetchAll(endpoint, language)`

Récupère tous les items d'un endpoint avec `display=full` :

```js
const fetchAll = async (endpoint, language = 1) => {
  const params = new URLSearchParams({ display: 'full', language })
  const response = await axiosInstance.get(`/${endpoint}?${params}`)
  return parseXML(response.data)
}
```

---

## Structure type d'un hook `useEnriched`

```js
const useEnriched[Module] = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEnriched = async () => {
      try {
        // Étape 1 : Requêtes en parallèle
        const [mainData, relatedData1, relatedData2] = await Promise.all([
          fetchAll('endpoint_principal'),
          fetchAll('endpoint_associe_1'),
          fetchAll('endpoint_associe_2'),
        ])

        // Étape 2 : Normalisation
        const rawMain     = toArray(mainData?.prestashop?.[module]?.[item])
        const rawRelated1 = toArray(relatedData1?.prestashop?.[...])
        const rawRelated2 = toArray(relatedData2?.prestashop?.[...])

        // Étape 3 : Maps pour jointure rapide
        const related1Map = {}
        rawRelated1.forEach((r) => {
          related1Map[getVal(r.id)] = r.name || '—'
        })

        // Étape 4 : Enrichissement
        const enriched = rawMain.map((item) => ({
          id: getVal(item.id),
          name: item.name?.language?.['#text'] || '—',
          relatedField: related1Map[getVal(item.id_related)] || '—',
          raw: item,
        }))

        setItems(enriched)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchEnriched()
  }, [])

  return { items, loading, error }
}
```

---

## Valeur retournée (tous les hooks)

| Propriété | Type | Description |
|-----------|------|-------------|
| `[module]` | `array` | Liste des items enrichis |
| `loading` | `boolean` | `true` pendant le chargement |
| `error` | `string \| null` | Message d'erreur si échec |

---

## Exemple complet — `useEnrichedProducts`

### Endpoints utilisés

| Endpoint | Données récupérées | Utilité |
|----------|--------------------|---------|
| `products` | Données principales | Base |
| `categories` | Nom, id_parent | Catégorie et parente |
| `stock_availables` | quantity | Quantité en stock |
| `tax_rule_groups` | name | Groupe de taxe |
| `manufacturers` | name | Fabricant / marque |

### Maps construites

| Map | Clé | Valeur |
|-----|-----|--------|
| `categoryMap` | `id_category` | `{ id, name, parentId }` |
| `stockMap` | `id_product` | `quantity` |
| `taxMap` | `id_tax_rule_group` | `name` |
| `manufacturerMap` | `id_manufacturer` | `name` |

### Structure d'un produit enrichi

```js
{
  id: 1,
  name: "iPod Nano",
  reference: "RP-demo_1",
  priceHT: "100.00",
  priceTTC: "120.00",
  quantity: 160,
  active: 1,
  manufacturer: "Apple",
  categoryDefault: "iPods",
  categoryParent: "Électronique",
  imageUrl: "http://localhost/.../images/products/1/1",
  raw: { /* objet brut PrestaShop */ }
}
```

---

## Différences majeures selon le module

### Clients (`useEnrichedCustomers`)

Endpoints supplémentaires :
- `groups` → groupe client (VIP, Customer...)
- `genders` → civilité (M. / Mme)
- `addresses` → comptage adresses par client
- `orders` → comptage commandes par client

Particularité — pattern de comptage :
```js
const orderCountMap = {}
rawOrders.forEach((o) => {
  const cid = String(getVal(o.id_customer))
  orderCountMap[cid] = (orderCountMap[cid] || 0) + 1
})
```

### Commandes (`useEnrichedOrders`)

Endpoints supplémentaires :
- `customers` → nom du client
- `order_states` → libellé état (Payé, Expédié...)
- `currencies` → devise (EUR, USD...)
- `carriers` → transporteur

Particularité — les commandes ont `total_paid_tax_incl`
et `total_paid_tax_excl` directement dans l'objet,
pas besoin de calculer la TVA.

### Catégories (`useEnrichedCategories`)

Particularité — la catégorie parente est dans
la même table `categories` :
```js
// La map pointe vers elle-même
const parentName = categoryMap[getVal(cat.id_parent)]?.name || '—'
```

### Stock (`useEnrichedStock`)

Particularité — jointure avec `products` pour
afficher le nom du produit au lieu de juste l'ID :
```js
const productName = productMap[getVal(s.id_product)]?.name || '—'
```

### Déclinaisons (`useEnrichedCombinations`)

Endpoints supplémentaires :
- `products` → nom du produit parent
- `product_options` → nom de l'attribut (Taille, Couleur...)
- `product_option_values` → valeur (M, L, Bleu...)

---

## Notes importantes (tous les hooks)

- `Promise.all` est obligatoire : les requêtes
  séquentielles seraient 5x plus lentes
- Les Maps donnent un accès O(1) par ID :
  ne jamais utiliser `.find()` dans la boucle d'enrichissement
- Le champ `raw` garde les données brutes PrestaShop
  pour accéder aux champs non mappés sans refaire une requête
- Toujours convertir les IDs en `String` pour les Maps
  car PrestaShop peut renvoyer `1` ou `"1"` selon le champ
- Les champs multilingues sont accessibles via :
  `field?.language?.['#text']` ou `field?.language`
  selon si le parser XML a trouvé du texte ou non