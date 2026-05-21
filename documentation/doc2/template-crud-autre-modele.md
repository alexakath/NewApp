# Template CRUD pour autre modele (sans IA)

Ce document te donne une methode simple pour refaire un CRUD complet sur n'importe quel modele: categories, suppliers, stocks, etc.

## 1) Le coeur: `requestXml`

Dans [src/api/produits.js](src/api/produits.js#L55), la fonction `requestXml` centralise toute la logique HTTP.

Ce qu'elle fait:
1. Construit l'URL avec `buildUrl(path, API_KEY, API_BASE)`.
2. Envoie la requete `fetch` avec `method`, `Accept`, et `Content-Type` si body XML.
3. Lit la reponse en texte (`response.text()`) car l'API repond en XML.
4. Si `response.ok` est faux, lance une erreur claire avec status + body.
5. Retourne le texte XML.

Pourquoi c'est important:
- Evite de dupliquer le meme code dans GET/POST/PUT/DELETE.
- Rend les erreurs coherentes dans tout le module.
- Simplifie le debug.

## 2) Structure standard d'un module CRUD

Creer un fichier: `src/api/<modele>.js`

Copier ce squelette:

```js
import { parseXml, buildUrl, buildXML } from '../utils/xmlParser';

const API_KEY = import.meta.env.VITE_API_KEY;
const API_BASE = '/api/<modele>';

const ITEM_LIST_MAP = {
  id: '@id',
  href: '@xlink:href',
};

const ITEM_DETAIL_MAP = {
  id: '@id',
  name: 'name',
  active: 'active',
  date_add: 'date_add',
  date_upd: 'date_upd',
};

function normalizeId(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Id must be a positive integer');
  }
  return value;
}

function sanitizePayload(data = {}, { requireCoreFields = false } = {}) {
  const payload = {
    name: data.name,
    active: data.active ?? 1,
  };

  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)
  );

  if (requireCoreFields) {
    const required = ['name'];
    const missing = required.filter((key) => !cleaned[key] && cleaned[key] !== 0);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  return cleaned;
}

async function requestXml(path = '', options = {}) {
  const { method = 'GET', body } = options;

  const response = await fetch(buildUrl(path, API_KEY, API_BASE), {
    method,
    headers: {
      Accept: 'application/xml',
      ...(body ? { 'Content-Type': 'application/xml' } : {}),
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API ${method} failed (${response.status}): ${text}`);
  }

  return text;
}

export async function fetchItems() {
  const text = await requestXml('');
  return parseXml(text, '<itemTag>', ITEM_LIST_MAP);
}

export async function fetchItem(id) {
  const itemId = normalizeId(id);
  const text = await requestXml(`/${itemId}`);
  const items = parseXml(text, '<itemTag>', ITEM_DETAIL_MAP);
  return items[0] ?? null;
}

export async function createItem(data) {
  const payload = sanitizePayload(data, { requireCoreFields: true });
  const xml = buildXML('<itemTag>', payload);
  const text = await requestXml('', { method: 'POST', body: xml });
  const items = parseXml(text, '<itemTag>', ITEM_DETAIL_MAP);
  return items[0] ?? null;
}

export async function updateItem(id, data) {
  const itemId = normalizeId(id);
  const payload = sanitizePayload(data);

  if (Object.keys(payload).length === 0) {
    throw new Error('No fields provided for update');
  }

  const xml = buildXML('<itemTag>', { id: itemId, ...payload });
  const text = await requestXml(`/${itemId}`, { method: 'PUT', body: xml });
  const items = parseXml(text, '<itemTag>', ITEM_DETAIL_MAP);
  return items[0] ?? null;
}

export async function deleteItem(id) {
  const itemId = normalizeId(id);
  await requestXml(`/${itemId}`, { method: 'DELETE' });
  return true;
}
```

## 3) Ce que tu changes pour chaque modele

Quand tu copies le template, remplace:
- `API_BASE` (ex: `/api/categories`)
- `<itemTag>` (ex: `category`)
- `ITEM_LIST_MAP` et `ITEM_DETAIL_MAP` selon les tags XML
- `sanitizePayload` selon les champs obligatoires du modele

## 3.1) Explication de `normalizeId`

Role:
- Securiser les operations qui utilisent un id (`fetchItem`, `updateItem`, `deleteItem`).

Code:

```js
function normalizeId(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Id must be a positive integer');
  }
  return value;
}
```

Ce que fait chaque ligne:
1. `Number(id)` convertit la valeur en nombre (ex: `'10'` devient `10`).
2. `Number.isInteger(value)` verifie que c'est un entier.
3. `value <= 0` refuse `0` et les negatifs.
4. Si invalide, la fonction bloque avec une erreur.
5. Si valide, elle retourne un id propre et fiable.

Exemples:
- `normalizeId('12')` -> `12`
- `normalizeId(5)` -> `5`
- `normalizeId('abc')` -> erreur
- `normalizeId(0)` -> erreur

Pourquoi c'est important:
- Evite les URL invalides (`/api/items/abc`).
- Evite des appels dangereux ou incoherents cote API.
- Rend les erreurs plus claires pour le debug.

## 3.2) Explication de `sanitizePayload`

Role:
- Nettoyer les donnees avant `buildXML`.
- Garder seulement les champs autorises.
- Verifier les champs obligatoires en creation.

Code:

```js
function sanitizePayload(data = {}, { requireCoreFields = false } = {}) {
  const payload = {
    name: data.name,
    active: data.active ?? 1,
  };

  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)
  );

  if (requireCoreFields) {
    const required = ['name'];
    const missing = required.filter((key) => !cleaned[key] && cleaned[key] !== 0);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  return cleaned;
}
```

Ce que fait chaque bloc:
1. Cree `payload`: liste blanche des champs autorises.
2. Nettoie les valeurs `undefined`/`null`.
3. Si `requireCoreFields = true`, controle les champs obligatoires.
4. Si un champ manque, lance une erreur explicite.
5. Retourne un objet propre, pret pour `buildXML`.

Exemples:

```js
sanitizePayload({ name: 'Cat A' }, { requireCoreFields: true });
// { name: 'Cat A', active: 1 }

sanitizePayload({ active: 0 }, { requireCoreFields: true });
// Erreur: Missing required fields: name

sanitizePayload({ name: 'Cat B', unused: 'x' });
// { name: 'Cat B', active: 1 }  -> "unused" est ignore
```

Pourquoi c'est important:
- Reduit les erreurs API (payload invalide).
- Evite d'envoyer des champs non prevus.
- Protege contre des donnees sales issues du formulaire.

Regle pratique:
- `createItem` appelle `sanitizePayload(..., { requireCoreFields: true })`.
- `updateItem` appelle `sanitizePayload(..., { requireCoreFields: false })`.

## 4) Exemple concret: passer de product a category

- `API_BASE`: `/api/categories`
- Tag XML: `category`
- Champs obligatoires possibles:
- `name`
- `id_parent`
- `active`

## 5) Solution recommandee

La bonne approche avec le code actuel est de garder ce module comme couche d'acces API, puis de rajouter une couche metier au-dessus quand les regles deviennent plus complexes.

En pratique:
- `src/api/<modele>.js` gere seulement les appels HTTP, le parsing XML, et la validation technique de base.
- Un service metier gere les regles fonctionnelles: statut, dependances entre champs, droits, workflows, et validations croisees.
- Les composants React ne doivent pas construire les regles; ils doivent seulement declencher le service adapte.

Ce que le code actuel peut gerer correctement:
- champs obligatoires simples
- id valide
- payload vide refuse
- nettoyage des valeurs inutiles
- erreurs HTTP de base

Ce qu'il faut sortir du module API des que possible:
- regles entre plusieurs champs
- workflow de validation ou publication
- controle des permissions
- coherence entre plusieurs entites
- validation forte par cas d'usage

## 6) Limites du document et du pattern

Ce template est efficace pour du CRUD standard, mais il a des limites.

- Il suppose une API XML stable.
- Il reste fragile si les noms de tags changent.
- Il ne remplace pas une vraie couche metier.
- Il ne couvre pas les transactions multi-etapes.
- Il ne gere pas les contraintes complexes sans code supplementaire.

Conclusion pratique: ce pattern est bon pour la base CRUD, pas pour toute la logique metier de l'application.

## 7) Regles anti-risque

- Toujours valider l'id avec `normalizeId`.
- Toujours valider les champs obligatoires avant `buildXML`.
- Toujours lire la reponse avec `res.text()` (API XML).
- Toujours verifier `response.ok`.
- Ne jamais hardcoder la cle API.

## 8) Checklist de fin

- [ ] `fetchItems` retourne une liste
- [ ] `fetchItem` retourne un element ou `null`
- [ ] `createItem` fonctionne avec champs obligatoires
- [ ] `updateItem` refuse payload vide
- [ ] `deleteItem` supprime sans erreur
- [ ] les erreurs HTTP sont compréhensibles

## 9) Mini plan d'execution (30 min)

1. Copier le template dans `src/api/<modele>.js`.
2. Adapter map + payload.
3. Tester GET list + GET one.
4. Tester POST.
5. Tester PUT.
6. Tester DELETE.
7. Integrer dans composant React.

Si tu suis ce template strictement, tu peux reproduire un CRUD complet sur tous tes modeles.
