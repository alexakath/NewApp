# Reference code et syntaxe (React + API + XML)

Ce document est un pense-bete pratique pour coder vite, proprement, et sans risque.

## 1) JavaScript utile au quotidien

### Variables

```js
const apiBase = '/api/products'; // valeur fixe
let page = 1; // valeur qui change
```

### Conditions

```js
if (!id) {
  throw new Error('id requis');
}

const status = active ? 'actif' : 'inactif';
```

### Boucles et tableaux

```js
const ids = products.map((p) => p.id);
const actifs = products.filter((p) => Number(p.active) === 1);
const found = products.find((p) => p.id === 10);
```

### Objet

```js
const payload = {
  name: form.name,
  price: form.price,
  active: form.active ?? 1,
};

const cleaned = Object.fromEntries(
  Object.entries(payload).filter(([, v]) => v !== undefined && v !== null)
);
```

## 2) Async/await et gestion d'erreurs

### Pattern standard

```js
async function loadData() {
  try {
    const data = await fetchProduits();
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
```

### Pattern fetch robuste

```js
async function requestXml(url, options = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/xml' },
    ...options,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return text;
}
```

## 3) React syntaxe essentielle

### useState

```jsx
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
```

### useEffect (chargement initial)

```jsx
useEffect(() => {
  let mounted = true;

  async function run() {
    try {
      setLoading(true);
      const data = await fetchProduits();
      if (mounted) setItems(data);
    } catch (e) {
      if (mounted) setError(e.message);
    } finally {
      if (mounted) setLoading(false);
    }
  }

  run();
  return () => {
    mounted = false;
  };
}, []);
```

### Formulaire controle

```jsx
const [form, setForm] = useState({ name: '', price: '', id_category_default: '' });

function onChange(e) {
  const { name, value } = e.target;
  setForm((prev) => ({ ...prev, [name]: value }));
}

<input name="name" value={form.name} onChange={onChange} />
```

### Rendu conditionnel

```jsx
if (loading) return <p>Chargement...</p>;
if (error) return <p style={{ color: 'red' }}>{error}</p>;
if (!items.length) return <p>Aucune donnee</p>;
```

## 4) API REST: CRUD syntaxe rapide

### READ list

```js
const text = await requestXml(buildUrl('', API_KEY, API_BASE));
const items = parseXml(text, 'product', {
  id: '@id',
  href: '@xlink:href',
});
```

### READ one

```js
const text = await requestXml(buildUrl(`/${id}`, API_KEY, API_BASE));
const products = parseXml(text, 'product', {
  id: '@id',
  name: 'name',
  price: 'price',
});
```

### CREATE

```js
const xml = buildXML('product', {
  name: 'Produit A',
  price: '19.90',
  id_category_default: 2,
  active: 1,
});

await requestXml(buildUrl('', API_KEY, API_BASE), {
  method: 'POST',
  headers: { 'Content-Type': 'application/xml' },
  body: xml,
});
```

### UPDATE

```js
const xml = buildXML('product', {
  id: 10,
  name: 'Produit MAJ',
  price: '24.90',
});

await requestXml(buildUrl('/10', API_KEY, API_BASE), {
  method: 'PUT',
  headers: { 'Content-Type': 'application/xml' },
  body: xml,
});
```

### DELETE

```js
await requestXml(buildUrl('/10', API_KEY, API_BASE), {
  method: 'DELETE',
});
```

## 5) XML syntaxe de base

### Lire XML

```js
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

if (xmlDoc.querySelector('parsererror')) {
  throw new Error('XML invalide');
}
```

### Mapper un noeud

```js
const product = {
  id: node.getAttribute('id'),
  name: node.querySelector('name')?.textContent ?? null,
};
```

### Construire XML propre

```js
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <product>
    <name>Produit A</name>
  </product>
</prestashop>`;
```

## 6) Validation syntaxe (front)

```js
function validateProduct(form) {
  if (!form.name?.trim()) return 'name obligatoire';
  if (Number.isNaN(Number(form.price)) || Number(form.price) < 0) return 'price invalide';
  if (!form.id_category_default) return 'id_category_default obligatoire';
  return '';
}
```

## 7) Anti-erreurs frequentes

- URL sans slash: preferer `/api/products/${id}`
- `res.json()` sur une API XML: utiliser `res.text()`
- Oublier `Content-Type: application/xml` en POST/PUT
- Envoyer trop de champs inutiles
- Ne pas traiter `res.ok`

## 8) Performance minimale recommandee

- Charger liste legere puis detail a la demande
- Debounce sur recherche texte
- Eviter les appels en double dans `useEffect`
- Mettre a jour l'etat local apres create/update/delete au lieu de full reload

## 9) Securite minimale recommandee

- API key dans `.env` uniquement
- Validation des entrees avant envoi
- Messages d'erreur utiles sans afficher de secrets
- Journaliser les erreurs techniques uniquement en dev

## 10) Template reutilisable pour un nouveau modele

Copier ce squelette dans `src/api/<modele>.js`:

```js
import { parseXml, buildUrl, buildXML } from '../utils/xmlParser';

const API_KEY = import.meta.env.VITE_API_KEY;
const API_BASE = '/api/<modele>';

export async function fetchItems() {}
export async function fetchItem(id) {}
export async function createItem(data) {}
export async function updateItem(id, data) {}
export async function deleteItem(id) {}
```

Puis brancher un composant React avec:
- liste
- formulaire
- boutons edit/delete
- etats `loading`, `saving`, `error`
