# Guide des APIs GET et XML

## 1. Introduction aux APIs

Une API (Application Programming Interface) permet à des applications de communiquer entre elles. Dans un projet web, on utilise souvent des APIs pour récupérer des données depuis un serveur.

### Types d'API courantes
- REST (JSON ou XML)
- SOAP (XML)
- GraphQL

Ce guide se concentre sur les requêtes `GET` et sur les APIs qui renvoient des données en XML.

## 2. Comprendre la méthode GET

`GET` est la méthode HTTP utilisée pour lire ou récupérer des données.

### Caractéristiques de GET
- Ne modifie pas les données du serveur.
- Les paramètres sont généralement envoyés dans l'URL.
- C'est la méthode la plus utilisée pour charger des pages ou récupérer des listes.

### Exemple d'URL GET

```
https://api.exemple.com/users
```

Avec des paramètres :

```
https://api.exemple.com/users?limit=10&page=2
```

## 3. Structure d'une API

### 1) Endpoint
L'adresse du service, par exemple :

```
https://api.exemple.com/products
```

### 2) Ressource
Ce que vous demandez : `products`, `users`, `orders`.

### 3) Paramètres
Options envoyées dans l'URL :

- `?search=chaise`
- `?category=meuble`
- `?limit=20`

### 4) En-têtes (headers)
Informations supplémentaires envoyées avec la requête.

Exemple :

- `Accept: application/xml`
- `Content-Type: application/json`
- `Authorization: Bearer <token>`

## 4. API REST vs XML

### REST
- Peut retourner du JSON ou du XML.
- JSON est le format le plus courant aujourd'hui.

### XML
- Format textuel avec balises.
- Parfois utilisé par des services anciens ou professionnels.

### Exemple de réponse XML

```xml
<users>
  <user>
    <id>1</id>
    <name>Marie</name>
    <email>marie@example.com</email>
  </user>
  <user>
    <id>2</id>
    <name>Ali</name>
    <email>ali@example.com</email>
  </user>
</users>
```

## 5. Tester une API GET

### 1) Avec un navigateur
Ouvrez l'URL dans le navigateur si l'API ne nécessite pas d'authentification.

### 2) Avec Postman ou Insomnia
Outils pratiques pour envoyer des requêtes et voir la réponse.

### 3) Avec un script JavaScript

```js
fetch('https://api.exemple.com/users')
  .then(response => response.text())
  .then(xml => console.log(xml))
  .catch(error => console.error(error));
```

## 6. Récupérer et parser du XML en JavaScript

### 6.1 Requête GET avec fetch

```js
async function getUsers() {
  const response = await fetch('https://api.exemple.com/users', {
    method: 'GET',
    headers: {
      'Accept': 'application/xml'
    }
  });

  const xmlText = await response.text();
  return xmlText;
}
```

### 6.2 Convertir le XML en objet

```js
function parseXml(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const users = [];
  const userNodes = xmlDoc.getElementsByTagName('user');

  for (let i = 0; i < userNodes.length; i += 1) {
    const userNode = userNodes[i];
    const id = userNode.getElementsByTagName('id')[0].textContent;
    const name = userNode.getElementsByTagName('name')[0].textContent;
    const email = userNode.getElementsByTagName('email')[0].textContent;

    users.push({ id, name, email });
  }

  return users;
}
```

### 6.3 Exemple complet

```js
async function loadUsers() {
  try {
    const xmlText = await getUsers();
    const users = parseXml(xmlText);
    console.log(users);
  } catch (error) {
    console.error('Erreur API:', error);
  }
}

loadUsers();
```

## 7. Fonctions utiles pour un projet sans IA

### 7.1 Organisation d'un projet

- `src/api/` : fonctions qui appellent l'API
- `src/components/` : composants réutilisables
- `src/pages/` : pages principales
- `src/utils/` : helpers et parseurs

### 7.2 Exemple de fonction API

```js
// src/api/userApi.js
export async function fetchUsers() {
  const response = await fetch('https://api.exemple.com/users', {
    headers: { 'Accept': 'application/xml' }
  });
  const xmlText = await response.text();
  return parseXml(xmlText);
}
```

### 7.3 Exemple de fonction utilitaire

```js
// src/utils/xmlParser.js
export function parseXml(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const items = Array.from(xmlDoc.querySelectorAll('user'));

  return items.map(item => ({
    id: item.querySelector('id')?.textContent,
    name: item.querySelector('name')?.textContent,
    email: item.querySelector('email')?.textContent
  }));
}
```

## 8. Étapes pour construire un projet API sans IA

1. Définir les besoins : quelles données récupérer ?
2. Trouver ou créer les endpoints API.
3. Vérifier le format de réponse (XML ou JSON).
4. Tester les endpoints avec un navigateur ou Postman.
5. Implémenter les fonctions `GET` en JavaScript.
6. Parser la réponse XML et afficher les données.
7. Organiser le code par dossier (`api`, `utils`, `components`, `pages`).

## 9. Bonnes pratiques

- Toujours gérer les erreurs (`try/catch`).
- Séparer l'appel API et le parsing XML.
- Ne pas mettre les URLs d'API en dur partout : utiliser un fichier de configuration.
- Ajouter des commentaires courts pour expliquer les étapes.

## 10. Exemple de structure de dossier

```
src/
  api/
    userApi.js
  utils/
    xmlParser.js
  pages/
    Home.jsx
  components/
    UserList.jsx
```

## 11. Conclusion

Une API GET permet de récupérer des données. Avec XML, il faut lire le texte de la réponse, puis parser le XML en JavaScript. Organiser son projet et séparer les responsabilités facilite le développement sans recourir à une intelligence artificielle.

> Astuce : commencez par un petit service simple, testez les endpoints, puis élargissez progressivement votre projet.
