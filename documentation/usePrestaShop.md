# Hook `usePrestaShop`

## Rôle
Hook React générique pour récupérer des données depuis n'importe quel
endpoint de l'API PrestaShop. Gère automatiquement `display=full`,
`language`, le parsing XML et les états loading/error.

## Localisation
`src/hooks/usePrestaShop.js`

## Paramètres

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `endpoint` | `string` | — | Endpoint API sans slash (ex: `products`) |
| `options.displayFull` | `boolean` | `true` | Ajoute `?display=full` pour récupérer tous les champs |
| `options.language` | `number` | `1` | ID de la langue PrestaShop |
| `options.params` | `object` | `{}` | Paramètres query supplémentaires |
| `options.skip` | `boolean` | `false` | Si `true`, ne fait pas la requête |

## Valeur retournée

| Propriété | Type | Description |
|-----------|------|-------------|
| `data` | `object \| null` | Données parsées depuis le XML |
| `loading` | `boolean` | `true` pendant la requête |
| `error` | `string \| null` | Message d'erreur si échec |

## Pourquoi `display=full` ?

Sans `display=full` :
- PrestaShop renvoie uniquement une liste d'IDs
- Il faut ensuite faire N appels pour récupérer chaque détail
- Total : 1 + N requêtes

Avec `display=full` :
- PrestaShop renvoie tous les champs directement
- Total : 1 seule requête

## Exemple d'utilisation — Produits

```jsx
import usePrestaShop from '../hooks/usePrestaShop'

const ProductList = () => {
  const { data, loading, error } = usePrestaShop('products')

  if (loading) return <p>Chargement...</p>
  if (error) return <p>Erreur : {error}</p>

  const products = data?.prestashop?.products?.product
  const arr = Array.isArray(products) ? products : [products]

  return (
    <ul>
      {arr.map(p => <li key={p.id}>{p.name?.language?.['#text']}</li>)}
    </ul>
  )
}
```

## Généralisation — autres endpoints

Remplacez simplement `'products'` par n'importe quel endpoint :

```js
usePrestaShop('customers')       // Clients
usePrestaShop('orders')          // Commandes
usePrestaShop('categories')      // Catégories
usePrestaShop('combinations')    // Déclinaisons
usePrestaShop('stock_availables') // Stock
usePrestaShop('tax_rules')       // Règles de taxes
usePrestaShop('carriers')        // Transporteurs
usePrestaShop('currencies')      // Devises
```

## Options avancées

```js
// Sans display=full (liste IDs seulement)
usePrestaShop('products', { displayFull: false })

// Avec paramètres supplémentaires
usePrestaShop('products', {
  params: { filter: '[active]=[1]' }
})

// Ne pas déclencher la requête (ex: attendre une condition)
usePrestaShop('products', { skip: !isReady })
```

## Notes importantes

- Le hook se déclenche automatiquement au montage du composant
- Si `endpoint` change, la requête est relancée
- Le XML est automatiquement parsé en objet JS via `xmlParser.js`
- Les champs multilingues sont accessibles via `field?.language?.['#text']`
- Un champ avec `xlink:href` renvoie `{ '#text': valeur, '@_xlink:href': url }`
  → utiliser un helper `getVal(field)` pour extraire la valeur proprement