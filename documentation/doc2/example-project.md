# Exemple de projet : où mettre les fonctions et comment les utiliser

Ce document montre un exemple simple pour organiser les fonctions API, parser le XML et utiliser les données dans un composant React.

## 1. Structure recommandée

```
src/
  api/
    userApi.js
  utils/
    xmlParser.js
  components/
    UserList.jsx
  pages/
    Home.jsx
  App.jsx
  main.jsx
```

## 2. Fichier `src/api/userApi.js`

Ce fichier contient les fonctions qui appellent l'API.

```js
// src/api/userApi.js
import { parseXml } from '../utils/xmlParser';

const API_URL = 'https://api.exemple.com/users';

export async function fetchUsers() {
  const response = await fetch(API_URL, {
    method: 'GET',
    headers: {
      'Accept': 'application/xml'
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur API ${response.status}`);
  }

  const xmlText = await response.text();
  return parseXml(xmlText);
}
```

## 3. Fichier `src/utils/xmlParser.js`

Ce fichier contient la logique de conversion du XML en objets JavaScript.

```js
// src/utils/xmlParser.js
export function parseXml(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const users = Array.from(xmlDoc.querySelectorAll('user'));

  return users.map(userNode => ({
    id: userNode.querySelector('id')?.textContent,
    name: userNode.querySelector('name')?.textContent,
    email: userNode.querySelector('email')?.textContent
  }));
}
```

### ParseXml généralisable

Oui, `parseXml` peut être rendu général. Le principe est de séparer :

- l'analyse du XML en document (`DOMParser`)
- la sélection des nœuds à transformer
- la transformation de chaque nœud en objet JavaScript

Voici un exemple plus générique :

```js
// src/utils/xmlParser.js
export function parseXml(xmlText, itemSelector, fieldMap) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const items = Array.from(xmlDoc.querySelectorAll(itemSelector));

  return items.map(itemNode => {
    const result = {};

    Object.entries(fieldMap).forEach(([key, selector]) => {
      result[key] = itemNode.querySelector(selector)?.textContent || null;
    });

    return result;
  });
}
```

Et son utilisation :

```js
import { parseXml } from '../utils/xmlParser';

const xmlText = '<users>...</users>';
const users = parseXml(xmlText, 'user', {
  id: 'id',
  name: 'name',
  email: 'email'
});
```

Avec cette version, vous pouvez parser d'autres types de données simplement en changeant `itemSelector` et `fieldMap`.

## 4. Fichier `src/components/UserList.jsx`

Ce composant affiche la liste des utilisateurs.

```jsx
// src/components/UserList.jsx
import React from 'react';

export function UserList({ users }) {
  if (!users || users.length === 0) {
    return <p>Aucun utilisateur trouvé.</p>;
  }

  return (
    <div>
      <h2>Liste des utilisateurs</h2>
      <ul>
        {users.map(user => (
          <li key={user.id}>
            <strong>{user.name}</strong> - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 5. Fichier `src/pages/Home.jsx`

Cette page charge les données via l'API et utilise `UserList`.

```jsx
// src/pages/Home.jsx
import React, { useEffect, useState } from 'react';
import { fetchUsers } from '../api/userApi';
import { UserList } from '../components/UserList';

export function Home() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await fetchUsers();
        setUsers(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <p>Chargement en cours...</p>;
  }

  if (error) {
    return <p>Erreur : {error}</p>;
  }

  return (
    <main>
      <h1>Accueil</h1>
      <UserList users={users} />
    </main>
  );
}
```

## 6. Intégration dans `src/App.jsx`

Utilisez la page `Home` dans l'application principale.

```jsx
// src/App.jsx
import React from 'react';
import { Home } from './pages/Home';

function App() {
  return (
    <div className="App">
      <Home />
    </div>
  );
}

export default App;
```

## 7. Qu'est-ce que `vite.config.js` ?

`vite.config.js` est le fichier de configuration de Vite. Il permet de définir :

- les plugins utilisés (ici React)
- les options du serveur de développement
- les proxys pour rediriger les appels API
- d'autres règles de build pour la production

### Exemple dans ce projet

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost/prestashop_edition_classic_version_8.2.6',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

### Explication

- `plugins: [react()]` : active le support React dans Vite.
- `server.proxy` : permet de rediriger les requêtes vers un autre serveur pendant le développement.
- Ici, toute requête qui commence par `/api` sera envoyée vers `http://localhost/prestashop_edition_classic_version_8.2.6`.
- `changeOrigin: true` modifie l'en-tête `Origin` pour correspondre au serveur cible.
- `secure: false` permet d'utiliser un serveur cible sans HTTPS ou avec un certificat auto-signé.

### Pourquoi c'est utile

Lorsque vous développez localement, le navigateur charge le site depuis Vite (`localhost:5173`) mais l'API peut être sur un autre serveur. Le proxy évite les problèmes de CORS et vous permet d'écrire des URL propres, comme :

```js
fetch('/api/users')
```

## 8. Exemple de `src/main.jsx`

```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 8. Explication étape par étape

1. `src/api/userApi.js` : envoie la requête GET.
2. `src/utils/xmlParser.js` : transforme le XML en tableau d'objets.
3. `src/pages/Home.jsx` : appelle `fetchUsers` et stocke les résultats.
4. `src/components/UserList.jsx` : affiche les utilisateurs.
5. `src/App.jsx` : affiche la page d'accueil.

## 9. Où mettre chaque fonction

- `fetchUsers()` dans `src/api/` : uniquement pour les appels réseau.
- `parseXml()` dans `src/utils/` : uniquement pour la transformation de données.
- Composants visuels dans `src/components/`.
- Pages et logique de chargement dans `src/pages/`.

## 10. Conseils pour ajouter de nouvelles API

- Créez un nouveau fichier sous `src/api/` pour chaque groupe de données (par exemple `productApi.js`).
- Créez des fonctions de parsing adaptées dans `src/utils/` ou un fichier `xmlParser.js` plus générique.
- Réutilisez les composants existants pour afficher d'autres listes ou détails.

## 11. Bonus : gestion de la configuration

Pour ne pas écrire l'URL en dur partout, utilisez un fichier de configuration.

```js
// src/config/apiConfig.js
export const API_BASE_URL = 'https://api.exemple.com';
```

Puis dans `userApi.js` :

```js
import { API_BASE_URL } from '../config/apiConfig';
const API_URL = `${API_BASE_URL}/users`;
```

## 12. Résumé

Ce document présente un exemple simple et complet. En séparant :
- appel API,
- parsing XML,
- affichage des composants,
- logique de page,

vous obtenez un projet clair, facile à maintenir et adapté à un développement sans IA.
