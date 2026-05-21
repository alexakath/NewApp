# Explication des fonctions parse et fonctions XML

Ce document explique les fonctions de [src/utils/xmlParser.js](src/utils/xmlParser.js):
- `parseXml`
- `buildUrl`
- `escapeXML`
- `buildFields`
- `buildXML`

Objectif: comprendre exactement ce que fait chaque fonction pour etre autonome sans IA.

## 1) `parseXml(xmlText, itemSelector, fieldMap)`

### Role
Convertit une reponse XML en tableau d'objets JavaScript.

### Signature

```js
parseXml(xmlText, itemSelector, fieldMap)
```

### Parametres
- `xmlText` (`string`): contenu XML brut renvoye par l'API.
- `itemSelector` (`string`): tag cible repete (ex: `product`, `customer`).
- `fieldMap` (`object`): mapping cle JS -> selecteur XML.

### Comment ca marche
1. Cree un parseur DOM (`new DOMParser()`).
2. Parse le texte XML en document (`parseFromString`).
3. Verifie si XML invalide avec `parsererror`.
4. Recupere tous les noeuds cibles via `querySelectorAll(itemSelector)`.
5. Pour chaque noeud:
- si selecteur commence par `@`, lit un attribut (`getAttribute`)
- sinon lit un sous-tag (`querySelector(...).textContent`)
6. Retourne un tableau d'objets JS.

### Exemple

XML:

```xml
<prestashop>
  <products>
    <product id="10" xlink:href="/api/products/10">
      <name>Chaise</name>
      <price>19.90</price>
    </product>
  </products>
</prestashop>
```

Code:

```js
const data = parseXml(xmlText, 'product', {
  id: '@id',
  href: '@xlink:href',
  name: 'name',
  price: 'price',
});
```

Resultat:

```js
[
  {
    id: '10',
    href: '/api/products/10',
    name: 'Chaise',
    price: '19.90'
  }
]
```

### Points importants
- Si XML invalide: `throw new Error(...)`.
- Si tag absent: valeur `null` (grace a `?.` et `?? null`).
- Les nombres restent des strings; convertir avec `Number(...)` si besoin.

## 2) `buildUrl(path, API_KEY, API_URL)`

### Role
Construit l'URL finale avec cle API (`ws_key`) et gere `?`/`&` automatiquement.

### Signature

```js
buildUrl(path, API_KEY, API_URL)
```

### Parametres
- `path` (`string`): suffixe route (`''`, `'/10'`, `'?display=full'`).
- `API_KEY` (`string`): cle API (depuis `.env`).
- `API_URL` (`string`): base endpoint (`/api/products`).

### Comment ca marche
1. Verifie que `API_KEY` existe.
2. Determine separateur:
- `&` si `path` contient deja `?`
- sinon `?`
3. Construit `ws_key` avec `URLSearchParams`.
4. Concatene tout.

### Exemples

```js
buildUrl('', 'abc', '/api/products');
// /api/products?ws_key=abc

buildUrl('/10', 'abc', '/api/products');
// /api/products/10?ws_key=abc

buildUrl('?display=full', 'abc', '/api/products');
// /api/products?display=full&ws_key=abc
```

### Point de securite
- Ne jamais hardcoder la cle dans le code.
- Utiliser `import.meta.env.VITE_API_KEY`.

## 3) `escapeXML(value)` (interne)

### Role
Evite de casser le XML en echappant caracteres speciaux.

### Transformations
- `&` -> `&amp;`
- `<` -> `&lt;`
- `>` -> `&gt;`
- `"` -> `&quot;`
- `'` -> `&apos;`

### Pourquoi c'est critique
Sans cette fonction, une valeur utilisateur comme `A & B < C` peut produire un XML invalide.

## 4) `buildFields(obj)` (interne)

### Role
Transforme un objet JS en blocs XML de champs.

### Cas geres
- Champ simple

```js
{ name: 'Chaise' }
// <name>Chaise</name>
```

- Objet imbrique (ex: foreign key)

```js
{ id_default_group: { id: 3 } }
// <id_default_group><id>3</id></id_default_group>
```

### Comment ca marche
- Boucle sur `Object.entries(obj)`
- Si valeur est un objet non tableau: sous-balises
- Sinon: balise simple
- Echappe chaque valeur avec `escapeXML`

## 5) `buildXML(root, data)`

### Role
Cree un document XML complet PrestaShop pour POST/PUT.

### Signature

```js
buildXML(root, data)
```

### Parametres
- `root` (`string`): ressource cible (`product`, `customer`, etc.)
- `data` (`object`): donnees a envoyer

### Sortie
String XML complet:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <product>
    ...champs...
  </product>
</prestashop>
```

### Exemple

```js
const xml = buildXML('product', {
  name: 'Chaise premium',
  price: '49.90',
  active: 1,
  id_category_default: 2,
});
```

## 6) Flux complet (lecture + ecriture)

### Lecture (GET)
1. `fetch(...)`
2. `res.text()`
3. `parseXml(...)`
4. affichage React

### Ecriture (POST/PUT)
1. validation front
2. `buildXML(...)`
3. `fetch(..., { method, body: xml })`
4. gerer `res.ok`/erreur

## 7) Erreurs frequentes et correction

- Mauvais selecteur dans `fieldMap`
: verifier les tags exacts renvoyes par l'API.

- Attribut lu comme tag (ou inverse)
: utiliser `@id` pour attribut, `name` pour sous-tag.

- URL mal formee
: toujours passer par `buildUrl`.

- XML invalide en POST/PUT
: ne jamais construire les champs a la main sans `buildXML`.

## 8) Bonnes pratiques projet

- Conserver un `fieldMap` list et un `fieldMap` detail separes.
- Centraliser la requete HTTP dans une fonction helper.
- Valider les champs obligatoires avant `buildXML`.
- Journaliser les erreurs techniques en dev, message simple en UI.

## 9) Mini fiche memo

- Lire XML -> `parseXml`
- Construire URL API -> `buildUrl`
- Echapper texte XML -> `escapeXML`
- Transformer objet en balises -> `buildFields`
- Generer payload XML complet -> `buildXML`

Avec ces 5 fonctions, tu as la base complete pour tous les CRUD XML du projet.
