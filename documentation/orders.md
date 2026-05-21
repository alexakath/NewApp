### Modification  de l'etat d'un commande 
    ## Table utilise : ps_order_state
        1  → En attente de paiement
        2  → Paiement accepté        ← "Paiement effectué"
        3  → Préparation en cours
        4  → Expédié
        5  → Livré
        6  → Annulé                  ← "Annulé"
        7  → Remboursé
        8  → Erreur de paiement      ← "Échec paiement"
        9  → En attente de virement
        10 → En attente de chèque

# Pattern — Mise à jour d'une ressource PrestaShop (PUT)

## Problème
PrestaShop exige qu'un PUT renvoie l'objet **complet**,
pas seulement le champ modifié. Un PUT partiel retourne
une erreur 400.

## Pattern général

```js
export const updateField = async (id, newValue) => {
  // 1. Récupérer l'objet actuel complet
  const current = await getById(id)
  const obj = current?.prestashop?.[resource]
  if (!obj) throw new Error(`Ressource #${id} introuvable`)

  // 2. Construire le XML complet avec le champ modifié
  const xml = buildXml(obj, newValue)

  // 3. PUT avec le XML complet
  const response = await axiosInstance.put(`/${endpoint}/${id}`, xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
  return parseXML(response.data)
}
```

## Généralisation
Ce pattern s'applique à toute mise à jour partielle :
- Commande : `current_state`
- Produit : `active`, `price`, `quantity`
- Client : `active`, `email`

## Mise à jour locale (optimistic update)
Pour éviter de recharger toute la liste après un PUT,
on met à jour l'état local React immédiatement :

```js
const [localStates, setLocalStates] = useState({})

// Après PUT réussi :
setLocalStates((prev) => ({
  ...prev,
  [id]: { field: newValue }
}))

// Dans le rendu :
const displayed = localStates[id]?.field || original.field
```

## Feedback visuel (3 états)
- `isUpdating` → spinner sur la ligne
- succès → badge mis à jour via localStates
- erreur → message rouge sous le badge

## Exemple — Commande
- Endpoint : `PUT /api/orders/{id}`
- Champ modifié : `current_state`
- États disponibles : `2` (payé), `6` (annulé), `8` (échec)
- Impact PrestaShop : `ps_orders.current_state` + `ps_order_history`