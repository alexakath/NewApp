# Apprentissage guide: CRUD Product (React + API XML)

Ce guide est fait pour apprendre en mode progressif, puis reproduire la meme methode sur d'autres modeles (clients, commandes, categories) sans IA.

## Objectif final

A la fin, tu dois savoir:
- Lire une liste de produits (READ list)
- Lire un produit detail (READ one)
- Creer un produit (CREATE)
- Modifier un produit (UPDATE)
- Supprimer un produit (DELETE)
- Fiabiliser le flux (erreurs, validation, performance)

## 1) Comprendre la base existante

Fichiers cles du projet:
- `src/api/produits.js`: couche API produits
- `src/utils/xmlParser.js`: parse XML + build XML
- `src/components/`: UI React

Role de chaque couche:
- API (`src/api`): parle au serveur, gere HTTP/XML
- UI (`src/components`): affiche, saisit, declenche des actions
- Utils (`src/utils`): reutilisables techniques (parser/build XML)

## 2) CRUD produit deja pret dans le projet

Le module `src/api/produits.js` expose maintenant:
- `fetchProduits()`
- `fetchProduct(id)`
- `createProduct(data)`
- `updateProduct(id, data)`
- `deleteProduct(id)`

Points importants implementes:
- Validation de l'id produit (entier positif)
- Validation minimale sur create (name, price, id_category_default)
- Gestion centralisee des erreurs HTTP
- Construction XML via `buildXML`
- URL robuste (`/api/products/{id}`)

## 3) Atelier React pas a pas

### Etape A: Lister les produits

Objectif:
- Charger les produits au montage
- Afficher un tableau
- Gérer `loading` et `error`

Mini pattern:

```jsx
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

useEffect(() => {
  let mounted = true;

  async function load() {
    try {
      setLoading(true);
      const data = await fetchProduits();
      if (mounted) setItems(data);
    } catch (e) {
      if (mounted) setError(e.message || 'Erreur chargement');
    } finally {
      if (mounted) setLoading(false);
    }
  }

  load();
  return () => {
    mounted = false;
  };
}, []);
```

### Etape B: Voir un produit detail

Objectif:
- Cliquer sur un id
- Charger `fetchProduct(id)`
- Afficher dans une carte

### Etape C: Creer un produit

Objectif:
- Formulaire React controle
- Validation locale avant POST
- Appel `createProduct(payload)`
- Refresh de liste apres succes

Validation minimum front:
- `name` obligatoire
- `price` numerique et >= 0
- `id_category_default` obligatoire

### Etape D: Modifier un produit

Objectif:
- Charger un produit dans le formulaire
- Soumettre `updateProduct(id, payload)`
- Afficher confirmation

Regle pratique:
- N'envoyer que les champs utiles (eviter payload massif)

### Etape E: Supprimer un produit

Objectif:
- Bouton delete avec confirmation
- Appel `deleteProduct(id)`
- Mise a jour locale de liste sans recharger toute la page

```js
setItems((prev) => prev.filter((p) => p.id !== id));
```

## 4) Performance: regles simples et efficaces

- Eviter les re-renders inutiles: decomposer les composants
- Debouncer la recherche si filtre texte
- Charger seulement les champs necessaires (list vs detail)
- Ne pas refaire 2 fois le meme fetch si donnees deja en cache local
- Pour les gros volumes: pagination cote API

## 5) Securite et reduction des risques

- Ne jamais hardcoder la cle API dans le code source
- Toujours valider les donnees utilisateur avant POST/PUT
- Limiter les champs envoyes (whitelist)
- Gérer tous les cas d'erreur HTTP (4xx, 5xx)
- Echapper les valeurs XML (deja gere via `buildXML`)
- Ajouter un timeout/retry controle cote client si besoin

## 6) Check-list de validation (a faire a chaque CRUD)

- [ ] READ list OK
- [ ] READ detail OK
- [ ] CREATE OK
- [ ] UPDATE OK
- [ ] DELETE OK
- [ ] Erreurs API visibles dans UI
- [ ] Champs obligatoires valides
- [ ] Aucune info sensible exposee
- [ ] Temps de reponse acceptable sur 20+ enregistrements

## 7) Recette pour un autre modele sans IA

Reproduire exactement ce pattern:
1. Créer `src/api/<modele>.js`
2. Definir `MAP_LIST`, `MAP_DETAIL`
3. Ecrire `fetchItems`, `fetchItem`, `createItem`, `updateItem`, `deleteItem`
4. Creer page React `<Modele>Page` avec liste + formulaire
5. Appliquer check-list performance/securite

Exemples de modeles a enchainer:
- categories
- fournisseurs
- commandes
- stocks

## 8) Exercice d'autonomie (important)

Sans IA, fais ces 3 exercices:
1. Ajouter un champ `reference` obligatoire sur create/update.
2. Ajouter un filtre `actif/inactif` dans la liste React.
3. Ajouter un message d'erreur utilisateur clair pour code HTTP 400.

Si tu sais faire ces 3 points seul, tu maitrises le schema CRUD React/API/XML.
