# Réinitialisation des Données (Reset Feature)

## Introduction

Cette fonctionnalité permet à l'administrateur de supprimer des données PrestaShop de manière **sélective, ordonnée et sécurisée** via l'interface de NewApp.

Elle remplace l’ancienne réinitialisation simple par module par un système beaucoup plus puissant et contrôlé.

---

## Architecture

### Fichiers créés / modifiés

| Fichier | Type | Rôle |
|-------|------|------|
| `src/api/utils/modulesConfig.js` | Config | Configuration centrale des modules + reset (ordre, sous-entités, IDs protégés) |
| `src/api/services/resetService.js` | Service | Logique métier : comptage, suppression ordonnée, gestion des sous-entités |
| `src/components/ResetModuleItem.jsx` | Composant | Carte réutilisable (module + sous-entités) |
| `src/pages/ResetPage.jsx` | Page | Interface principale (checklists, récapitulatif, confirmation) |
| `src/pages/ResetPage.css` | Style | Style de la page |
| `src/components/ResetModuleItem.css` | Style | Style des cartes modules |

---

## Workflow Technique

1. **Chargement des statistiques**
   - `getResetStats()` appelle `getCount()` sur chaque endpoint principal et sous-entité.
   - Utilise `display=[id]` pour des performances optimales.

2. **Sélection utilisateur**
   - L’utilisateur coche/décoche les modules et les sous-entités.
   - Tout est coché par défaut.

3. **Ordre de suppression** (critique)
   - Défini dans `modulesConfig.js` via la propriété `order`.
   - Ordre actuel : **Commandes → Clients → Entrepôts → Stock → Produits → Catégories → Fournisseurs → Marques → Taxes**

4. **Suppression**
   - `deleteAllSelected()` respecte l’ordre défini.
   - Pour chaque module : suppression des sous-entités sélectionnées → puis entité principale.
   - Protection automatique des IDs système (ex: catégories 1 et 2).

---

## Configuration d’un Module (modulesConfig.js)

Exemple pour le module `products` :

```javascript
reset: {
  order: 5,                    // Ordre de suppression (important)
  mainEndpoint: 'products',
  label: 'Produits',
  countEndpoint: 'products',
  subEntities: [
    { key: 'images', label: 'Images', endpoint: 'images' },
    { key: 'combinations', label: 'Combinations', endpoint: 'combinations' },
    // ...
  ],
  protectedIds: []             // IDs à ne jamais supprimer
}