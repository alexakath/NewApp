# Maitriser React + API + XML (mode autonome)

## Vue d'ensemble

Pour etre autonome, pense en 3 blocs:
- React = etat + affichage + actions utilisateur
- API = transport HTTP + auth + erreurs
- XML = format de donnees (parse + build)

Quand tu bloques, demande-toi dans quel bloc est le probleme.

## 1) Architecture cible

Arborescence conseillee:

```txt
src/
  api/
    produits.js
    clients.js
  components/
    ProductList.jsx
    ProductForm.jsx
  pages/
    ProductPage.jsx
  utils/
    xmlParser.js
```

Principes:
- `api/` sans logique visuelle
- `components/` sans logique reseau complexe
- `utils/` pur et testable

## 2) Contrat API clair

Toujours standardiser:
- input de fonction
- output de fonction
- erreurs lancees

Exemple:

```js
// input: id number positif
// output: objet produit | null
// throw: Error en cas echec HTTP/XML
fetchProduct(id)
```

Ce contrat evite 80% des bugs d'integration React.

## 3) XML: bonnes pratiques indispensables

- Parser en objet JS des reception (`parseXml`)
- Construire XML propre pour POST/PUT (`buildXML`)
- Echapper les caracteres speciaux (deja gere dans `escapeXML`)
- Eviter d'envoyer des champs inutiles

Erreurs XML frequentes:
- Tag mal ferme
- Champ attendu absent
- Encodage incoherent

## 4) React: pattern stable pour CRUD

State minimal recommande:

```js
const [items, setItems] = useState([]);
const [selectedId, setSelectedId] = useState(null);
const [form, setForm] = useState(initialForm);
const [loading, setLoading] = useState(false);
const [saving, setSaving] = useState(false);
const [error, setError] = useState('');
```

Flux:
- `loading` pour GET
- `saving` pour POST/PUT/DELETE
- `error` centralise et affiche dans UI

## 5) Performance sans complexite inutile

- N+1 requests: eviter de charger le detail de chaque element si non necessaire
- Memoiser les handlers si besoin (`useCallback`) sur composants volumineux
- Faire du filtrage cote API si la liste devient grande
- Utiliser pagination et recherche serveur

Regle de base:
- Liste = champs legers
- Detail = champs complets

## 6) Securite et robustesse

- Cle API uniquement via variables d'environnement
- Validation front + validation API
- Messages d'erreur utiles mais sans fuite d'info sensible
- Timeout/retry sur reseau instable (optionnel selon contexte)
- Toujours tester les cas: 200, 400, 401, 404, 500

## 7) Methode pour creer un nouveau modele

Template mental en 30 minutes:
1. Identifier les champs obligatoires du modele.
2. Ecrire la map XML list/detail.
3. Ecrire les 5 fonctions CRUD dans `src/api/<modele>.js`.
4. Ecrire une page React: liste + formulaire + suppression.
5. Tester en manuel avec check-list.

## 8) Check-list anti regression

Avant de considerer "termine":
- [ ] Le composant ne crash pas si API renvoie tableau vide
- [ ] Toute action reseau a un feedback visuel
- [ ] Le formulaire bloque les donnees invalides
- [ ] Les erreurs serveur sont lisibles
- [ ] Les donnees affichees sont coherentes apres mutation

## 9) Mini roadmap d'entrainement (7 jours)

Jour 1:
- CRUD produit complet

Jour 2:
- CRUD categorie

Jour 3:
- CRUD fournisseur

Jour 4:
- Ajout filtres/recherche et pagination

Jour 5:
- Factorisation d'un composant formulaire reutilisable

Jour 6:
- Gestion d'erreurs standardisee (helper global)

Jour 7:
- Refactor propre + revision check-list securite/performance

Si tu suis cette roadmap, tu peux ensuite construire de nouveaux modeles sans assistance IA.
