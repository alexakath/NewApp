# Les Maps XML: PRODUCT_LIST_MAP vs PRODUCT_DETAIL_MAP

Ce document explique la difference entre les deux maps et pourquoi on les utilise separement.

## 1) Pourquoi deux maps separees?

**PRODUCT_LIST_MAP**: pour quand tu listes plusieurs produits (GET /products)
**PRODUCT_DETAIL_MAP**: pour quand tu lis UN produit avec tous ses details (GET /products/{id})

Raison pratique:
- La liste est legere et rapide (peu de champs)
- Le detail est lourd et complet (tous les champs)

## 2) PRODUCT_LIST_MAP explique

```js
const PRODUCT_LIST_MAP = {
    id: '@id',           // lit l'attribut XML 'id'
    href: '@xlink:href', // lit l'attribut XML 'xlink:href'
    name: 'name',        // lit la balise XML <name>
    price: 'price',      // lit la balise XML <price>
    reference: 'reference',
    active: 'active',
    date_add: 'date_add',
    date_upd: 'date_upd',
};
```

### Ce que c'est
Un objet qui dit a `parseXml`: 
- "quels champs tu dois extraire du XML"
- "ou les trouver (attribut ou balise)"

### Comment ca marche

XML recu par l'API (avec `?display=full`):

```xml
<product id="1" xlink:href="http://api/products/1">
    <name>Chaise</name>
    <price>19.90</price>
    <reference>demo_1</reference>
    <active>1</active>
    <date_add>2024-01-15 10:30:00</date_add>
    <date_upd>2024-01-20 15:45:00</date_upd>
</product>
```

Quand tu appelles:

```js
const data = parseXml(xmlText, 'product', PRODUCT_LIST_MAP);
```

parseXml:
1. Cherche tous les `<product>` dans le XML
2. Pour chaque produit, extrait:
   - `id` depuis l'attribut `@id` (le `@` veut dire "attribut")
   - `href` depuis l'attribut `@xlink:href`
   - `name` depuis la balise `<name>`
   - `price` depuis la balise `<price>`
   - etc.

Resultat JavaScript:

```js
[
  {
    id: '1',
    href: 'http://api/products/1',
    name: 'Chaise',
    price: '19.90',
    reference: 'demo_1',
    active: '1',
    date_add: '2024-01-15 10:30:00',
    date_upd: '2024-01-20 15:45:00'
  }
]
```

## 3) PRODUCT_DETAIL_MAP explique

```js
const PRODUCT_DETAIL_MAP = {
    id: '@id',
    name: 'name',
    price: 'price',
    active: 'active',
    date_add: 'date_add',
    date_upd: 'date_upd',
};
```

### Difference avec LIST_MAP
- **Pas de `href`**
- Moins de champs (on garde seulement les essentiels)
- Utilise pour un seul element (detail complet d'un produit)

### Pourquoi?
Quand tu charges le detail d'UN produit via GET `/products/1`, l'API retourne beaucoup plus de donnees (description complete, attributs, images, etc.).

Tu veux extraire SEULEMENT les champs qui t'interessent pour l'affichage detail, pas tout le XML.

XML complet recu:

```xml
<product id="1" xlink:href="...">
    <name>Chaise</name>
    <price>19.90</price>
    <active>1</active>
    <date_add>2024-01-15 10:30:00</date_add>
    <date_upd>2024-01-20 15:45:00</date_upd>
    <!-- + 100 autres balises -->
    <description>...</description>
    <images>...</images>
    <!-- etc. -->
</product>
```

Resultat extrait:

```js
{
  id: '1',
  name: 'Chaise',
  price: '19.90',
  active: '1',
  date_add: '2024-01-15 10:30:00',
  date_upd: '2024-01-20 15:45:00'
}
```

## 4) Tableau comparatif

| Aspect | LIST_MAP | DETAIL_MAP |
|--------|----------|-----------|
| Quand utiliser | GET liste (/products) | GET detail (/products/{id}) |
| Nombre de champs | Minimum (allege) | Maximum (ce qu'on affiche) |
| Contient href? | Oui | Non |
| Contient reference? | Oui | Non |
| Retourne | Tableau | Un element |

## 5) Pourquoi cette separation est importante

### Performance
- Lister 100 produits: extrait juste les champs legers
- Afficher 1 produit detail: charge tous les details

### Clarté
- Chaque map dit exactement "je lis ces champs"
- Facile a modifier ou debugger

### Sécurité
- On controle exactement ce qui sort du XML
- Pas d'exposition accidentelle d'info sensible

## 6) La syntaxe '@' expliquee

### `@` veut dire "attribut XML"
```xml
<product id="10" xlink:href="http://api/products/10">
```

Extraire comme ca:
- `id: '@id'` -> lit l'attribut `id` (result: "10")
- `href: '@xlink:href'` -> lit l'attribut `xlink:href`

### Sans `@` veut dire "balise XML"
```xml
<product>
    <name>Chaise</name>
</product>
```

Extraire comme ca:
- `name: 'name'` -> lit la balise `<name>` (result: "Chaise")

## 7) Exemple complet du flux

### 1. Charger liste

```js
const text = await requestXml('?display=full');
// XML avec 10 produits, champs legers

const products = parseXml(text, 'product', PRODUCT_LIST_MAP);
// Array de 10 objets simplifies
```

### 2. Charger detail d'un produit

```js
const text = await requestXml('/1');
// XML du produit 1 avec tous les details

const product = parseXml(text, 'product', PRODUCT_DETAIL_MAP);
// Array avec 1 objet, on prend le [0]
```

## 8) Bonnes pratiques

- Creer une map list LEGERE (juste id + href + champs affichage)
- Creer une map detail plus RICHE (tous les champs affichage)
- Ne jamais hardcoder les selecteurs, utiliser une map
- Nommer les maps clairement: `<MODELE>_LIST_MAP` et `<MODELE>_DETAIL_MAP`

## 9) Pour un autre modele (categories par exemple)

Copier ce pattern:

```js
const CATEGORY_LIST_MAP = {
    id: '@id',
    href: '@xlink:href',
    name: 'name',
    active: 'active',
    date_add: 'date_add',
};

const CATEGORY_DETAIL_MAP = {
    id: '@id',
    name: 'name',
    description: 'description',
    id_parent: 'id_parent',
    active: 'active',
    date_add: 'date_add',
    date_upd: 'date_upd',
};
```

La seule difference: les champs specifiques a chaque modele.
